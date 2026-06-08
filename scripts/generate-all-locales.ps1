# Génère toutes les locales WEB via googletrans (Python + venv local).
# Reprend automatiquement via scripts/.checkpoints/web/ si interrompu.
param(
  [switch]$Force
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$venv = Join-Path $PSScriptRoot '.venv'
$py = Join-Path $venv 'Scripts\python.exe'

if (-not (Test-Path $py)) {
  Write-Host "Création du venv Python…" -ForegroundColor DarkGray
  python -m venv $venv
}

Write-Host "Installation googletrans…" -ForegroundColor DarkGray
& $py -m pip install -q -U pip
& $py -m pip install -q -r ./scripts/requirements-locales.txt

$env:PYTHONUTF8 = '1'
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$logWeb = "./scripts/generate-locales-web-$stamp.log"

$args = @('./scripts/generate-locales.py')
if ($Force) { $args += '--force' }

Write-Host "`n=== Locales WEB uniquement ===" -ForegroundColor Cyan
& $py @args *>&1 | Out-File -Encoding utf8 $logWeb
Get-Content $logWeb -Tail 25

Write-Host "`n=== Terminé (web) ===" -ForegroundColor Green
Write-Host "Log: $logWeb"
