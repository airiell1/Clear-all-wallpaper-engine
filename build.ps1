# PowerShell 빌드 스크립트
$ErrorActionPreference = "Stop"

Write-Host "=======================================" -ForegroundColor Cyan
Write-Host " Wallpaper Engine Cleaner 빌드 스크립트" -ForegroundColor Cyan
Write-Host "=======================================" -ForegroundColor Cyan
Write-Host ""

# Rust 설치 확인
Write-Host "[1/4] Rust 버전 확인..." -ForegroundColor Yellow
try {
    $rustVersion = rustc --version
    $cargoVersion = cargo --version
    Write-Host $rustVersion -ForegroundColor Green
    Write-Host $cargoVersion -ForegroundColor Green
} catch {
    Write-Host "[오류] Rust가 설치되지 않았습니다." -ForegroundColor Red
    Write-Host ""
    Write-Host "Rust 설치: https://rustup.rs/" -ForegroundColor Yellow
    Read-Host "계속하려면 Enter를 누르세요"
    exit 1
}
Write-Host ""

# Tauri CLI 확인
Write-Host "[2/4] Tauri CLI 확인..." -ForegroundColor Yellow
try {
    cargo tauri --version | Out-Null
    Write-Host "Tauri CLI 준비 완료" -ForegroundColor Green
} catch {
    Write-Host "Tauri CLI가 없습니다. 설치 중..." -ForegroundColor Yellow
    cargo install tauri-cli --version "^2.0.0" --locked
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[오류] Tauri CLI 설치 실패" -ForegroundColor Red
        Read-Host "계속하려면 Enter를 누르세요"
        exit 1
    }
}
Write-Host ""

# 빌드
Write-Host "[3/4] Release 빌드 시작..." -ForegroundColor Yellow
Set-Location src-tauri
cargo tauri build
$buildResult = $LASTEXITCODE
Set-Location ..

if ($buildResult -ne 0) {
    Write-Host ""
    Write-Host "[오류] 빌드 실패!" -ForegroundColor Red
    Read-Host "계속하려면 Enter를 누르세요"
    exit 1
}

Write-Host ""
Write-Host "[4/4] 빌드 완료!" -ForegroundColor Green
Write-Host ""
Write-Host "실행 파일 위치:" -ForegroundColor Cyan
Write-Host " - src-tauri\target\release\wallpaper-cleaner.exe" -ForegroundColor White
Write-Host " - src-tauri\target\release\bundle\nsis\" -ForegroundColor White
Write-Host ""

# 실행 파일 복사
if (Test-Path "src-tauri\target\release\wallpaper-cleaner.exe") {
    Write-Host "실행 파일을 현재 디렉토리로 복사..." -ForegroundColor Yellow
    Copy-Item "src-tauri\target\release\wallpaper-cleaner.exe" "wallpaper-cleaner.exe" -Force
    Write-Host "복사 완료: wallpaper-cleaner.exe" -ForegroundColor Green
    Write-Host ""
}

Write-Host "=======================================" -ForegroundColor Cyan
Write-Host " 빌드 성공! 🎉" -ForegroundColor Green
Write-Host "=======================================" -ForegroundColor Cyan
Write-Host ""
Read-Host "계속하려면 Enter를 누르세요"
