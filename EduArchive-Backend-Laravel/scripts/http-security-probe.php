<?php

// Included only after the runner's disposable MySQL connection/config guards.
use App\Models\Role;
use App\Models\User;
use App\Models\Capstone;
use App\Services\PdfEncryptorService;

$private = realpath($base.'/../.local/remediation-test');
if (!$private) throw new RuntimeException('Create the isolated test-artifact directory first.');
config(['filesystems.disks.local.root' => $private.'/http-storage']);
foreach (['SESSION_DRIVER' => 'database', 'SESSION_SECURE_COOKIE' => 'false',
    'PRIVATE_STORAGE_ROOT' => $private.'/http-storage', 'FRONTEND_URL' => 'http://localhost:18881'] as $name => $value) putenv($name.'='.$value);
$password = bin2hex(random_bytes(12)).'Aa!';
$id = bin2hex(random_bytes(6));
$role = Role::firstOrCreate(['name' => 'student']);
$user = User::create(['name' => 'Synthetic HTTP Student', 'username' => 'http_'.$id,
    'email' => $id.'@example.invalid', 'id_number' => 'HTTP-'.$id, 'role_id' => $role->id,
    'password' => $password, 'is_approved' => true])->forceFill(['email_verified_at' => now()]);
$user->save();
$other = User::create(['name' => 'Synthetic HTTP Owner', 'username' => 'owner_'.$id,
    'email' => 'owner_'.$id.'@example.invalid', 'id_number' => 'OWNER-'.$id, 'role_id' => $role->id,
    'password' => $password, 'is_approved' => true])->forceFill(['email_verified_at' => now()]);
$other->save();
$bytes = "%PDF-1.4\n% Synthetic HTTP retrieval fixture only\n%%EOF\n";
$path = 'capstones/'.bin2hex(random_bytes(16)).'.enc';
app(PdfEncryptorService::class)->encryptRawAndStore($path, $bytes);
$capstone = Capstone::create(['title' => 'Synthetic HTTP Private '.$id, 'author' => 'Synthetic Owner', 'year' => 2026,
    'uploaded_by' => $other->id, 'status' => 'pending', 'approval_status' => 'pending',
    'publication_status' => 'unpublished', 'pdf_path' => $path]);
$port = 18880;
$socket = @stream_socket_server("tcp://127.0.0.1:$port", $errno, $errstr);
if (!$socket) throw new RuntimeException('The isolated probe port is occupied; no process will be stopped.');
fclose($socket);
$log = $private.'/http-server.log';
$process = proc_open([PHP_BINARY, '-S', "127.0.0.1:$port", '-t', $base.'/public', $base.'/public/index.php'],
    [0 => ['pipe', 'r'], 1 => ['file', $log, 'a'], 2 => ['file', $log, 'a']], $pipes, $base);
$curl = curl_init();
curl_setopt_array($curl, [CURLOPT_RETURNTRANSFER => true, CURLOPT_COOKIEFILE => '', CURLOPT_TIMEOUT => 15]);
$request = function ($method, $path, $body = null, $csrf = null, $extra = []) use ($curl, $port) {
    $headers = ['Accept: application/json', 'Content-Type: application/json', 'Origin: http://localhost:18881'];
    if ($csrf !== null) $headers[] = 'X-CSRF-TOKEN: '.$csrf;
    curl_setopt_array($curl, [CURLOPT_URL => "http://127.0.0.1:$port/api/v1$path", CURLOPT_CUSTOMREQUEST => $method,
        CURLOPT_POSTFIELDS => $body === null ? null : json_encode($body), CURLOPT_HTTPHEADER => array_merge($headers, $extra), CURLOPT_HEADER => true]);
    $response = curl_exec($curl);
    if ($response === false) throw new RuntimeException('Synthetic HTTP request failed.');
    $status = curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
    $size = curl_getinfo($curl, CURLINFO_HEADER_SIZE);
    return [$status, json_decode(substr($response, $size), true), substr($response, 0, $size), substr($response, $size)];
};
$expect = function ($actual, $expected, $name) {
    if ($actual !== $expected) throw new RuntimeException($name.' failed: status '.$actual);
    echo $name.': PASSED'.PHP_EOL;
};
try {
    for ($i = 0; $i < 40; $i++) {
        $connection = @fsockopen('127.0.0.1', $port);
        if ($connection) { fclose($connection); break; }
        usleep(100000);
    }
    [$status, $data, $headers] = $request('GET', '/csrf-token');
    $expect($status, 200, 'Live CSRF session initialization');
    if (!str_contains(strtolower($headers), 'access-control-allow-origin: http://localhost:18881')) throw new RuntimeException('Exact CORS origin missing.');
    $payload = ['email' => $user->email, 'password' => $password];
    $expect($request('POST', '/login', $payload)[0], 419, 'Live missing-CSRF rejection');
    [$status, $data, $headers] = $request('POST', '/login', $payload, $data['csrf_token']);
    $expect($status, 200, 'Live cookie login');
    $csrf = $data['data']['csrf_token'];
    $expect($request('GET', '/user')[0], 200, 'Live cookie persists across requests');
    $expect($request('GET', "/capstones/$capstone->id/pdf")[0], 404, 'Live guessed private document rejection');
    $expect($request('GET', "/capstones/$capstone->id")[0], 404, 'Live guessed private metadata rejection');
    $capstone->update(['status' => 'approved', 'approval_status' => 'approved', 'publication_status' => 'published']);
    [$status, , , $pdf] = $request('GET', "/capstones/$capstone->id/pdf");
    $expect($status, 200, 'Live authorized encrypted document retrieval');
    if ($pdf !== $bytes) throw new RuntimeException('Encrypted retrieval bytes differ.');
    $expect($request('POST', '/logout', [], $csrf)[0], 200, 'Live CSRF logout');
    $expect($request('GET', '/user')[0], 401, 'Live logout revocation');
} finally {
    curl_close($curl);
    proc_terminate($process); // Only the server spawned by this probe.
    proc_close($process);
}
