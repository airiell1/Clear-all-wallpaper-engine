use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectInfo {
    pub title: String,
    pub description: String,
    #[serde(rename = "type")]
    pub wallpaper_type: String, // scene, video, web, application
    pub tags: Vec<String>,
    #[serde(rename = "workshopid")]
    pub workshop_id: String,
    pub preview_path: Option<String>, // preview.jpg/gif/png
    pub preview_type: PreviewType,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum PreviewType {
    Image,    // jpg, png
    Gif,      // gif
    Video,    // mp4
    None,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum WallpaperType {
    Scene,       // 장면 (기본)
    Video,       // 영상
    Web,         // 웹사이트
    Application, // 응용프로그램
    Unknown,
}

impl WallpaperType {
    pub fn from_str(s: &str) -> Self {
        match s.to_lowercase().as_str() {
            "scene" => WallpaperType::Scene,
            "video" => WallpaperType::Video,
            "web" => WallpaperType::Web,
            "application" | "app" => WallpaperType::Application,
            _ => WallpaperType::Unknown,
        }
    }

    pub fn to_korean(&self) -> &str {
        match self {
            WallpaperType::Scene => "장면",
            WallpaperType::Video => "영상",
            WallpaperType::Web => "웹사이트",
            WallpaperType::Application => "응용프로그램",
            WallpaperType::Unknown => "알 수 없음",
        }
    }

    pub fn icon(&self) -> &str {
        match self {
            WallpaperType::Scene => "🖼️",
            WallpaperType::Video => "🎬",
            WallpaperType::Web => "🌐",
            WallpaperType::Application => "⚙️",
            WallpaperType::Unknown => "❓",
        }
    }
}

/// project.json 파일 읽기 및 파싱
pub fn read_project_json(folder_path: &str) -> Result<ProjectInfo, String> {
    let project_path = PathBuf::from(folder_path).join("project.json");

    if !project_path.exists() {
        return Err("project.json 파일이 없습니다".to_string());
    }

    let content = fs::read_to_string(&project_path)
        .map_err(|e| format!("파일 읽기 실패: {}", e))?;

    let mut project: serde_json::Value = serde_json::from_str(&content)
        .map_err(|e| format!("JSON 파싱 실패: {}", e))?;

    // 필드 추출
    let title = project["title"]
        .as_str()
        .unwrap_or("제목 없음")
        .to_string();

    let description = project["description"]
        .as_str()
        .unwrap_or("")
        .to_string();

    let wallpaper_type = project["type"]
        .as_str()
        .unwrap_or("scene")
        .to_string();

    let workshop_id = project["workshopid"]
        .as_str()
        .or_else(|| project["workshopid"].as_u64().map(|n| n.to_string()).as_deref())
        .unwrap_or("")
        .to_string();

    let tags = project["tags"]
        .as_array()
        .map(|arr| {
            arr.iter()
                .filter_map(|v| v.as_str())
                .map(|s| s.to_string())
                .collect()
        })
        .unwrap_or_default();

    // 미리보기 파일 찾기
    let (preview_path, preview_type) = find_preview_file(folder_path);

    Ok(ProjectInfo {
        title,
        description,
        wallpaper_type,
        tags,
        workshop_id,
        preview_path,
        preview_type,
    })
}

/// 폴더에서 미리보기 파일 찾기
fn find_preview_file(folder_path: &str) -> (Option<String>, PreviewType) {
    let folder = Path::new(folder_path);

    // 우선순위: preview.mp4 > preview.gif > preview.jpg > preview.png
    let candidates = vec![
        ("preview.mp4", PreviewType::Video),
        ("preview.gif", PreviewType::Gif),
        ("preview.jpg", PreviewType::Image),
        ("preview.png", PreviewType::Image),
        ("preview.jpeg", PreviewType::Image),
    ];

    for (filename, preview_type) in candidates {
        let path = folder.join(filename);
        if path.exists() {
            return (
                Some(path.to_string_lossy().to_string()),
                preview_type,
            );
        }
    }

    (None, PreviewType::None)
}

/// 여러 폴더의 project.json 일괄 읽기 (병렬)
pub fn read_projects_parallel(folder_paths: Vec<String>) -> Vec<Option<ProjectInfo>> {
    use rayon::prelude::*;

    folder_paths
        .par_iter()
        .map(|path| read_project_json(path).ok())
        .collect()
}

/// 타입별 필터링
pub fn filter_by_type(
    items: Vec<(String, ProjectInfo)>,
    wallpaper_type: WallpaperType,
) -> Vec<(String, ProjectInfo)> {
    items
        .into_iter()
        .filter(|(_, info)| {
            WallpaperType::from_str(&info.wallpaper_type) == wallpaper_type
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    use tempfile::TempDir;

    #[test]
    fn test_parse_project_json() {
        let temp_dir = TempDir::new().unwrap();
        let project_path = temp_dir.path().join("project.json");

        let json_content = r#"{
            "title": "Test Wallpaper",
            "description": "A test wallpaper",
            "type": "video",
            "tags": ["anime", "cute"],
            "workshopid": "123456789"
        }"#;

        let mut file = fs::File::create(&project_path).unwrap();
        file.write_all(json_content.as_bytes()).unwrap();
        drop(file);

        let result = read_project_json(temp_dir.path().to_str().unwrap());
        assert!(result.is_ok());

        let info = result.unwrap();
        assert_eq!(info.title, "Test Wallpaper");
        assert_eq!(info.wallpaper_type, "video");
        assert_eq!(info.workshop_id, "123456789");
        assert_eq!(info.tags.len(), 2);
    }

    #[test]
    fn test_wallpaper_type() {
        assert_eq!(WallpaperType::from_str("video").to_korean(), "영상");
        assert_eq!(WallpaperType::from_str("web").icon(), "🌐");
    }
}
