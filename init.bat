@echo off
chcp 65001 >nul
echo =======================================
echo  Wallpaper Engine Cleaner 초기 설정
echo =======================================
echo.

:: Rust 설치 확인
where rustc >nul 2>&1
if %errorlevel% neq 0 (
    echo [1/3] Rust가 설치되지 않았습니다.
    echo.
    echo Rust를 설치하시겠습니까? (Y/N)
    set /p install_rust=
    if /i "%install_rust%"=="Y" (
        echo.
        echo 브라우저에서 https://rustup.rs/ 열기...
        start https://rustup.rs/
        echo.
        echo Rust 설치 후 이 창을 닫고 다시 실행해주세요.
        pause
        exit /b 0
    ) else (
        echo.
        echo Rust 없이는 빌드할 수 없습니다.
        pause
        exit /b 1
    )
) else (
    echo [1/3] Rust 설치됨
    rustc --version
    cargo --version
    echo.
)

:: Tauri CLI 설치
echo [2/3] Tauri CLI 설치 확인...
cargo tauri --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Tauri CLI 설치 중... (시간이 걸릴 수 있습니다)
    cargo install tauri-cli --version "^2.0.0" --locked
    if %errorlevel% neq 0 (
        echo.
        echo [오류] Tauri CLI 설치 실패
        pause
        exit /b 1
    )
    echo Tauri CLI 설치 완료!
) else (
    echo Tauri CLI 이미 설치됨
)
echo.

:: 의존성 확인
echo [3/3] 프로젝트 의존성 확인...
cd src-tauri
cargo check
if %errorlevel% neq 0 (
    echo.
    echo [오류] 의존성 확인 실패
    cd ..
    pause
    exit /b 1
)
cd ..

echo.
echo =======================================
echo  초기 설정 완료! ✅
echo =======================================
echo.
echo 이제 build.bat 또는 build.ps1을 실행하여 빌드할 수 있습니다.
echo.
echo 개발 모드로 실행하려면:
echo   cd src-tauri
echo   cargo tauri dev
echo.
pause
