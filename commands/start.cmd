@echo off
rem Clui CC — Windows launcher.
rem Launches the packaged unpacked app if present, otherwise runs from source.
setlocal
cd /d "%~dp0.."

set "EXE=release\win-unpacked\Clui CC.exe"
if exist "%EXE%" (
  start "" "%EXE%"
  goto :eof
)

echo Packaged app not found at "%EXE%".
echo Running from source instead ( npm run preview ).
echo If this fails, run commands\setup.ps1 first.
call npm run preview
endlocal
