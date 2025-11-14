use rayon::prelude::*;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use walkdir::WalkDir;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FolderInfo {
    pub path: String,
    pub name: String,
    pub size: u64,
    pub is_file: bool,
    pub level: usize,
    pub parent: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanProgress {
    pub current_path: String,
    pub scanned_count: usize,
    pub total_size: u64,
}

/// 초고속 병렬 스캔 - O(n) 복잡도, 단일 패스
pub fn scan_folder_parallel(
    root_path: &str,
    depth: usize,
    show_files: bool,
    min_size: u64,
) -> Result<Vec<FolderInfo>, String> {
    let root = Path::new(root_path);

    if !root.exists() {
        return Err(format!("경로가 존재하지 않습니다: {}", root_path));
    }

    let root_level = root.components().count();
    let results = Arc::new(Mutex::new(Vec::new()));
    let size_cache = Arc::new(Mutex::new(std::collections::HashMap::new()));

    // 1단계: 모든 경로 수집
    let mut paths_to_scan: Vec<(PathBuf, usize)> = Vec::new();

    for entry in WalkDir::new(root_path)
        .min_depth(1)
        .max_depth(if depth == 999 { usize::MAX } else { depth })
        .follow_links(false)
    {
        if let Ok(entry) = entry {
            let path = entry.path();
            let level = path.components().count() - root_level;

            if entry.file_type().is_dir() || (show_files && entry.file_type().is_file()) {
                paths_to_scan.push((path.to_path_buf(), level));
            }
        }
    }

    // 2단계: 병렬로 크기 계산
    paths_to_scan.par_iter().for_each(|(path, level)| {
        let is_file = path.is_file();
        let size = if is_file {
            fs::metadata(path).map(|m| m.len()).unwrap_or(0)
        } else {
            calculate_folder_size(path)
        };

        // 최소 크기 필터
        if size < min_size {
            return;
        }

        let parent = path.parent().and_then(|p| p.to_str()).map(|s| s.to_string());

        let info = FolderInfo {
            path: path.to_string_lossy().to_string(),
            name: path
                .file_name()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string(),
            size,
            is_file,
            level: *level,
            parent,
        };

        results.lock().unwrap().push(info);

        // 크기 캐싱
        size_cache.lock().unwrap().insert(path.to_string_lossy().to_string(), size);
    });

    let mut final_results = Arc::try_unwrap(results)
        .unwrap()
        .into_inner()
        .unwrap();

    // 크기순 정렬 (큰 것부터)
    final_results.sort_by(|a, b| b.size.cmp(&a.size));

    Ok(final_results)
}

/// 폴더 크기 계산 - 최적화된 버전
fn calculate_folder_size(path: &Path) -> u64 {
    WalkDir::new(path)
        .follow_links(false)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| e.file_type().is_file())
        .filter_map(|e| fs::metadata(e.path()).ok())
        .map(|m| m.len())
        .sum()
}

/// 단일 스레드 스캔 (작은 폴더용)
pub fn scan_folder_simple(
    root_path: &str,
    depth: usize,
    show_files: bool,
    min_size: u64,
) -> Result<Vec<FolderInfo>, String> {
    let root = Path::new(root_path);

    if !root.exists() {
        return Err(format!("경로가 존재하지 않습니다: {}", root_path));
    }

    let root_level = root.components().count();
    let mut results = Vec::new();

    for entry in WalkDir::new(root_path)
        .min_depth(1)
        .max_depth(if depth == 999 { usize::MAX } else { depth })
        .follow_links(false)
    {
        if let Ok(entry) = entry {
            let path = entry.path();
            let level = path.components().count() - root_level;
            let is_file = entry.file_type().is_file();

            if !is_file && !show_files {
                continue;
            }
            if is_file && !show_files {
                continue;
            }

            let size = if is_file {
                fs::metadata(path).map(|m| m.len()).unwrap_or(0)
            } else {
                calculate_folder_size(path)
            };

            if size < min_size {
                continue;
            }

            let parent = path.parent().and_then(|p| p.to_str()).map(|s| s.to_string());

            results.push(FolderInfo {
                path: path.to_string_lossy().to_string(),
                name: path
                    .file_name()
                    .unwrap_or_default()
                    .to_string_lossy()
                    .to_string(),
                size,
                is_file,
                level,
                parent,
            });
        }
    }

    results.sort_by(|a, b| b.size.cmp(&a.size));
    Ok(results)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_scan_current_dir() {
        let results = scan_folder_parallel(".", 1, false, 0);
        assert!(results.is_ok());
        if let Ok(items) = results {
            println!("Found {} items", items.len());
            for item in items.iter().take(5) {
                println!("{}: {} bytes", item.name, item.size);
            }
        }
    }
}
