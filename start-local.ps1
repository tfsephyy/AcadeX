param([switch]$WithoutOcr)
$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$local = Join-Path $root '.local'
$backend = Join-Path $root 'EduArchive-Backend-Laravel'
$frontend = Join-Path $root 'EduArchive-Frontend-React'
$receiptPath = Join-Path $local 'processes.json'
New-Item -ItemType Directory -Path $local -Force | Out-Null
$records = @()
if (Test-Path $receiptPath) {
    $records = Get-Content $receiptPath -Raw | ConvertFrom-Json
}
function Start-OwnedService($Name, $Executable, $Arguments, $Directory, $Port = 0) {
    $existing = @($records) | Where-Object { $_.Name -eq $Name } | Select-Object -Last 1
    if ($existing) {
        $running = Get-Process -Id $existing.Id -ErrorAction SilentlyContinue
        if ($running -and $running.StartTime.ToUniversalTime().Ticks.ToString() -eq $existing.StartTicks) {
            if (-not $existing.Executable -and $running.Path -eq $Executable) {
                $existing.Executable = $Executable
                ConvertTo-Json -InputObject @($records) | Set-Content -LiteralPath $receiptPath
            }
            Write-Host "$Name is already running (PID $($existing.Id))."
            return
        }
    }
    if ($Port -and (Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue)) {
        throw "Port $Port is already occupied. Check that service before starting $Name."
    }
    $process = Start-Process -FilePath $Executable -ArgumentList $Arguments -WorkingDirectory $Directory -WindowStyle Hidden -RedirectStandardOutput (Join-Path $local "$Name.out.log") -RedirectStandardError (Join-Path $local "$Name.err.log") -PassThru
    $script:records = @($records | Where-Object { $_.Name -ne $Name }) + @([pscustomobject]@{
        Name = $Name; Id = $process.Id; StartTicks = $process.StartTime.ToUniversalTime().Ticks.ToString(); Executable = $Executable
    })
    ConvertTo-Json -InputObject @($script:records) | Set-Content -LiteralPath $receiptPath
    Write-Host "Started $Name (PID $($process.Id))."
}
$php = (Get-Command php.exe).Source
$node = (Get-Command node.exe).Source
$apiAddress = $null
Push-Location $frontend
try {
    $apiSetting = 'import { loadEnv } from "vite"; process.stdout.write(loadEnv("development", process.cwd(), "VITE_").VITE_API_BASE_URL || "http://localhost:8000/api/v1")' | & $node --input-type=module
    if ($LASTEXITCODE -ne 0) { throw 'Could not read the local frontend API address.' }
    $apiAddress = [uri]$apiSetting
} finally {
    Pop-Location
}
if (-not $apiAddress.IsAbsoluteUri -or $apiAddress.Scheme -ne 'http' -or -not $apiAddress.IsLoopback -or $apiAddress.AbsolutePath.TrimEnd('/') -ne '/api/v1' -or $apiAddress.UserInfo -or $apiAddress.Query -or $apiAddress.Fragment) {
    throw 'The local launcher requires a loopback HTTP VITE_API_BASE_URL ending in /api/v1.'
}
$apiPort = $apiAddress.Port
$router = Join-Path $backend 'vendor\laravel\framework\src\Illuminate\Foundation\resources\server.php'
Start-OwnedService 'api' $php @('-d', 'upload_max_filesize=128M', '-d', 'post_max_size=140M', '-d', 'memory_limit=512M', '-S', "127.0.0.1:$apiPort", ('"' + $router + '"')) (Join-Path $backend 'public') $apiPort
Start-OwnedService 'queue' $php @('-d', 'memory_limit=512M', ('"' + (Join-Path $backend 'artisan') + '"'), 'queue:work', '--sleep=1', '--tries=3', '--timeout=600') $backend
Start-OwnedService 'scheduler' $php @(('"' + (Join-Path $backend 'artisan') + '"'), 'schedule:work') $backend
Start-OwnedService 'frontend' $node @(('"' + (Join-Path $frontend 'node_modules\vite\bin\vite.js') + '"'), '--host', 'localhost', '--port', '5173', '--strictPort') $frontend 5173
if (-not $WithoutOcr) {
    $ocr = Join-Path $backend 'ocr-service'
    $python = Join-Path $ocr '.venv\Scripts\python.exe'
    if (-not (Test-Path $python)) { throw 'OCR virtual environment is missing. See SETUP.md.' }
    Start-OwnedService 'ocr' $python @('-m', 'uvicorn', 'main:app', '--host', '127.0.0.1', '--port', '8001') $ocr 8001
}
Write-Host "Frontend: http://localhost:5173 | API: $($apiAddress.GetLeftPart([System.UriPartial]::Authority))"
if ($WithoutOcr) {
    Write-Host 'OCR: native Ghostscript/Tesseract fallback'
} else {
    Write-Host 'OCR: http://localhost:8001/docs'
}
Write-Host 'Service logs and process receipts are in .local. MySQL must be running in Laragon.'
