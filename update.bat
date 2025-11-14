@echo off
chcp 65001 >nul
echo.
echo =======================================
echo  최신 코드 업데이트
echo =======================================
echo.

echo [1/2] 최신 변경사항 가져오기...
git fetch origin

echo [2/2] 현재 브랜치 업데이트...
git pull

echo.
echo =======================================
echo  업데이트 완료! ✅
echo =======================================
echo.
echo 3초 후 자동으로 종료됩니다...
timeout /t 3 /nobreak >nul
