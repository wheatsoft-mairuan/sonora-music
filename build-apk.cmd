@echo off
rem Sonora SONORA - build Android debug APK (double-click friendly)
rem Wraps build-apk.ps1 with -ExecutionPolicy Bypass so no system policy change is needed.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0build-apk.ps1"
if errorlevel 1 (
  echo.
  echo Build FAILED. See messages above.
) else (
  echo.
  echo Build finished. APK: android\app\build\outputs\apk\debug\app-debug.apk
)
if "%~1"=="" pause
