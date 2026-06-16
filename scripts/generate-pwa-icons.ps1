$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

# Dossier FOTOCE-FRONTEND (parent de scripts/)
$root = Split-Path $PSScriptRoot -Parent
$src = Join-Path $root 'src\assets\logo.png'
$pub = Join-Path $root 'public'

if (-not (Test-Path $src)) {
  throw "Logo introuvable: $src"
}
New-Item -ItemType Directory -Force -Path $pub | Out-Null

$bmp = [System.Drawing.Image]::FromFile($src)

function Export-Square {
  param(
    [System.Drawing.Image]$Source,
    [int]$Size,
    [string]$OutPath
  )
  $g = New-Object System.Drawing.Bitmap $Size, $Size
  $gr = [System.Drawing.Graphics]::FromImage($g)
  $gr.Clear([System.Drawing.Color]::FromArgb(255, 255, 245, 251))
  $scale = [Math]::Min($Size / $Source.Width, $Size / $Source.Height)
  $w = [int]([Math]::Round($Source.Width * $scale))
  $h = [int]([Math]::Round($Source.Height * $scale))
  $x = [int](($Size - $w) / 2)
  $y = [int](($Size - $h) / 2)
  $gr.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $gr.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $gr.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $gr.DrawImage($Source, $x, $y, $w, $h)
  $g.Save($OutPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $gr.Dispose()
  $g.Dispose()
}

@(
  @{ n = 'favicon-16x16.png'; s = 16 },
  @{ n = 'favicon-32x32.png'; s = 32 },
  @{ n = 'apple-touch-icon-120x120.png'; s = 120 },
  @{ n = 'apple-touch-icon-152x152.png'; s = 152 },
  @{ n = 'apple-touch-icon-167x167.png'; s = 167 },
  @{ n = 'apple-touch-icon.png'; s = 180 },
  @{ n = 'pwa-192x192.png'; s = 192 },
  @{ n = 'pwa-512x512.png'; s = 512 },
  @{ n = 'logo.png'; s = 512 }
) | ForEach-Object {
  Export-Square -Source $bmp -Size $_.s -OutPath (Join-Path $pub $_.n)
}

$bmp.Dispose()
Write-Host 'Icônes PWA générées dans public/'
