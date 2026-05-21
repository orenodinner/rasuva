@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "ROOT=%~dp0"
set "DRY_RUN="
set "SKIP_INSTALL="
set "NO_PAUSE="

for %%A in (%*) do (
  if /I "%%~A"=="--dry-run" set "DRY_RUN=1"
  if /I "%%~A"=="--skip-install" set "SKIP_INSTALL=1"
  if /I "%%~A"=="--no-pause" set "NO_PAUSE=1"
)

cd /d "%ROOT%" || goto :fail_cd

echo Rasuva updater
echo Repository: %CD%
echo.

where git >nul 2>nul || goto :fail_git
where npm >nul 2>nul || goto :fail_npm

if not exist ".git" goto :fail_not_repo
if not exist "package.json" goto :fail_not_repo

set "DIRTY="
for /f "usebackq delims=" %%S in (`git status --porcelain`) do (
  set "STATUS_LINE=%%S"
  if /I not "!STATUS_LINE!"=="?? update-and-install.bat" (
    set "DIRTY=1"
    echo Local change found: !STATUS_LINE!
  )
)
if defined DIRTY goto :fail_dirty

for /f "usebackq delims=" %%B in (`git rev-parse --abbrev-ref HEAD`) do set "BRANCH=%%B"
if not defined BRANCH goto :fail_branch
if /I "%BRANCH%"=="HEAD" goto :fail_branch

call :run git fetch --prune origin || goto :fail_step
call :run git pull --ff-only origin "%BRANCH%" || goto :fail_step

if exist "package-lock.json" (
  call :run npm ci || goto :fail_step
) else (
  call :run npm install || goto :fail_step
)

call :run npm run build || goto :fail_step
call :run npm run package || goto :fail_step

if defined DRY_RUN (
  echo.
  echo Dry run completed. No files were changed and no installer was launched.
  goto :success
)

set "INSTALLER="
for /f "usebackq delims=" %%I in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "$roots = @('.\dist', '.\release') | Where-Object { Test-Path -LiteralPath $_ }; $item = $roots | ForEach-Object { Get-ChildItem -LiteralPath $_ -Filter 'Rasuva Setup*.exe' -File } | Sort-Object LastWriteTime -Descending | Select-Object -First 1; if ($item) { $item.FullName }"`) do set "INSTALLER=%%I"

if not defined INSTALLER goto :fail_installer
if not exist "%INSTALLER%" goto :fail_installer

if defined SKIP_INSTALL (
  echo.
  echo Installer created:
  echo %INSTALLER%
  echo Installation was skipped because --skip-install was specified.
  goto :success
)

tasklist /FI "IMAGENAME eq Rasuva.exe" 2>nul | find /I "Rasuva.exe" >nul
if not errorlevel 1 (
  echo.
  echo Rasuva is running. Close Rasuva, then press any key to continue installation.
  if not defined NO_PAUSE pause >nul
)

echo.
echo Installing:
echo %INSTALLER%
start /wait "" "%INSTALLER%" /S
if errorlevel 1 goto :fail_install

echo.
echo Rasuva update completed.
goto :success

:run
echo.
echo ^> %*
if defined DRY_RUN (
  echo [dry-run] skipped
  exit /b 0
)
call %*
exit /b %ERRORLEVEL%

:fail_cd
echo Failed to open the script directory.
goto :error

:fail_git
echo git was not found in PATH.
goto :error

:fail_npm
echo npm was not found in PATH.
goto :error

:fail_not_repo
echo This script must be run from the Rasuva repository root.
goto :error

:fail_dirty
echo.
echo Working tree has local changes. Commit, stash, or discard them before updating.
goto :error

:fail_branch
echo Could not detect a normal git branch.
goto :error

:fail_step
echo.
echo Update/build/package step failed.
goto :error

:fail_installer
echo.
echo Could not find the generated Rasuva installer under release.
goto :error

:fail_install
echo.
echo Installer returned an error.
goto :error

:success
echo.
echo Done.
if not defined NO_PAUSE pause
exit /b 0

:error
echo.
echo Failed.
if not defined NO_PAUSE pause
exit /b 1
