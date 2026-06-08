# Génère toutes les locales WEB via googletrans (Python + venv local).
# Progression temps réel via tqdm dans le terminal.
param(
  [switch]$Force
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$venv = Join-Path $PSScriptRoot '.venv'
$py = Join-Path $venv 'Scripts\python.exe'

if (-not (Test-Path $py)) {
  Write-Host "Creation du venv Python..." -ForegroundColor DarkGray
  python -m venv $venv
}

Write-Host "Installation dependances..." -ForegroundColor DarkGray
& $py -m pip install -q -U pip
& $py -m pip install -q -r ./scripts/requirements-locales.txt

$env:PYTHONUTF8 = '1'
$env:PYTHONUNBUFFERED = '1'

# PowerShell traite stderr des commandes natives comme des erreurs fatales avec Stop.
if (Get-Variable -Name PSNativeCommandUseErrorActionPreference -ErrorAction SilentlyContinue) {
  $PSNativeCommandUseErrorActionPreference = $false
}

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$logWeb = "./scripts/generate-locales-web-$stamp.log"

$pyArgs = @('-u', './scripts/generate-locales.py')
if ($Force) { $pyArgs += '--force' }

Write-Host "`n=== Locales WEB (tqdm) ===" -ForegroundColor Cyan
Write-Host "Log: $logWeb`n" -ForegroundColor DarkGray

$prevEap = $ErrorActionPreference
$ErrorActionPreference = 'Continue'
try {
  & $py @pyArgs 2>&1 | Tee-Object -FilePath $logWeb
  $exitCode = $LASTEXITCODE
} finally {
  $ErrorActionPreference = $prevEap
}

if ($exitCode -ne 0) {
  Write-Host "`nEchec (code $exitCode). Voir $logWeb" -ForegroundColor Red
  exit $exitCode
}

Write-Host "`n=== Termine (web) ===" -ForegroundColor Green
