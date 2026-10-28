@echo off
echo ========================================================
echo       CLASSORA - PUSH TO GITHUB HELPER
echo ========================================================
echo.
where git >nul 2>nul
if %errorlevel% neq 0 (
    echo [!] Git is not detected in your command line PATH.
    echo.
    echo TO PUSH TO GITHUB:
    echo  Method 1: Extract/Upload the clean zip:
    echo            CLASSORA_READY_FOR_GITHUB.zip
    echo            Directly into your repository on github.com.
    echo.
    echo  Method 2: Use GitHub Desktop:
    echo            File -> Add Local Repository -> Choose READY_FOR_GITHUB.
    echo.
    echo  Method 3: Install Git for Windows from https://git-scm.com/
    echo.
    pause
    exit /b
)

echo [1/3] Preparing files in READY_FOR_GITHUB...
cd /d "%~dp0READY_FOR_GITHUB"
if not exist ".git" (
    git init
    git branch -M main
)
git add -A
git commit -m "Classora: Realtime sync, directory search by name, and mobile responsiveness"

echo.
set /p REPO_URL="Enter your GitHub Repository URL (e.g. https://github.com/username/repo.git) or press Enter to skip: "
if not "%REPO_URL%"=="" (
    git remote remove origin 2>nul
    git remote add origin %REPO_URL%
    echo Pushing to GitHub...
    git push -u origin main
)
echo Done!
pause
