@echo off
echo ========================================
echo Test Documentation Extension - Setup
echo ========================================
echo.
echo Installing dependencies...
echo.

call npm install

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Failed to install dependencies.
    echo Please check your npm installation and internet connection.
    echo.
    pause
    exit /b 1
)

echo.
echo ========================================
echo Installation Complete!
echo ========================================
echo.
echo Dependencies installed:
echo - screenshot-desktop (for screen capture)
echo - active-win (for window detection)
echo.
echo Next steps:
echo 1. Press F5 in VS Code to test the extension
echo 2. Look for "Test Documentation" in the sidebar
echo 3. Create a test project and start documenting!
echo.
echo For more info, see INSTALLATION.md
echo ========================================
echo.
pause
