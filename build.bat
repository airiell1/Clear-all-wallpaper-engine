@echo off
chcp 65001 >nul
echo =======================================
echo  Wallpaper Engine Cleaner 빌드 스크립트
echo =======================================
echo.

:: Rust 설치 확인
where rustc >nul 2>&1
if %errorlevel% neq 0 (
    echo [오류] Rust가 설치되지 않았습니다.
    echo.
    echo Rust 설치: https://rustup.rs/
    pause
    exit /b 1
)

echo [1/4] Rust 버전 확인...
rustc --version
cargo --version
echo.

:: Tauri CLI 설치 확인
echo [2/4] Tauri CLI 확인...
cargo tauri --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Tauri CLI가 없습니다. 설치 중...
    cargo install tauri-cli --version "^2.0.0" --locked
    if %errorlevel% neq 0 (
        echo [오류] Tauri CLI 설치 실패
        pause
        exit /b 1
    )
)
echo Tauri CLI 준비 완료
echo.

:: 빌드
echo [3/4] Release 빌드 시작...
cd src-tauri
cargo tauri build
cd ..

if %errorlevel% neq 0 (
    echo.
    echo [오류] 빌드 실패!
    pause
    exit /b 1
)

echo.
echo [4/4] 빌드 완료!
echo.
echo 실행 파일 위치:
echo  - src-tauri\target\release\wallpaper-cleaner.exe
echo  - src-tauri\target\release\bundle\nsis\
echo.

:: 실행 파일 복사
if exist "src-tauri\target\release\wallpaper-cleaner.exe" (
    echo 실행 파일을 현재 디렉토리로 복사...
    copy "src-tauri\target\release\wallpaper-cleaner.exe" "wallpaper-cleaner.exe" >nul
    echo 복사 완료: wallpaper-cleaner.exe
    echo.
)

echo =======================================
echo  빌드 성공! 🎉
echo =======================================
echo.
echo 3초 후 자동으로 종료됩니다...
timeout /t 3 /nobreak >nul
