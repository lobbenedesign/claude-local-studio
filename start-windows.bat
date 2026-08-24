@echo off
:: CUSTOM CLAUDE CODER - Windows PC Launcher
title CUSTOM CLAUDE CODER - Terminal Agent Studio
cd /d "%~dp0"

echo ======================================================
echo 🚀 CUSTOM CLAUDE CODER - Avvio su Windows PC...
echo ======================================================

:: Check if bun is installed, fallback to node
where bun >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    set RUNNER=bun
    goto START_APP
)

where node >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    set RUNNER=node
    goto START_APP
)

echo [ERRORE] Bun o Node.js non trovati nel sistema.
echo Scarica e installa Bun da: https://bun.sh o Node da https://nodejs.org
pause
exit /b 1

:START_APP
echo Avvio del server locale in corso con %RUNNER%...
start http://localhost:3001
%RUNNER% server.ts
pause
