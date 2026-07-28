@echo off
setlocal

set "SYSTEM_NPM=%ProgramFiles%\nodejs\npm.cmd"
if not exist "%SYSTEM_NPM%" (
  echo [Doge Hunt] System npm.cmd was not found at "%SYSTEM_NPM%".
  exit /b 1
)

call "%SYSTEM_NPM%" %*
