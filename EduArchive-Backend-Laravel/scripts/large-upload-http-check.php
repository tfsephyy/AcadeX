<?php

// Included only by the guarded disposable-MySQL HTTP probe after cookie login.
// Sends real multipart bodies. No production database or real PDF is used.
$fixture = $private.'/synthetic-large-'.bin2hex(random_bytes(8)).'.pdf';
$createdId = null;
$largePath = null;
$fixtureBytes = isset($argv[2]) ? (int) $argv[2] : 134217728;
if ($fixtureBytes < 20971521 || $fixtureBytes > 134217728) throw new RuntimeException('Invalid synthetic fixture size.');
$output = fopen($fixture, 'x+b');
try {
    $header = "%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [] /Count 0 >>\nendobj\n";
    fwrite($output, $header);
    $remaining = $fixtureBytes - strlen($header) - 6;
    $block = str_repeat('%'.str_repeat('x', 1022)."\n", 1024);
    while ($remaining > 0) {
        $part = substr($block, 0, min($remaining, strlen($block)));
        \App\Services\VerifiedDocument::writeAll($output, $part);
        $remaining -= strlen($part);
    }
    fwrite($output, "\n%%EOF");
} finally { fclose($output); }
$upload = function () use ($curl, $fixture, $port, $csrf) {
    curl_setopt_array($curl, [CURLOPT_URL => "http://127.0.0.1:$port/api/v1/student/capstones/upload",
        CURLOPT_CUSTOMREQUEST => 'POST', CURLOPT_POSTFIELDS => ['pdf' => new CURLFile($fixture, 'application/pdf', 'synthetic-large.pdf'), 'skip_extraction' => '1'],
        // Windows' development server buffers large request bodies before the
        // router runs. Allow the slow synthetic transfer without relaxing app limits.
        CURLOPT_RETURNTRANSFER => true, CURLOPT_HEADER => false, CURLOPT_TIMEOUT => 600,
        CURLOPT_HTTPHEADER => ['Accept: application/json', 'Expect:', 'X-CSRF-TOKEN: '.$csrf, 'Origin: http://localhost:18881']]);
    $body = curl_exec($curl);
    if ($body === false) {
        fwrite(STDERR, 'Large multipart HTTP transfer: '.curl_error($curl).PHP_EOL);
        throw new RuntimeException('Large multipart HTTP transfer failed.');
    }
    return [curl_getinfo($curl, CURLINFO_RESPONSE_CODE), json_decode($body, true)];
};
try {
    [$status, $data] = $upload();
    $expect($status, 200, 'Real HTTP '.round($fixtureBytes/1048576).' MiB multipart upload');
    if (($data['data']['extraction_status'] ?? '') !== 'skipped') throw new RuntimeException('Storage probe unexpectedly reached extraction.');
    $reference = $data['data']['pdf_path'];
    $allocation = \App\Models\DocumentUpload::findOrFail(substr($reference, 7));
    $largePath = $allocation->path;
    [$status, $created] = $request('POST', '/student/capstones', [
        'title' => 'Synthetic HTTP Large '.$id, 'author' => 'Synthetic', 'pdf_path' => $reference,
    ], $csrf);
    $expect($status, 201, 'Real HTTP large capstone submission');
    $createdId = $created['data']['id'];
    $hash = hash_init('sha256');
    $received = 0;
    curl_setopt_array($curl, [CURLOPT_URL => "http://127.0.0.1:$port/api/v1/capstones/$createdId/pdf",
        CURLOPT_CUSTOMREQUEST => 'GET', CURLOPT_POSTFIELDS => null, CURLOPT_HEADER => false,
        CURLOPT_RETURNTRANSFER => false, CURLOPT_HTTPHEADER => ['Accept: application/pdf'],
        CURLOPT_WRITEFUNCTION => static function ($handle, $chunk) use ($hash, &$received) {
            hash_update($hash, $chunk); $received += strlen($chunk); return strlen($chunk);
        }]);
    if (curl_exec($curl) === false) throw new RuntimeException('Large streamed retrieval failed.');
    $expect(curl_getinfo($curl, CURLINFO_RESPONSE_CODE), 200, 'Real HTTP authorized large PDF retrieval');
    if ($received !== $fixtureBytes || hash_final($hash) !== hash_file('sha256', $fixture)) throw new RuntimeException('Large document bytes differ.');
    echo 'Large retrieval byte count and SHA-256: PASSED'.PHP_EOL;
    // Reset the streaming callback before JSON requests.
    curl_setopt($curl, CURLOPT_WRITEFUNCTION, null);
    if ($fixtureBytes === 134217728) {
        file_put_contents($fixture, 'x', FILE_APPEND);
        clearstatcache(true, $fixture);
        [$status] = $upload();
        $expect($status, 413, 'Real HTTP 128 MiB plus one byte rejection');
    }
    echo 'Probe memory peak: '.round(memory_get_peak_usage(true) / 1048576, 1).' MiB'.PHP_EOL;
} finally {
    if ($createdId) \App\Models\Capstone::withoutGlobalScopes()->whereKey($createdId)->where('uploaded_by', $user->id)->delete();
    if ($largePath) {
        \App\Models\DocumentUpload::where('user_id', $user->id)->where('path', $largePath)->delete();
        \Illuminate\Support\Facades\Storage::disk('local')->delete($largePath);
    }
    @unlink($fixture);
    curl_setopt($curl, CURLOPT_WRITEFUNCTION, null);
    curl_setopt($curl, CURLOPT_RETURNTRANSFER, true);
}
