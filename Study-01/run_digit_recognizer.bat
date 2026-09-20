@echo off
REM Handwritten Digit Recognition - Windows Launcher
REM Double-click this file to set up and start the drawing app.
REM Requires Python to already be installed (python.org) with "Add to PATH" checked.

cd /d "%~dp0"

where python >nul 2>nul
if errorlevel 1 (
    echo Python was not found on this computer.
    echo Please install it from https://www.python.org/downloads/
    echo and make sure to check "Add Python to PATH" during setup.
    pause
    exit /b 1
)

echo Installing required Python libraries (first run may take a minute)...
pip install -r requirements.txt

echo Starting the handwritten digit recognizer...
echo Your web browser will open automatically. Close this window to stop the app.
python draw_and_predict.py

pause
