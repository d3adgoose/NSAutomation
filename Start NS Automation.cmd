@echo off
setlocal
cd /d "%~dp0"

call "%~dp0Start NS Local AI Background.cmd"

set "NS_NODE=C:\Program Files\nodejs\node.exe"
if not exist "%NS_NODE%" set "NS_NODE=C:\Users\KayleeMorales\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"

if not exist "%NS_NODE%" (
  echo The local website runtime is missing. Contact the automation administrator.
  pause
  exit /b 1
)

timeout /t 2 /nobreak >nul
start "" "http://127.0.0.1:5500/specification.html"
endlocal
