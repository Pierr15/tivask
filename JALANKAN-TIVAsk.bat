@echo off
cd /d "%~dp0"
if not exist backend\.env (
 echo Jalankan scripts\setup-local.ps1 terlebih dahulu.
 pause
 exit /b 1
)
call npm.cmd run dev
pause

