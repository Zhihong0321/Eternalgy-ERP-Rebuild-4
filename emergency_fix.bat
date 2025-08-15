@echo off
echo 🚨 EMERGENCY FRONTEND FIX
echo =========================

:: Just commit what we have and push
echo Adding all files...
git add .

echo Committing with timestamp...
git commit -m "EMERGENCY: Frontend fix - %date% %time%"

echo Pushing to Railway...
git push

echo.
echo ✅ PUSHED! Railway will deploy in 3-5 minutes.
echo The SYNC+ and SCAN buttons should appear after refresh.
pause