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
  echo Select Download for Windows, run OllamaSetup.exe with the normal choices,
  echo then run this setup once more. The standalone ZIP is not needed.
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
  echo Ollama will keep it in "%USERPROFILE%\.ollama\models", outside this project.
  "%LOCALAPPDATA%\Programs\Ollama\ollama.exe" pull qwen3-vl:8b-instruct
  if errorlevel 1 (
    echo.
    echo The model download did not finish. Check the internet connection and run setup again.
    pause
    exit /b 1
  )
)

"%LOCALAPPDATA%\Programs\Ollama\ollama.exe" list 2>nul | findstr /i /c:"qwen3-vl:30b-a3b-instruct" >nul
if errorlevel 1 (
  echo.
  echo Installing the enhanced Qwen3-VL 30B quality model.
  echo This optional one-time download is about 20 GB and improves dense drawing review.
  echo Peer Review will continue to use the 8B fast model if this download cannot finish.
  "%LOCALAPPDATA%\Programs\Ollama\ollama.exe" pull qwen3-vl:30b-a3b-instruct
  if errorlevel 1 (
    echo.
    echo The quality-model download did not finish. Fast Local AI is still available.
    echo Run setup again later to resume the quality-model download.
  )
)

echo.
echo Local AI setup is complete.
echo Fast model: qwen3-vl:8b-instruct.
echo Quality model: qwen3-vl:30b-a3b-instruct when installed.
echo Ollama keeps its models in "%USERPROFILE%\.ollama\models" by default.
echo It will start automatically whenever you sign in to Windows.
echo Close and reopen Chrome, allow Local network access for the N/S website if asked,
echo then select Try Reconnecting.
echo You can close this window.
pause
endlocal
