// Multi-language support for Wallpaper Engine Cleaner
// Default: English, Optional: Korean

const translations = {
    en: {
        // Header
        appTitle: "🗂️ Wallpaper Engine Cleaner",
        pathPlaceholder: "Detecting Steam path...",
        browseBtn: "📁 Browse",
        scanBtn: "🔍 Scan",
        findEmptyBtn: "📭 Find Empty",

        // Options
        depth1: "Level 1",
        depth2: "Level 2",
        depthAll: "All",
        showFiles: "Show Files",
        minSize: "Min Size",
        minSizeAll: "All",
        typeFilter: "Type",
        typeAll: "All",
        typeScene: "🖼️ Scene",
        typeVideo: "🎬 Video",
        typeWeb: "🌐 Web",
        typeApp: "⚙️ Application",

        // Section Headers
        folderList: "Folder List",
        preview: "Preview",

        // Buttons
        selectAll: "Select All",
        deselectAll: "Deselect All",
        deleteEmpty: "🗑️ Delete Empty",
        deleteSelected: "🗑️ Delete Selected",
        exportCSV: "Export CSV",
        copyClipboard: "Copy",
        refresh: "Refresh",
        exit: "Exit",
        openSteam: "🌐 Steam Page",

        // Status
        ready: "Ready",
        scanning: "Scanning...",
        deleting: "Deleting...",
        findingEmpty: "Finding empty folders...",

        // Preview
        previewPlaceholder: "Select an item to preview",
        noPreview: "No preview available",

        // Messages
        steamDetected: "✅ Steam path auto-detected",
        steamNotFound: "⚠️ Steam path not found. Please select manually.",
        steamDetectFailed: "❌ Steam path detection failed",
        scanComplete: "✅ Scan complete",
        deleteComplete: "✅ Delete complete",
        emptyFoldersFound: "📭 Empty folders found",
        noEmptyFolders: "✅ No empty folders!",
        emptyFolderDeleted: "✅ Empty folders deleted!",

        // Alerts
        selectPath: "Please select a path",
        selectItems: "Please select items to delete",
        confirmDelete: "Delete {count} items ({size})?\n\n⚠️ This action cannot be undone!",
        confirmDeleteEmpty: "Delete {count} empty folders?\n\n⚠️ This action cannot be undone!",
        emptyFoldersFoundAlert: "Found {count} empty folders.\nYou can review and delete them.",
        noEmptyFoldersAlert: "No empty folders found!",
        deleteSuccess: "{count} items deleted successfully!",
        emptyDeleteSuccess: "{count} empty folders deleted!",
        deleteFailed: "Delete failed",
        deletePartial: "Delete complete\nSuccess: {success}\nFailed: {failed}",

        // Info
        totalItems: "Total: {count} items ({size})",
        selectedItems: "Selected: {count} ({size})",
        emptyFolder: "📭 Empty",

        // Project Info
        title: "Title",
        type: "Type",
        size: "Size",
        description: "Description",
        tags: "Tags",
        workshopId: "Workshop ID",
        none: "None",
    },

    ko: {
        // Header
        appTitle: "🗂️ Wallpaper Engine Cleaner",
        pathPlaceholder: "Steam 경로 자동 감지 중...",
        browseBtn: "📁 찾아보기",
        scanBtn: "🔍 스캔",
        findEmptyBtn: "📭 빈 폴더 찾기",

        // Options
        depth1: "1단계",
        depth2: "2단계",
        depthAll: "전체",
        showFiles: "파일도 표시",
        minSize: "최소 크기",
        minSizeAll: "전체",
        typeFilter: "타입",
        typeAll: "전체",
        typeScene: "🖼️ 장면",
        typeVideo: "🎬 영상",
        typeWeb: "🌐 웹사이트",
        typeApp: "⚙️ 응용프로그램",

        // Section Headers
        folderList: "폴더 목록",
        preview: "미리보기",

        // Buttons
        selectAll: "전체 선택",
        deselectAll: "선택 해제",
        deleteEmpty: "🗑️ 빈 폴더 모두 삭제",
        deleteSelected: "🗑️ 선택 삭제",
        exportCSV: "CSV로 내보내기",
        copyClipboard: "클립보드 복사",
        refresh: "새로고침",
        exit: "종료",
        openSteam: "🌐 Steam 페이지",

        // Status
        ready: "준비",
        scanning: "스캔 중...",
        deleting: "삭제 중...",
        findingEmpty: "빈 폴더 검색 중...",

        // Preview
        previewPlaceholder: "항목을 선택하면\n미리보기가 표시됩니다",
        noPreview: "미리보기 없음",

        // Messages
        steamDetected: "✅ Steam 경로 자동 감지 완료",
        steamNotFound: "⚠️ Steam 경로를 찾을 수 없습니다. 수동으로 선택해주세요.",
        steamDetectFailed: "❌ Steam 경로 감지 실패",
        scanComplete: "✅ 스캔 완료",
        deleteComplete: "✅ 삭제 완료",
        emptyFoldersFound: "📭 빈 폴더 발견",
        noEmptyFolders: "✅ 빈 폴더가 없습니다!",
        emptyFolderDeleted: "✅ 빈 폴더 삭제 완료!",

        // Alerts
        selectPath: "경로를 선택해주세요",
        selectItems: "삭제할 항목을 선택해주세요",
        confirmDelete: "{count}개 항목 ({size})을 삭제하시겠습니까?\n\n⚠️ 이 작업은 되돌릴 수 없습니다!",
        confirmDeleteEmpty: "{count}개의 빈 폴더를 모두 삭제하시겠습니까?\n\n⚠️ 이 작업은 되돌릴 수 없습니다!",
        emptyFoldersFoundAlert: "빈 폴더 {count}개를 찾았습니다.\n목록을 확인하고 삭제할 수 있습니다.",
        noEmptyFoldersAlert: "빈 폴더가 없습니다!",
        deleteSuccess: "{count}개 항목 삭제 완료!",
        emptyDeleteSuccess: "{count}개의 빈 폴더를 삭제했습니다!",
        deleteFailed: "삭제 실패",
        deletePartial: "삭제 완료\n성공: {success}개\n실패: {failed}개",

        // Info
        totalItems: "전체: {count}개 ({size})",
        selectedItems: "선택: {count}개 ({size})",
        emptyFolder: "📭 빈 폴더",

        // Project Info
        title: "제목",
        type: "타입",
        size: "크기",
        description: "설명",
        tags: "태그",
        workshopId: "Workshop ID",
        none: "없음",
    }
};

// Current language (default: English)
let currentLang = 'en';

// Get translation
function t(key, params = {}) {
    let text = translations[currentLang][key] || translations['en'][key] || key;

    // Replace parameters like {count}, {size}
    Object.keys(params).forEach(param => {
        text = text.replace(new RegExp(`\\{${param}\\}`, 'g'), params[param]);
    });

    return text;
}

// Set language
function setLanguage(lang) {
    if (!translations[lang]) {
        console.warn(`Language '${lang}' not found, using English`);
        lang = 'en';
    }

    currentLang = lang;
    localStorage.setItem('preferred-lang', lang);
    updateUI();
}

// Get current language
function getCurrentLanguage() {
    return currentLang;
}

// Initialize language from localStorage or browser
function initLanguage() {
    const saved = localStorage.getItem('preferred-lang');
    if (saved && translations[saved]) {
        currentLang = saved;
    } else {
        // Default to English
        currentLang = 'en';
    }
    updateUI();
}

// Update all UI elements with translations
function updateUI() {
    // Update all elements with data-i18n attribute
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        const value = t(key);

        if (el.tagName === 'INPUT' && el.type === 'text') {
            el.placeholder = value;
        } else if (el.tagName === 'OPTION') {
            el.textContent = value;
        } else {
            el.textContent = value;
        }
    });

    // Update language switcher
    const langButtons = document.querySelectorAll('.lang-btn');
    langButtons.forEach(btn => {
        if (btn.getAttribute('data-lang') === currentLang) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
}

// Export for use in other scripts
window.i18n = {
    t,
    setLanguage,
    getCurrentLanguage,
    initLanguage,
    updateUI
};
