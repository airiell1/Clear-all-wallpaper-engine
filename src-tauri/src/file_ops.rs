use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use walkdir::WalkDir;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeleteResult {
    pub success: usize,
    pub failed: usize,
    pub failed_items: Vec<FailedItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FailedItem {
    pub path: String,
    pub error: String,
}

/// 파일/폴더 안전 삭제
pub fn delete_paths(paths: Vec<String>) -> Result<DeleteResult, String> {
    let mut success = 0;
    let mut failed = 0;
    let mut failed_items = Vec::new();

    // 깊이순 정렬 (자식부터 삭제)
    let mut sorted_paths = paths.clone();
    sorted_paths.sort_by(|a, b| {
        let depth_a = a.matches(std::path::MAIN_SEPARATOR).count();
        let depth_b = b.matches(std::path::MAIN_SEPARATOR).count();
        depth_b.cmp(&depth_a)
    });

    for path_str in sorted_paths {
        let path = Path::new(&path_str);

        if !path.exists() {
            failed += 1;
            failed_items.push(FailedItem {
                path: path_str.clone(),
                error: "경로가 존재하지 않습니다".to_string(),
            });
            continue;
        }

        let result = if path.is_file() {
            delete_file_safe(path)
        } else {
            delete_folder_safe(path)
        };

        match result {
            Ok(_) => success += 1,
            Err(e) => {
                failed += 1;
                failed_items.push(FailedItem {
                    path: path_str,
                    error: e,
                });
            }
        }
    }

    Ok(DeleteResult {
        success,
        failed,
        failed_items,
    })
}

/// 파일 안전 삭제
fn delete_file_safe(path: &Path) -> Result<(), String> {
    // Windows: 읽기 전용 속성 제거
    #[cfg(windows)]
    {
        if let Ok(metadata) = fs::metadata(path) {
            let mut permissions = metadata.permissions();
            permissions.set_readonly(false);
            let _ = fs::set_permissions(path, permissions);
        }
    }

    fs::remove_file(path).map_err(|e| format!("삭제 실패: {}", e))
}

/// 폴더 안전 삭제
fn delete_folder_safe(path: &Path) -> Result<(), String> {
    // Windows: 모든 하위 파일 읽기 전용 해제
    #[cfg(windows)]
    {
        use walkdir::WalkDir;

        for entry in WalkDir::new(path).follow_links(false) {
            if let Ok(entry) = entry {
                let entry_path = entry.path();
                if entry_path.is_file() {
                    if let Ok(metadata) = fs::metadata(entry_path) {
                        let mut permissions = metadata.permissions();
                        permissions.set_readonly(false);
                        let _ = fs::set_permissions(entry_path, permissions);
                    }
                }
            }
        }
    }

    fs::remove_dir_all(path).map_err(|e| format!("삭제 실패: {}", e))
}

/// 파일/폴더 크기 계산 (삭제 전 확인용)
pub fn get_total_size(paths: &[String]) -> u64 {
    use walkdir::WalkDir;

    paths
        .iter()
        .map(|p| {
            let path = Path::new(p);
            if path.is_file() {
                fs::metadata(path).map(|m| m.len()).unwrap_or(0)
            } else {
                WalkDir::new(path)
                    .follow_links(false)
                    .into_iter()
                    .filter_map(|e| e.ok())
                    .filter(|e| e.file_type().is_file())
                    .filter_map(|e| fs::metadata(e.path()).ok())
                    .map(|m| m.len())
                    .sum()
            }
        })
        .sum()
}

/// 휴지통으로 이동 (선택적)
/// Note: This feature requires the 'trash' crate. Currently disabled.
#[allow(dead_code)]
pub fn move_to_trash(_paths: Vec<String>) -> Result<DeleteResult, String> {
    Err("휴지통 기능은 현재 비활성화되어 있습니다".to_string())
}

/// 폴더 복사 (백업용)
pub fn copy_folder(source: &str, destination: &str) -> Result<(), String> {
    let src_path = Path::new(source);
    let dest_path = Path::new(destination);

    // 소스 폴더 존재 확인
    if !src_path.exists() {
        return Err("소스 폴더가 존재하지 않습니다".to_string());
    }

    if !src_path.is_dir() {
        return Err("소스가 폴더가 아닙니다".to_string());
    }

    // 대상 폴더 생성
    fs::create_dir_all(dest_path)
        .map_err(|e| format!("대상 폴더 생성 실패: {}", e))?;

    // 폴더 이름 추출
    let folder_name = src_path
        .file_name()
        .ok_or("폴더 이름을 가져올 수 없습니다")?
        .to_string_lossy();

    let target_folder = dest_path.join(folder_name.as_ref());

    // 타겟 폴더 생성
    fs::create_dir_all(&target_folder)
        .map_err(|e| format!("타겟 폴더 생성 실패: {}", e))?;

    // 모든 파일/폴더 복사
    for entry in WalkDir::new(src_path)
        .follow_links(false)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        let entry_path = entry.path();

        // 상대 경로 계산
        let relative_path = entry_path
            .strip_prefix(src_path)
            .map_err(|e| format!("경로 처리 실패: {}", e))?;

        let target_path = target_folder.join(relative_path);

        if entry_path.is_dir() {
            // 디렉토리 생성
            fs::create_dir_all(&target_path)
                .map_err(|e| format!("폴더 생성 실패 {}: {}", target_path.display(), e))?;
        } else {
            // 파일 복사
            if let Some(parent) = target_path.parent() {
                fs::create_dir_all(parent)
                    .map_err(|e| format!("부모 폴더 생성 실패: {}", e))?;
            }

            fs::copy(entry_path, &target_path)
                .map_err(|e| format!("파일 복사 실패 {}: {}", entry_path.display(), e))?;
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs::File;
    use std::io::Write;
    use tempfile::TempDir;

    #[test]
    fn test_delete_file() {
        let temp_dir = TempDir::new().unwrap();
        let file_path = temp_dir.path().join("test.txt");

        let mut file = File::create(&file_path).unwrap();
        file.write_all(b"test content").unwrap();
        drop(file);

        assert!(file_path.exists());

        let result = delete_paths(vec![file_path.to_string_lossy().to_string()]);
        assert!(result.is_ok());

        let delete_result = result.unwrap();
        assert_eq!(delete_result.success, 1);
        assert_eq!(delete_result.failed, 0);
        assert!(!file_path.exists());
    }

    #[test]
    fn test_delete_folder() {
        let temp_dir = TempDir::new().unwrap();
        let folder_path = temp_dir.path().join("test_folder");
        fs::create_dir(&folder_path).unwrap();

        let file_path = folder_path.join("file.txt");
        let mut file = File::create(&file_path).unwrap();
        file.write_all(b"test").unwrap();
        drop(file);

        assert!(folder_path.exists());

        let result = delete_paths(vec![folder_path.to_string_lossy().to_string()]);
        assert!(result.is_ok());

        let delete_result = result.unwrap();
        assert_eq!(delete_result.success, 1);
        assert!(!folder_path.exists());
    }
}
