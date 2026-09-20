@echo off
REM Handwritten Digit Recognition - Install Requirements
REM Double-click this file once (first time only) to install the
REM Python libraries this program needs.
REM Requires Python to already be installed (python.org) with
REM "Add to PATH" checked.

cd /d "%~dp0"

where python >nul 2>nul
if errorlevel 1 (
    echo Python was not found on this computer.
    echo Please install it from https://www.python.org/downloads/
    echo and make sure to check "Add Python to PATH" during setup.
    pause
    exit /b 1
)

echo Installing required Python libraries...
pip install -r requirements.txt

echo Done! You can now run run_digit_recognition.bat
pause
