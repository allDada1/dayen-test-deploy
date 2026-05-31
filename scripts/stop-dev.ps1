param(
  [int[]]$Ports = @(3000, 5173, 5174)
)

$ErrorActionPreference = "Stop"
$stopped = New-Object System.Collections.Generic.HashSet[int]

foreach ($port in $Ports) {
  $processIds = @()

  $connections = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
  if ($connections) {
    $processIds += $connections | Select-Object -ExpandProperty OwningProcess
  }

  if (-not $processIds.Count) {
    $netstatLines = netstat -ano | Select-String ":$port\s+.*LISTENING\s+\d+"
    foreach ($line in $netstatLines) {
      $parts = ($line.Line -replace "^\s+", "") -split "\s+"
      $processIds += [int]$parts[-1]
    }
  }

  foreach ($processId in ($processIds | Sort-Object -Unique)) {
    if ($processId -le 0 -or $stopped.Contains($processId)) {
      continue
    }

    $processInfo = Get-Process -Id $processId -ErrorAction SilentlyContinue
    $processName = [string]$processInfo.ProcessName

    if ($processName -notmatch "node") {
      Write-Host "Skip port ${port}: process $processId ($processName) does not look like Dayen dev server."
      continue
    }

    Write-Host "Stopping Dayen dev process $processId on port $port..."
    Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
    [void]$stopped.Add($processId)
  }
}

if ($stopped.Count -eq 0) {
  Write-Host "No Dayen dev processes found on ports $($Ports -join ', ')."
} else {
  Write-Host "Stopped $($stopped.Count) Dayen dev process(es)."
}
