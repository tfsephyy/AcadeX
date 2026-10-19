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
            Write-Host "$Name is already running (PID $($existing.Id))."
            return
        }
    }
    if ($Port -and (Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue)) {
        throw "Port $Port is already occupied. Check that service before starting $Name."
    }
    $process = Start-Process -FilePath $Executable -ArgumentList $Arguments -WorkingDirectory $Directory -WindowStyle Hidden -RedirectStandardOutput (Join-Path $local "$Name.out.log") -RedirectStandardError (Join-Path $local "$Name.err.log") -PassThru
    $script:records = @($records | Where-Object { $_.Name -ne $Name }) + @([pscustomobject]@{
        Name = $Name; Id = $process.Id; StartTicks = $process.StartTime.ToUniversalTime().Ticks.ToString(); Executable = $process.Path
    })
    ConvertTo-Json -InputObject @($script:records) | Set-Content -LiteralPath $receiptPath
    Write-Host "Started $Name (PID $($process.Id))."
}
$php = (Get-Command php.exe).Source
$node = (Get-Command node.exe).Source
$router = Join-Path $backend 'vendor\laravel\framework\src\Illuminate\Foundation\resources\server.php'
Start-OwnedService 'api' $php @('-S', '127.0.0.1:8000', ('"' + $router + '"')) (Join-Path $backend 'public') 8000
Start-OwnedService 'queue' $php @(('"' + (Join-Path $backend 'artisan') + '"'), 'queue:work', '--tries=1', '--timeout=120') $backend
Start-OwnedService 'frontend' $node @(('"' + (Join-Path $frontend 'node_modules\vite\bin\vite.js') + '"'), '--host', 'localhost', '--port', '5173', '--strictPort') $frontend 5173
if (-not $WithoutOcr) {
    $ocr = Join-Path $backend 'ocr-service'
    $python = Join-Path $ocr '.venv\Scripts\python.exe'
    if (-not (Test-Path $python)) { throw 'OCR virtual environment is missing. See SETUP.md.' }
    Start-OwnedService 'ocr' $python @('-m', 'uvicorn', 'main:app', '--host', '127.0.0.1', '--port', '8001') $ocr 8001
}
Write-Host 'Frontend: http://localhost:5173 | API: http://localhost:8000 | OCR: http://localhost:8001/docs'
Write-Host 'Service logs and process receipts are in .local. MySQL must be running in Laragon.'
