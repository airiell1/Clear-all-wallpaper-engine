@echo off
chcp 65001 >nul
echo.
echo =======================================
echo  Wallpaper Engine Cleaner 개발 모드
echo =======================================
echo.

cd src-tauri
echo [*] 개발 모드 실행 중... (DevTools 자동 활성화)
echo [*] F12 또는 우클릭 메뉴에서 "Inspect Element" 선택
echo.

cargo tauri dev

pause
