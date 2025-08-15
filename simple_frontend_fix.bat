@echo off
echo 🔧 SIMPLE FRONTEND FIX
echo =====================

:: Kill any processes that might be locking files
taskkill /f /im node.exe 2>nul
taskkill /f /im npm.exe 2>nul

:: Wait a moment
timeout /t 2 /nobreak >nul

echo Step 1: Going to frontend folder...
cd /d E:\Eternalgy_ERP_Rebuild4\frontend

echo Step 2: Building frontend (skip clean to avoid permission errors)...
call npm run build
if %ERRORLEVEL% neq 0 (
    echo ❌ Build failed, trying again...
    timeout /t 3 /nobreak >nul
    call npm run build
)

echo Step 3: Going back to root...
cd ..

echo Step 4: Adding files to git...
git add .

echo Step 5: Committing...
git commit -m "Frontend rebuild - %date% %time%"

echo Step 6: Pushing to Railway...
git push

echo.
echo ✅ DONE! Frontend should update in 3-5 minutes.
echo Hard refresh browser: Ctrl+F5
pause