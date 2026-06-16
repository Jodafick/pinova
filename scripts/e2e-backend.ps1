$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..\..\fotoce-backend')

$env:CELERY_TASK_ALWAYS_EAGER = 'True'
$env:EMAIL_BACKEND = 'django.core.mail.backends.locmem.EmailBackend'
$env:DEFAULT_FROM_EMAIL = 'fotoce-e2e@localhost'
$env:API_PUBLIC_URL = 'http://127.0.0.1:8000'
$env:JWT_AUTH_HTTPONLY = '0'
$env:DEBUG = 'True'

python manage.py migrate --noinput
python manage.py seed_e2e_gdpr_users
python manage.py runserver 8000 --noreload
