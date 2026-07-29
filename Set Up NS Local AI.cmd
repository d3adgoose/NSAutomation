@echo off
setlocal
cd /d "%~dp0"

set "NS_LAUNCHER=%~dp0Start NS Local AI Background.cmd"
set "NS_STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\NS Local AI.lnk"
set "NS_NODE=C:\Program Files\nodejs\node.exe"
if not exist "%NS_NODE%" where node.exe >nul 2>nul
if errorlevel 1 if not exist "%NS_NODE%" (
  echo Node.js is required for the protected Local AI connection.
  echo Install the current Node.js LTS release, then run this setup once more.
  start "" "https://nodejs.org/en/download"
  pause
  exit /b 1
)

if not exist "%LOCALAPPDATA%\Programs\Ollama\ollama.exe" (
  echo Ollama is required for Local AI.
  echo Install Ollama, then run this setup once more.
  start "" "https://ollama.com/download/windows"
  pause
  exit /b 1
)

powershell.exe -NoProfile -Command "$shell = New-Object -ComObject WScript.Shell; $shortcut = $shell.CreateShortcut('%NS_STARTUP%'); $shortcut.TargetPath = '%NS_LAUNCHER%'; $shortcut.WorkingDirectory = '%~dp0'; $shortcut.WindowStyle = 7; $shortcut.Description = 'Start N/S Automation Local AI'; $shortcut.Save()"
if errorlevel 1 (
  echo Windows could not enable automatic startup.
  pause
  exit /b 1
)

reg.exe add "HKCU\Software\Policies\Google\Chrome\LocalNetworkAccessAllowedForUrls" /v 1 /t REG_SZ /d "https://d3adgoose.github.io" /f >nul
if errorlevel 1 (
  echo.
  echo Chrome permission could not be set automatically on this computer.
  echo Setup will continue. Afterward, allow Local network access in Chrome Site settings.
)

start "" /min "%NS_LAUNCHER%"
timeout /t 3 /nobreak >nul

"%LOCALAPPDATA%\Programs\Ollama\ollama.exe" list 2>nul | findstr /i /c:"qwen3-vl:8b-instruct" >nul
if errorlevel 1 (
  echo.
  echo Installing the approved Qwen3-VL 8B model.
  echo This is a large one-time download and may take a while.
  "%LOCALAPPDATA%\Programs\Ollama\ollama.exe" pull qwen3-vl:8b-instruct
  if errorlevel 1 (
    echo.
    echo The model download did not finish. Check the internet connection and run setup again.
    pause
    exit /b 1
  )
)

echo.
echo Local AI setup is complete.
echo It will start automatically whenever you sign in to Windows.
echo Close and reopen Chrome, allow Local network access for the N/S website if asked,
echo then select Try Reconnecting.
echo You can close this window.
pause
endlocal
