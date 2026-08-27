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
start /b "" %RUNNER% server.ts

:: Il server richiede ?token=... alla prima apertura (Fase 2), altrimenti il
:: browser si aprirebbe su una pagina "Accesso non autorizzato". Aspetta che
:: il file del token esista prima di aprire il browser.
set TOKENFILE=.config\auth-token
set TRIES=0
:WAIT_TOKEN
if exist "%TOKENFILE%" goto OPEN_BROWSER
set /a TRIES+=1
if %TRIES% GEQ 30 goto OPEN_NOTOKEN
ping -n 1 -w 200 127.0.0.1 >nul
goto WAIT_TOKEN

:OPEN_BROWSER
set /p TOKEN=<%TOKENFILE%
start http://localhost:3001/?token=%TOKEN%
goto WAITEND

:OPEN_NOTOKEN
echo [ATTENZIONE] Token di accesso non trovato dopo 6s, apro senza - controlla la console per l'URL corretto.
start http://localhost:3001

:WAITEND
pause
