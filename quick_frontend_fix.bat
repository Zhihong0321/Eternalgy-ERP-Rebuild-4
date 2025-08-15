@echo off
echo 🔧 QUICK FRONTEND FIX - Railway Deployment
echo ==========================================

echo Running force-frontend script...
call npm run force-frontend

echo.
echo Committing and pushing...
git commit -m "FRONTEND: Quick fix - %date% %time%"
git push

echo.
echo ✅ Done! Wait 3-5 minutes for Railway deployment.
echo Then hard refresh browser (Ctrl+F5)
pause