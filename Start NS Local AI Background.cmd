@echo off
setlocal
cd /d "%~dp0"

set "NS_OLLAMA=%LOCALAPPDATA%\Programs\Ollama\ollama.exe"
set "NS_NODE=C:\Program Files\nodejs\node.exe"
if not exist "%NS_NODE%" for /f "delims=" %%N in ('where node.exe 2^>nul') do if not defined NS_NODE_FOUND set "NS_NODE_FOUND=%%N"
if not exist "%NS_NODE%" set "NS_NODE=%NS_NODE_FOUND%"

powershell.exe -NoProfile -WindowStyle Hidden -Command "$ollama = Get-NetTCPConnection -LocalPort 11434 -State Listen -ErrorAction SilentlyContinue; if (-not $ollama -and (Test-Path '%NS_OLLAMA%')) { Start-Process -FilePath '%NS_OLLAMA%' -ArgumentList 'serve' -WindowStyle Hidden }; $gateway = Get-NetTCPConnection -LocalPort 4173 -State Listen -ErrorAction SilentlyContinue; if (-not $gateway -and (Test-Path '%NS_NODE%')) { Start-Process -FilePath '%NS_NODE%' -ArgumentList 'local-ai-server.js' -WorkingDirectory '%~dp0' -WindowStyle Hidden }"

endlocal
