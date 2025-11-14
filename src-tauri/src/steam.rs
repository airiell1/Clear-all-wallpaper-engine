use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SteamInfo {
    pub install_path: String,
    pub workshop_path: String,
    pub found: bool,
}

/// Steam 설치 경로 자동 감지
pub fn find_steam_path() -> Result<SteamInfo, String> {
    #[cfg(windows)]
    {
        find_steam_path_windows()
    }

    #[cfg(not(windows))]
    {
        find_steam_path_fallback()
    }
}

#[cfg(windows)]
fn find_steam_path_windows() -> Result<SteamInfo, String> {
    use winreg::enums::*;
    use winreg::RegKey;

    // 1. Windows Registry에서 찾기
    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);

    let steam_paths = vec![
        r"SOFTWARE\WOW6432Node\Valve\Steam",
        r"SOFTWARE\Valve\Steam",
    ];

    for path in steam_paths {
        if let Ok(steam_key) = hklm.open_subkey(path) {
            if let Ok(install_path) = steam_key.get_value::<String, _>("InstallPath") {
                let workshop_path = PathBuf::from(&install_path)
                    .join("steamapps")
                    .join("workshop")
                    .join("content")
                    .join("431960"); // Wallpaper Engine App ID

                if workshop_path.exists() {
                    return Ok(SteamInfo {
                        install_path,
                        workshop_path: workshop_path.to_string_lossy().to_string(),
                        found: true,
                    });
                }
            }
        }
    }

    // 2. 일반적인 경로에서 찾기
    find_steam_path_fallback()
}

fn find_steam_path_fallback() -> Result<SteamInfo, String> {
    let default_paths = vec![
        r"C:\Program Files (x86)\Steam",
        r"C:\Program Files\Steam",
        r"D:\Steam",
        r"E:\Steam",
        r"F:\SteamLibrary",
        r"G:\SteamLibrary",
    ];

    for base_path in default_paths {
        let workshop_path = PathBuf::from(base_path)
            .join("steamapps")
            .join("workshop")
            .join("content")
            .join("431960");

        if workshop_path.exists() {
            return Ok(SteamInfo {
                install_path: base_path.to_string(),
                workshop_path: workshop_path.to_string_lossy().to_string(),
                found: true,
            });
        }
    }

    Err("Steam Wallpaper Engine 워크샵 경로를 찾을 수 없습니다.".to_string())
}

/// 특정 워크샵 아이템 Steam 페이지 URL 생성
pub fn get_workshop_url(workshop_id: &str) -> String {
    format!(
        "https://steamcommunity.com/sharedfiles/filedetails/?id={}",
        workshop_id
    )
}

/// 추가 Steam 라이브러리 경로 찾기
#[cfg(windows)]
#[allow(dead_code)]
pub fn find_additional_libraries() -> Vec<String> {
    use std::fs;
    use winreg::enums::*;
    use winreg::RegKey;

    let mut libraries = Vec::new();

    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
    if let Ok(steam_key) = hklm.open_subkey(r"SOFTWARE\WOW6432Node\Valve\Steam") {
        if let Ok(install_path) = steam_key.get_value::<String, _>("InstallPath") {
            // libraryfolders.vdf 파일 읽기
            let vdf_path = PathBuf::from(&install_path)
                .join("steamapps")
                .join("libraryfolders.vdf");

            if let Ok(content) = fs::read_to_string(vdf_path) {
                // 간단한 VDF 파싱 (정규식 대신)
                for line in content.lines() {
                    if line.contains("\"path\"") {
                        if let Some(path) = extract_quoted_value(line) {
                            let workshop_path = PathBuf::from(&path)
                                .join("steamapps")
                                .join("workshop")
                                .join("content")
                                .join("431960");

                            if workshop_path.exists() {
                                libraries.push(workshop_path.to_string_lossy().to_string());
                            }
                        }
                    }
                }
            }
        }
    }

    libraries
}

#[cfg(not(windows))]
pub fn find_additional_libraries() -> Vec<String> {
    Vec::new()
}

/// VDF 파일에서 따옴표로 둘러싸인 값 추출
#[allow(dead_code)]
fn extract_quoted_value(line: &str) -> Option<String> {
    let parts: Vec<&str> = line.split('\"').collect();
    if parts.len() >= 4 {
        Some(parts[3].to_string())
    } else {
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_find_steam() {
        match find_steam_path() {
            Ok(info) => {
                println!("✅ Steam found!");
                println!("Install: {}", info.install_path);
                println!("Workshop: {}", info.workshop_path);
            }
            Err(e) => {
                println!("❌ Steam not found: {}", e);
            }
        }
    }

    #[test]
    fn test_workshop_url() {
        let url = get_workshop_url("123456789");
        assert_eq!(
            url,
            "https://steamcommunity.com/sharedfiles/filedetails/?id=123456789"
        );
    }

    #[test]
    fn test_extract_quoted() {
        let line = r#"        "path"      "D:\\SteamLibrary""#;
        let value = extract_quoted_value(line);
        assert_eq!(value, Some("D:\\SteamLibrary".to_string()));
    }
}
