$ErrorActionPreference = 'Stop'
Set-Location (Split-Path -Parent $PSScriptRoot)
Write-Host 'TIVAsk - Setup lokal' -ForegroundColor Green
Write-Host 'PostgreSQL harus berjalan. Password adalah password akun PostgreSQL, bukan Windows.'
$setupDbHost = Read-Host 'Host PostgreSQL [127.0.0.1]'
if ([string]::IsNullOrWhiteSpace($setupDbHost)) { $setupDbHost = '127.0.0.1' }
$setupDbPort = Read-Host 'Port PostgreSQL [1234]'
if ([string]::IsNullOrWhiteSpace($setupDbPort)) { $setupDbPort = '1234' }
$setupDbUser = Read-Host 'Username PostgreSQL [postgres]'
if ([string]::IsNullOrWhiteSpace($setupDbUser)) { $setupDbUser = 'postgres' }
$setupDbName = Read-Host 'Nama database BARU [tivask]'
if ([string]::IsNullOrWhiteSpace($setupDbName)) { $setupDbName = 'tivask' }
$setupDbPassword = Read-Host 'Password PostgreSQL' -AsSecureString
$setupAdminPassword = Read-Host 'Buat password admin TIVAsk (minimal 10 karakter)' -AsSecureString
$setupApiKey = Read-Host 'Gemini API key (Enter untuk isi nanti)' -AsSecureString
$setupDbPtr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($setupDbPassword)
$setupAdminPtr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($setupAdminPassword)
$setupApiPtr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($setupApiKey)
try {
 $env:TIVASK_SETUP_DB_HOST = $setupDbHost
 $env:TIVASK_SETUP_DB_PORT = $setupDbPort
 $env:TIVASK_SETUP_DB_USER = $setupDbUser
 $env:TIVASK_SETUP_DB_NAME = $setupDbName
 $env:TIVASK_SETUP_DB_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($setupDbPtr)
 $env:TIVASK_SETUP_ADMIN_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($setupAdminPtr)
 $env:TIVASK_SETUP_GEMINI_KEY = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($setupApiPtr)
 $env:PUPPETEER_SKIP_DOWNLOAD = 'true'
 & npm.cmd install
 if ($LASTEXITCODE -ne 0) { throw 'Instalasi dependency gagal.' }
 & node scripts/setup.mjs
 if ($LASTEXITCODE -ne 0) { throw 'Setup gagal. Periksa pesan di atas.' }
 & npm.cmd run db:generate
 if ($LASTEXITCODE -ne 0) { throw 'Prisma generate gagal.' }
 & npm.cmd run db:migrate
 if ($LASTEXITCODE -ne 0) { throw 'Migration gagal. Jangan reset database lain.' }
 & npm.cmd run db:seed
 if ($LASTEXITCODE -ne 0) { throw 'Seed gagal.' }
 & npm.cmd run db:vector
 Write-Host 'Selesai. Jalankan npm.cmd run dev, buka http://localhost:3001, login admin.' -ForegroundColor Green
} finally {
 [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($setupDbPtr)
 [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($setupAdminPtr)
 [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($setupApiPtr)
 'TIVASK_SETUP_DB_HOST','TIVASK_SETUP_DB_PORT','TIVASK_SETUP_DB_USER','TIVASK_SETUP_DB_NAME','TIVASK_SETUP_DB_PASSWORD','TIVASK_SETUP_ADMIN_PASSWORD','TIVASK_SETUP_GEMINI_KEY','PUPPETEER_SKIP_DOWNLOAD' | ForEach-Object { Remove-Item -LiteralPath "Env:\$_" -ErrorAction SilentlyContinue }
}

