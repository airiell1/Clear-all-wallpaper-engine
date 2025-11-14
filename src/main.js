// 전역 상태
let currentPath = '';
let scanResults = [];
let selectedItems = new Set();
let projectInfoCache = new Map();
let emptyFolders = []; // 빈 폴더 목록

// Tauri API (로드 후 사용)
let invoke, open;

// 초기화
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 App initialized');

    // Wait for Tauri to be ready
    if (window.__TAURI__) {
        console.log('Tauri object:', window.__TAURI__);

        // Tauri v2 API structure
        if (window.__TAURI__.core) {
            invoke = window.__TAURI__.core.invoke;
            console.log('✅ invoke loaded');
        }

        if (window.__TAURI__.shell) {
            open = window.__TAURI__.shell.open;
            console.log('✅ shell.open loaded');
        } else if (window.__TAURI__.plugin?.shell) {
            open = window.__TAURI__.plugin.shell.open;
            console.log('✅ plugin.shell.open loaded');
        }

        console.log('✅ Tauri API loaded');
    } else {
        console.error('❌ Tauri API not available');
        alert('Tauri API를 로드할 수 없습니다. 앱을 다시 시작해주세요.');
        return;
    }

    // Initialize i18n first
    i18n.initLanguage();
    console.log('🌐 i18n initialized');

    await initializeSteamPath();
    setupEventListeners();
    console.log('✅ Setup complete');
});

// Steam 경로 자동 감지
async function initializeSteamPath() {
    console.log('🔍 Detecting Steam path...');
    try {
        const steamInfo = await invoke('find_steam');
        console.log('Steam info:', steamInfo);

        if (steamInfo.found) {
            currentPath = steamInfo.workshop_path;
            document.getElementById('pathInput').value = currentPath;
            showStatus(i18n.t('steamDetected'));
            console.log('✅ Steam detected:', currentPath);
        } else {
            showStatus(i18n.t('steamNotFound'));
            console.log('⚠️ Steam not found');
        }
    } catch (error) {
        console.error('❌ Steam detection error:', error);
        showStatus(i18n.t('steamDetectFailed') + ': ' + error);
    }
}

// 이벤트 리스너 설정
function setupEventListeners() {
    document.getElementById('scanBtn').addEventListener('click', scanFolder);
    document.getElementById('deleteBtn').addEventListener('click', deleteSelected);
    document.getElementById('selectAllBtn').addEventListener('click', selectAll);
    document.getElementById('deselectAllBtn').addEventListener('click', deselectAll);
    document.getElementById('openSteamBtn').addEventListener('click', openSteamPage);
    document.getElementById('findEmptyBtn').addEventListener('click', findEmptyFolders);
    document.getElementById('deleteEmptyBtn').addEventListener('click', deleteAllEmpty);

    // 경로 입력 시 currentPath 업데이트
    document.getElementById('pathInput').addEventListener('input', (e) => {
        currentPath = e.target.value;
        console.log('Path updated:', currentPath);
    });

    // 필터 변경 시 재표시
    document.getElementById('typeFilter').addEventListener('change', displayResults);
}

// 폴더 스캔
async function scanFolder() {
    const depth = 999; // 전체 스캔
    const showFiles = document.getElementById('showFiles').checked;
    const minSize = parseInt(document.getElementById('minSize').value);

    if (!currentPath) {
        alert('경로를 선택해주세요');
        return;
    }

    showProgress('스캔 중...');
    showStatus('🔍 스캔 시작...');

    try {
        const results = await invoke('scan_folder', {
            path: currentPath,
            depth: depth,
            show_files: showFiles,
            min_size: minSize
        });

        scanResults = results;
        selectedItems.clear();

        // Project info 병렬 로드
        await loadProjectInfos(results);

        displayResults();
        hideProgress();
        showStatus(`✅ 스캔 완료: ${results.length}개 항목`);
    } catch (error) {
        hideProgress();
        showStatus('❌ 스캔 실패: ' + error);
        alert('스캔 실패: ' + error);
    }
}

// Project info 로드 (캐싱)
async function loadProjectInfos(results) {
    const folders = results.filter(r => !r.is_file);

    const promises = folders.map(async (folder) => {
        if (!projectInfoCache.has(folder.path)) {
            try {
                const info = await invoke('get_project_info', { folder_path: folder.path });
                projectInfoCache.set(folder.path, info);
            } catch {
                projectInfoCache.set(folder.path, null);
            }
        }
    });

    await Promise.all(promises);
}

// 결과 표시
function displayResults() {
    const fileList = document.getElementById('fileList');
    const typeFilter = document.getElementById('typeFilter').value;

    // 필터링
    let filtered = scanResults;
    if (typeFilter !== 'all') {
        filtered = scanResults.filter(item => {
            if (item.is_file) return false;
            const info = projectInfoCache.get(item.path);
            return info && info.wallpaper_type === typeFilter;
        });
    }

    if (filtered.length === 0) {
        fileList.innerHTML = '<div class="empty-state"><p>결과 없음</p></div>';
        return;
    }

    // 크기순 정렬 (큰 것부터)
    filtered.sort((a, b) => b.size - a.size);

    // 렌더링
    fileList.innerHTML = filtered.map(item => createFileItem(item)).join('');

    // 체크박스 이벤트
    fileList.querySelectorAll('.item-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', handleCheckboxChange);
    });

    // 아이템 클릭 이벤트
    fileList.querySelectorAll('.file-item').forEach(elem => {
        elem.addEventListener('click', (e) => {
            if (e.target.type !== 'checkbox') {
                const path = elem.dataset.path;
                showPreview(path);
            }
        });

        // 더블클릭으로 폴더 열기
        elem.addEventListener('dblclick', async (e) => {
            if (e.target.type !== 'checkbox') {
                const path = elem.dataset.path;
                try {
                    await open(path);
                } catch (error) {
                    console.error('Failed to open folder:', error);
                    alert('폴더 열기 실패: ' + error);
                }
            }
        });
    });

    updateStats();
}

// 파일 아이템 HTML 생성
function createFileItem(item) {
    const info = projectInfoCache.get(item.path);
    const icon = item.is_file ? '📄' : '📁';
    const typeIcon = info ? getTypeIcon(info.wallpaper_type) : '';
    const title = info && info.title ? ` - ${info.title}` : '';
    const sizeFormatted = formatSize(item.size);

    // 빈 폴더인 경우 특별한 클래스 추가
    const emptyClass = item.is_empty ? ' empty-folder' : '';
    const emptyBadge = item.is_empty ? ' <span class="empty-badge">📭 빈 폴더</span>' : '';

    return `
        <div class="file-item${emptyClass}" data-path="${item.path}">
            <input type="checkbox" class="item-checkbox" data-path="${item.path}">
            <span class="item-icon">${icon}${typeIcon}</span>
            <span class="item-name">${item.name}${title}${emptyBadge}</span>
            <span class="item-size">${sizeFormatted}</span>
        </div>
    `;
}

// 타입 아이콘
function getTypeIcon(type) {
    const icons = {
        'scene': '🖼️',
        'video': '🎬',
        'web': '🌐',
        'application': '⚙️'
    };
    return icons[type] || '';
}

// 체크박스 변경
function handleCheckboxChange(e) {
    const path = e.target.dataset.path;
    if (e.target.checked) {
        selectedItems.add(path);
    } else {
        selectedItems.delete(path);
    }
    updateStats();
}

// 전체 선택
function selectAll() {
    document.querySelectorAll('.item-checkbox').forEach(cb => {
        cb.checked = true;
        selectedItems.add(cb.dataset.path);
    });
    updateStats();
}

// 선택 해제
function deselectAll() {
    document.querySelectorAll('.item-checkbox').forEach(cb => {
        cb.checked = false;
    });
    selectedItems.clear();
    updateStats();
}

// 선택 항목 삭제
async function deleteSelected() {
    if (selectedItems.size === 0) {
        alert('삭제할 항목을 선택해주세요');
        return;
    }

    const paths = Array.from(selectedItems);

    // 크기 계산
    const totalSize = await invoke('calculate_total_size', { paths });
    const sizeFormatted = formatSize(totalSize);

    if (!confirm(`${selectedItems.size}개 항목 (${sizeFormatted})을 삭제하시겠습니까?\n\n⚠️ 이 작업은 되돌릴 수 없습니다!`)) {
        return;
    }

    showProgress('삭제 중...');
    showStatus('🗑️ 삭제 중...');

    try {
        const result = await invoke('delete_items', { paths });

        hideProgress();

        if (result.failed > 0) {
            alert(`삭제 완료\n성공: ${result.success}개\n실패: ${result.failed}개\n\n${result.failed_items.map(f => f.path + ': ' + f.error).join('\n')}`);
        } else {
            showStatus(`✅ ${result.success}개 항목 삭제 완료`);
        }

        // 재스캔
        await scanFolder();
    } catch (error) {
        hideProgress();
        showStatus('❌ 삭제 실패: ' + error);
        alert('삭제 실패: ' + error);
    }
}

// 미리보기 표시
async function showPreview(path) {
    const previewContainer = document.getElementById('previewContainer');
    const previewInfo = document.getElementById('previewInfo');
    const item = scanResults.find(r => r.path === path);

    if (!item || item.is_file) {
        previewContainer.innerHTML = '<div class="preview-placeholder"><p>미리보기 없음</p></div>';
        previewInfo.innerHTML = '';
        document.getElementById('openSteamBtn').style.display = 'none';
        return;
    }

    const info = projectInfoCache.get(path);

    if (!info || !info.preview_path) {
        previewContainer.innerHTML = '<div class="preview-placeholder"><p>미리보기 없음</p></div>';
    } else {
        const previewType = info.preview_type;

        if (previewType === 'Video') {
            previewContainer.innerHTML = `
                <video controls autoplay loop class="preview-media">
                    <source src="${convertFileSrc(info.preview_path)}" type="video/mp4">
                </video>
            `;
        } else if (previewType === 'Gif') {
            previewContainer.innerHTML = `
                <img src="${convertFileSrc(info.preview_path)}" class="preview-media" alt="Preview">
            `;
        } else {
            previewContainer.innerHTML = `
                <img src="${convertFileSrc(info.preview_path)}" class="preview-media" alt="Preview">
            `;
        }
    }

    // 정보 표시
    if (info) {
        const typeKorean = await invoke('get_type_korean', { wallpaper_type: info.wallpaper_type });

        previewInfo.innerHTML = `
            <h3>${info.title}</h3>
            <p><strong>타입:</strong> ${getTypeIcon(info.wallpaper_type)} ${typeKorean}</p>
            <p><strong>크기:</strong> ${formatSize(item.size)}</p>
            <p><strong>설명:</strong> ${info.description || '없음'}</p>
            <p><strong>태그:</strong> ${info.tags.join(', ') || '없음'}</p>
            <p><strong>Workshop ID:</strong> ${info.workshop_id || '없음'}</p>
            <div class="preview-actions" style="margin-top: 15px;">
                <button class="btn btn-sm btn-primary" onclick="openFolder('${path}')">📁 폴더 열기</button>
                <button class="btn btn-sm" onclick="copyPath('${path}')">📋 경로 복사</button>
            </div>
        `;

        if (info.workshop_id) {
            const openBtn = document.getElementById('openSteamBtn');
            openBtn.style.display = 'block';
            openBtn.onclick = async () => {
                const url = await invoke('get_steam_url', { workshop_id: info.workshop_id });
                await open(url);
            };
        }
    }
}

// 파일 경로를 Tauri asset URL로 변환
function convertFileSrc(path) {
    return window.__TAURI__.core.convertFileSrc(path);
}

// Steam 페이지 열기
async function openSteamPage() {
    // showPreview에서 이미 처리됨
}

// 폴더 열기
async function openFolder(path) {
    try {
        await open(path);
    } catch (error) {
        console.error('Failed to open folder:', error);
        alert('폴더 열기 실패: ' + error);
    }
}

// 경로 복사
async function copyPath(path) {
    try {
        await navigator.clipboard.writeText(path);
        showStatus('✅ 경로 복사됨: ' + path);
    } catch (error) {
        console.error('Failed to copy path:', error);
        alert('경로 복사 실패: ' + error);
    }
}

// 통계 업데이트
function updateStats() {
    const totalSize = scanResults.reduce((sum, item) => sum + item.size, 0);
    const selectedSize = Array.from(selectedItems)
        .map(path => scanResults.find(r => r.path === path))
        .filter(item => item)
        .reduce((sum, item) => sum + item.size, 0);

    document.getElementById('totalSizeText').textContent =
        `전체: ${scanResults.length}개 (${formatSize(totalSize)})`;

    document.getElementById('selectedCountText').textContent =
        selectedItems.size > 0 ? `선택: ${selectedItems.size}개 (${formatSize(selectedSize)})` : '';
}

// 크기 포맷팅
function formatSize(bytes) {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex++;
    }

    return unitIndex === 0 ? `${bytes} ${units[0]}` : `${size.toFixed(2)} ${units[unitIndex]}`;
}

// 상태 표시
function showStatus(text) {
    document.getElementById('statusText').textContent = text;
}

// 진행 표시
function showProgress(text) {
    document.getElementById('progressContainer').style.display = 'flex';
    document.getElementById('progressText').textContent = text;
    document.getElementById('progressFill').style.animation = 'progress 1.5s ease-in-out infinite';
}

function hideProgress() {
    document.getElementById('progressContainer').style.display = 'none';
}

// 빈 폴더 찾기
async function findEmptyFolders() {
    if (!currentPath) {
        alert('경로를 선택해주세요');
        return;
    }

    const depth = 999; // 전체 스캔

    showProgress('빈 폴더 검색 중...');
    showStatus('📭 빈 폴더 검색 중...');

    try {
        emptyFolders = await invoke('find_empty', {
            path: currentPath,
            depth: depth
        });

        hideProgress();

        if (emptyFolders.length === 0) {
            showStatus('✅ 빈 폴더가 없습니다!');
            alert('빈 폴더가 없습니다!');
            document.getElementById('deleteEmptyBtn').style.display = 'none';
            return;
        }

        showStatus(`📭 빈 폴더 ${emptyFolders.length}개 발견!`);

        // 빈 폴더를 scanResults에 추가하여 표시
        scanResults = emptyFolders.map(path => ({
            path: path,
            name: path.split('\\').pop() || path.split('/').pop(),
            size: 0,
            is_file: false,
            level: 0,
            parent: null,
            is_empty: true // 빈 폴더 표시
        }));

        selectedItems.clear();
        displayResults();

        // "빈 폴더 모두 삭제" 버튼 표시
        document.getElementById('deleteEmptyBtn').style.display = 'inline-block';

        alert(`빈 폴더 ${emptyFolders.length}개를 찾았습니다.\n목록을 확인하고 삭제할 수 있습니다.`);

    } catch (error) {
        hideProgress();
        showStatus('❌ 빈 폴더 검색 실패: ' + error);
        alert('빈 폴더 검색 실패: ' + error);
    }
}

// 빈 폴더 모두 삭제
async function deleteAllEmpty() {
    if (emptyFolders.length === 0) {
        alert('삭제할 빈 폴더가 없습니다');
        return;
    }

    if (!confirm(`${emptyFolders.length}개의 빈 폴더를 모두 삭제하시겠습니까?\n\n⚠️ 이 작업은 되돌릴 수 없습니다!`)) {
        return;
    }

    showProgress('빈 폴더 삭제 중...');
    showStatus('🗑️ 빈 폴더 삭제 중...');

    try {
        const result = await invoke('delete_items', { paths: emptyFolders });

        hideProgress();

        if (result.failed > 0) {
            alert(`삭제 완료\n성공: ${result.success}개\n실패: ${result.failed}개\n\n${result.failed_items.map(f => f.path + ': ' + f.error).join('\n')}`);
        } else {
            showStatus(`✅ ${result.success}개 빈 폴더 삭제 완료!`);
            alert(`${result.success}개의 빈 폴더를 삭제했습니다!`);
        }

        // 빈 폴더 목록 초기화
        emptyFolders = [];
        scanResults = [];
        document.getElementById('deleteEmptyBtn').style.display = 'none';
        displayResults();

    } catch (error) {
        hideProgress();
        showStatus('❌ 삭제 실패: ' + error);
        alert('삭제 실패: ' + error);
    }
}
