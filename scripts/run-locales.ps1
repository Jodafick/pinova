param(
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$Args
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$venv = Join-Path $PSScriptRoot '.venv'
$py = Join-Path $venv 'Scripts\python.exe'

if (-not (Test-Path $py)) {
  python -m venv $venv
  & $py -m pip install -q -U pip
  & $py -m pip install -q -r ./scripts/requirements-locales.txt
}

$env:PYTHONUTF8 = '1'
& $py ./scripts/generate-locales.py @Args
