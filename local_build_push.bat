@echo off
echo 🏗️ LOCAL BUILD + PUSH (Railway does nothing)
echo =============================================

:: Go to frontend directory
cd /d E:\Eternalgy_ERP_Rebuild4\frontend

echo Step 1: Building locally...
call npm run build
if %ERRORLEVEL% neq 0 (
    echo ❌ Build failed!
    pause
    exit /b 1
)

echo ✅ Local build complete!

:: Go back to root
cd ..

echo Step 2: Adding built files to git...
git add frontend/dist/

echo Step 3: Committing built frontend...
git commit -m "LOCAL BUILD: Frontend dist files - %date% %time%

Built locally to ensure Railway serves correct files.
Railway will just serve the pre-built files from git.

Frontend changes included:
- SYNC+ button (incremental sync)
- SCAN button (detect total records)
- Updated record count display [synced/total]

🤖 Generated with [Claude Code](https://claude.ai/code)"

echo Step 4: Pushing to Railway...
git push

echo.
echo ✅ COMPLETE!
echo ==========================================
echo Railway will just serve the pre-built files.
echo No frontend building needed on Railway side.
echo Hard refresh browser in 2-3 minutes: Ctrl+F5
pause