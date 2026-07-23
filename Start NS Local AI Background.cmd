@echo off
setlocal
cd /d "%~dp0"

set "NS_OLLAMA=%LOCALAPPDATA%\Programs\Ollama\ollama.exe"
set "NS_NODE=C:\Program Files\nodejs\node.exe"
if not exist "%NS_NODE%" set "NS_NODE=C:\Users\KayleeMorales\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"

powershell.exe -NoProfile -WindowStyle Hidden -Command "$ollama = Get-NetTCPConnection -LocalPort 11434 -State Listen -ErrorAction SilentlyContinue; if (-not $ollama -and (Test-Path '%NS_OLLAMA%')) { Start-Process -FilePath '%NS_OLLAMA%' -ArgumentList 'serve' -WindowStyle Hidden }; $gateway = Get-NetTCPConnection -LocalAddress 127.0.0.1 -LocalPort 4173 -State Listen -ErrorAction SilentlyContinue; if (-not $gateway -and (Test-Path '%NS_NODE%')) { Start-Process -FilePath '%NS_NODE%' -ArgumentList 'local-ai-server.js' -WorkingDirectory '%~dp0' -WindowStyle Hidden }"

endlocal
