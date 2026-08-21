$ErrorActionPreference = "Stop"

if (-not $env:ADMIN_PASSWORD) {
    $env:ADMIN_PASSWORD = Read-Host "Escribe la contraseña del panel"
}

if (-not $env:ADMIN_TOKEN_SECRET) {
    $env:ADMIN_TOKEN_SECRET = [guid]::NewGuid().ToString("N") + [guid]::NewGuid().ToString("N")
}

$env:PUBLIC_BASE_URL = "http://localhost:3000"

npm install
npm start
