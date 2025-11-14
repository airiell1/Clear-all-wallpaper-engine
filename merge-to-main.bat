@echo off
chcp 65001 >nul
echo.
echo =======================================
echo  현재 브랜치를 main에 병합
echo =======================================
echo.

echo [1/5] 최신 코드 가져오기...
git fetch origin

echo [2/5] main 브랜치로 전환...
git checkout main

echo [3/5] main 최신화...
git pull origin main

echo [4/5] 현재 브랜치 병합...
git merge claude/fix-tauri-build-icon-01TYw2nL7HzWEoGB7dK1Mt8g --no-ff -m "Merge: Fix Tauri build and UI initialization issues"

echo [5/5] main 푸시...
git push origin main

echo.
echo =======================================
echo  병합 완료! main 브랜치로 전환됨 ✅
echo =======================================
echo.
pause
