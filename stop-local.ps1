$ErrorActionPreference = 'Stop'
$receiptPath = Join-Path $PSScriptRoot '.local\processes.json'
if (-not (Test-Path $receiptPath)) { Write-Host 'No local process receipts found.'; return }
$remaining = @()
$records = Get-Content $receiptPath -Raw | ConvertFrom-Json
function Stop-OwnedChildren($ParentId, $ParentStart) {
    $children = @(Get-CimInstance Win32_Process -Filter "ParentProcessId=$ParentId" | Where-Object { $_.CreationDate -ge $ParentStart })
    foreach ($child in $children) {
        $running = Get-Process -Id $child.ProcessId -ErrorAction SilentlyContinue
        if ($running -and [math]::Abs(($running.StartTime - $child.CreationDate).TotalSeconds) -lt 1) {
            Stop-OwnedChildren $child.ProcessId $child.CreationDate
            Stop-Process -Id $child.ProcessId -ErrorAction SilentlyContinue
        }
    }
}
foreach ($record in $records) {
    $process = Get-Process -Id $record.Id -ErrorAction SilentlyContinue
    if (-not $process) { continue }
    if ($process.StartTime.ToUniversalTime().Ticks.ToString() -ne $record.StartTicks -or $process.Path -ne $record.Executable) {
        Write-Warning "Skipping $($record.Name): the PID now belongs to a different process."
        continue
    }
    try {
        Stop-OwnedChildren $record.Id $process.StartTime
        Stop-Process -Id $record.Id -ErrorAction Stop
        Write-Host "Stopped $($record.Name) (PID $($record.Id))."
    } catch {
        $remaining += $record
        Write-Warning $_
    }
}
ConvertTo-Json -InputObject @($remaining) | Set-Content -LiteralPath $receiptPath
