// Prevents additional console window on Windows in release builds
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod file_ops;
mod project;
mod scanner;
mod steam;

use file_ops::{copy_folder, delete_paths, get_total_size, DeleteResult};
use project::{read_project_json, ProjectInfo, WallpaperType};
use scanner::{find_empty_folders, scan_folder_parallel, FolderInfo};
use steam::{find_steam_path, get_workshop_url, SteamInfo};
use tauri::Manager;

/// 폴더 스캔 (병렬 처리)
#[tauri::command]
fn scan_folder(
    path: String,
    depth: usize,
    show_files: bool,
    min_size: u64,
) -> Result<Vec<FolderInfo>, String> {
    // 100개 이하는 단순 스캔, 그 이상은 병렬 스캔
    scan_folder_parallel(&path, depth, show_files, min_size)
}

/// 파일/폴더 삭제
#[tauri::command]
fn delete_items(paths: Vec<String>) -> Result<DeleteResult, String> {
    delete_paths(paths)
}

/// 삭제 전 전체 크기 계산
#[tauri::command]
fn calculate_total_size(paths: Vec<String>) -> u64 {
    get_total_size(&paths)
}

/// project.json 읽기
#[tauri::command]
fn get_project_info(folder_path: String) -> Result<ProjectInfo, String> {
    read_project_json(&folder_path)
}

/// Steam 경로 찾기
#[tauri::command]
fn find_steam() -> Result<SteamInfo, String> {
    find_steam_path()
}

/// Steam 워크샵 URL 생성
#[tauri::command]
fn get_steam_url(workshop_id: String) -> String {
    get_workshop_url(&workshop_id)
}

/// 파일 크기 포맷팅
#[tauri::command]
fn format_size(bytes: u64) -> String {
    const UNITS: &[&str] = &["B", "KB", "MB", "GB", "TB"];
    let mut size = bytes as f64;
    let mut unit_index = 0;

    while size >= 1024.0 && unit_index < UNITS.len() - 1 {
        size /= 1024.0;
        unit_index += 1;
    }

    if unit_index == 0 {
        format!("{} {}", bytes, UNITS[0])
    } else {
        format!("{:.2} {}", size, UNITS[unit_index])
    }
}

/// 타입별 아이콘 가져오기
#[tauri::command]
fn get_type_icon(wallpaper_type: String) -> String {
    WallpaperType::from_str(&wallpaper_type).icon().to_string()
}

/// 타입 한글 변환
#[tauri::command]
fn get_type_korean(wallpaper_type: String) -> String {
    WallpaperType::from_str(&wallpaper_type)
        .to_korean()
        .to_string()
}

/// 빈 폴더 찾기
#[tauri::command]
fn find_empty(path: String, depth: usize) -> Result<Vec<String>, String> {
    find_empty_folders(&path, depth)
}

/// 폴더 복사 (백업)
#[tauri::command]
fn copy_folder_cmd(source: String, destination: String) -> Result<(), String> {
    copy_folder(&source, &destination)
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            scan_folder,
            delete_items,
            calculate_total_size,
            get_project_info,
            find_steam,
            get_steam_url,
            format_size,
            get_type_icon,
            get_type_korean,
            find_empty,
            copy_folder_cmd,
        ])
        .setup(|app| {
            #[cfg(debug_assertions)]
            {
                let window = app.get_webview_window("main").unwrap();
                window.open_devtools();
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
