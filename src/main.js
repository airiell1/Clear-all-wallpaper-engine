// 전역 상태
let currentPath = '';
let backupPath = ''; // 백업 폴더 경로
let scanResults = [];
let selectedItems = new Set();
let projectInfoCache = new Map();
let emptyFolders = []; // 빈 폴더 목록
let expandedFolders = new Set(); // 펼쳐진 폴더들
let selectedItem = null; // 현재 선택된 항목 (미리보기용)
let clickTimer = null; // 클릭 타이머 (단일/더블 클릭 구분)

// Tauri API (로드 후 사용)
let invoke, open, dialog;

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

        if (window.__TAURI__.dialog) {
            dialog = window.__TAURI__.dialog;
            console.log('✅ dialog loaded');
        } else if (window.__TAURI__.plugin?.dialog) {
            dialog = window.__TAURI__.plugin.dialog;
            console.log('✅ plugin.dialog loaded');
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
    setupKeyboardShortcuts();
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
    document.getElementById('browseBtn').addEventListener('click', browseFolder);
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

    // 경로 입력 후 Enter 키로 스캔
    document.getElementById('pathInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            scanFolder();
        }
    });

    // 백업 폴더 설정
    document.getElementById('setBackupBtn').addEventListener('click', () => {
        backupPath = document.getElementById('backupPathInput').value;
        if (backupPath) {
            showStatus('✅ 백업 폴더 설정됨: ' + backupPath);
            console.log('Backup path set:', backupPath);
        }
    });

    document.getElementById('backupPathInput').addEventListener('input', (e) => {
        backupPath = e.target.value;
    });

    // 필터 변경 시 재표시
    document.getElementById('typeFilter').addEventListener('change', displayResults);
}

// 키보드 단축키 설정
function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // Delete 키: 선택한 항목 삭제
        if (e.key === 'Delete' && selectedItems.size > 0) {
            if (!e.target.matches('input, textarea')) {
                deleteSelected();
            }
        }

        // Escape 키: 선택 해제
        if (e.key === 'Escape') {
            deselectAll();
            selectedItem = null;
            displayResults();
        }

        // Ctrl+A: 전체 선택
        if (e.ctrlKey && e.key === 'a') {
            if (!e.target.matches('input, textarea')) {
                e.preventDefault();
                selectAll();
            }
        }

        // F5 또는 Ctrl+R: 재스캔
        if (e.key === 'F5' || (e.ctrlKey && e.key === 'r')) {
            if (currentPath && !e.target.matches('input, textarea')) {
                e.preventDefault();
                scanFolder();
            }
        }
    });
}

// 폴더 선택
async function browseFolder() {
    if (!dialog) {
        alert('Dialog API를 사용할 수 없습니다. 경로를 직접 입력해주세요.');
        return;
    }

    try {
        const selected = await dialog.open({
            directory: true,
            multiple: false,
            title: '폴더 선택'
        });

        if (selected) {
            currentPath = selected;
            document.getElementById('pathInput').value = selected;
            console.log('Selected folder:', selected);
        }
    } catch (error) {
        console.error('Failed to open dialog:', error);
        alert('폴더 선택 실패: ' + error);
    }
}

// 폴더 스캔
async function scanFolder() {
    const depth = 999; // 전체 스캔
    const showFiles = document.getElementById('showFiles').checked;
    const minSize = parseInt(document.getElementById('minSize').value);

    if (!currentPath) {
        alert('⚠️ 경로를 선택해주세요\n\n상단의 "찾아보기" 버튼을 사용하거나\n직접 경로를 입력해주세요.');
        return;
    }

    // 초기화
    expandedFolders.clear();
    selectedItem = null;

    showProgress('스캔 중...');
    showStatus('🔍 스캔 시작...');
    console.log('Scanning folder:', currentPath);

    try {
        const startTime = performance.now();

        const results = await invoke('scan_folder', {
            path: currentPath,
            depth: depth,
            show_files: showFiles,
            min_size: minSize
        });

        const scanTime = ((performance.now() - startTime) / 1000).toFixed(2);

        scanResults = results;
        selectedItems.clear();

        console.log(`Scan completed: ${results.length} items in ${scanTime}s`);

        // Project info 병렬 로드
        showStatus('📋 프로젝트 정보 로딩 중...');
        await loadProjectInfos(results);

        displayResults();
        hideProgress();

        const totalSize = results.reduce((sum, item) => sum + item.size, 0);
        showStatus(`✅ 스캔 완료: ${results.length}개 항목 (${formatSize(totalSize)}, ${scanTime}초)`);
    } catch (error) {
        hideProgress();
        console.error('Scan error:', error);
        showStatus('❌ 스캔 실패');
        alert(`❌ 스캔 실패\n\n오류: ${error}\n\n경로를 확인하고 다시 시도해주세요.`);
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

// 결과 표시 (트리 뷰)
function displayResults() {
    const fileList = document.getElementById('fileList');
    const typeFilter = document.getElementById('typeFilter').value;

    // 타입 필터 적용
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

    // 트리 구조 렌더링
    const tree = buildTree(filtered);
    fileList.innerHTML = tree;

    // 이벤트 리스너 설정
    attachTreeEventListeners();

    updateStats();
}

// 트리 구조 생성
function buildTree(items) {
    // 최상위 항목 찾기 (level 1)
    const topLevel = items.filter(item => item.level === 1);

    // 크기순 정렬
    topLevel.sort((a, b) => b.size - a.size);

    return topLevel.map(item => renderTreeItem(item, items)).join('');
}

// 트리 항목 렌더링
function renderTreeItem(item, allItems, depth = 0) {
    const hasChildren = allItems.some(child => child.parent === item.path);
    const isExpanded = expandedFolders.has(item.path);
    const isSelected = selectedItem === item.path;

    let html = createFileItem(item, hasChildren, isExpanded, isSelected, depth);

    // 하위 항목 렌더링 (펼쳐져 있을 때만)
    if (hasChildren && isExpanded) {
        const children = allItems.filter(child => child.parent === item.path);
        children.sort((a, b) => {
            // 폴더 먼저, 그 다음 파일
            if (a.is_file !== b.is_file) {
                return a.is_file ? 1 : -1;
            }
            return b.size - a.size;
        });

        children.forEach(child => {
            html += renderTreeItem(child, allItems, depth + 1);
        });
    }

    return html;
}

// 파일 아이템 HTML 생성
function createFileItem(item, hasChildren = false, isExpanded = false, isSelected = false, depth = 0) {
    const info = projectInfoCache.get(item.path);
    const icon = item.is_file ? '📄' : '📁';
    const typeIcon = info ? getTypeIcon(info.wallpaper_type) : '';
    const title = info && info.title ? ` - ${info.title}` : '';
    const sizeFormatted = formatSize(item.size);

    // 클래스 설정
    const emptyClass = item.is_empty ? ' empty-folder' : '';
    const selectedClass = isSelected ? ' selected' : '';
    const expandableClass = hasChildren ? ' expandable' : '';

    // 배지
    const emptyBadge = item.is_empty ? ' <span class="empty-badge">📭 빈 폴더</span>' : '';

    // 확장 아이콘 (하위 항목이 있을 경우만)
    const expandIcon = hasChildren ?
        `<span class="expand-icon">${isExpanded ? '▼' : '▶'}</span>` :
        '<span class="expand-icon-placeholder"></span>';

    // 들여쓰기
    const indent = depth * 20;

    return `
        <div class="file-item${emptyClass}${selectedClass}${expandableClass}"
             data-path="${item.path}"
             data-is-file="${item.is_file}"
             data-has-children="${hasChildren}"
             style="padding-left: ${indent + 15}px;">
            ${expandIcon}
            <input type="checkbox" class="item-checkbox" data-path="${item.path}">
            <span class="item-icon">${icon}${typeIcon}</span>
            <span class="item-name">${item.name}${title}${emptyBadge}</span>
            <span class="item-size">${sizeFormatted}</span>
        </div>
    `;
}

// 트리 이벤트 리스너 연결
function attachTreeEventListeners() {
    const fileList = document.getElementById('fileList');

    // 체크박스 이벤트
    fileList.querySelectorAll('.item-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', handleCheckboxChange);
    });

    // 아이템 클릭 이벤트
    fileList.querySelectorAll('.file-item').forEach(elem => {
        elem.addEventListener('click', (e) => {
            // 체크박스 클릭은 무시
            if (e.target.classList.contains('item-checkbox')) return;

            const path = elem.dataset.path;
            const hasChildren = elem.dataset.hasChildren === 'true';
            const isFile = elem.dataset.isFile === 'true';

            // 확장 아이콘 클릭 시 토글
            if (e.target.classList.contains('expand-icon')) {
                if (hasChildren) {
                    toggleFolder(path);
                }
                return;
            }

            // 단일 클릭 처리 (더블클릭과 구분)
            if (clickTimer) {
                clearTimeout(clickTimer);
                clickTimer = null;
            }

            clickTimer = setTimeout(() => {
                // 단일 클릭: 선택 및 미리보기
                if (selectedItem === path && hasChildren) {
                    // 이미 선택된 항목을 다시 클릭 -> 토글
                    toggleFolder(path);
                } else {
                    // 새 항목 선택 -> 미리보기 표시
                    selectItem(path);
                }
                clickTimer = null;
            }, 250);
        });

        // 더블클릭 이벤트
        elem.addEventListener('dblclick', async (e) => {
            if (e.target.classList.contains('item-checkbox')) return;

            // 더블클릭 타이머 취소
            if (clickTimer) {
                clearTimeout(clickTimer);
                clickTimer = null;
            }

            const path = elem.dataset.path;
            const isFile = elem.dataset.isFile === 'true';

            // 더블클릭: 파일 탐색기로 열기
            if (!isFile) {
                try {
                    await open(path);
                } catch (error) {
                    console.error('Failed to open folder:', error);
                    alert('폴더 열기 실패: ' + error);
                }
            }
        });
    });
}

// 폴더 펼치기/접기
function toggleFolder(path) {
    if (expandedFolders.has(path)) {
        expandedFolders.delete(path);
    } else {
        expandedFolders.add(path);
    }
    displayResults();
}

// 항목 선택
function selectItem(path) {
    selectedItem = path;
    showPreview(path);
    displayResults();
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
        alert('⚠️ 삭제할 항목을 선택해주세요\n\n체크박스를 선택한 후 삭제 버튼을 눌러주세요.');
        return;
    }

    const paths = Array.from(selectedItems);

    try {
        showProgress('크기 계산 중...');

        // 크기 계산
        const totalSize = await invoke('calculate_total_size', { paths });
        const sizeFormatted = formatSize(totalSize);

        hideProgress();

        // 상세 정보와 함께 확인
        const itemList = paths.map(p => {
            const item = scanResults.find(r => r.path === p);
            return item ? `  • ${item.name} (${formatSize(item.size)})` : `  • ${p}`;
        }).join('\n');

        if (!confirm(`🗑️ 다음 ${selectedItems.size}개 항목을 삭제하시겠습니까?\n\n${itemList}\n\n전체 크기: ${sizeFormatted}\n\n⚠️ 이 작업은 되돌릴 수 없습니다!`)) {
            return;
        }

        showProgress(`삭제 중... (0/${paths.length})`);
        showStatus('🗑️ 삭제 중...');

        const startTime = performance.now();
        const result = await invoke('delete_items', { paths });
        const deleteTime = ((performance.now() - startTime) / 1000).toFixed(2);

        hideProgress();

        if (result.failed > 0) {
            const errorDetails = result.failed_items.map(f => `  • ${f.path}\n    ${f.error}`).join('\n\n');
            alert(`⚠️ 삭제 부분 완료\n\n✅ 성공: ${result.success}개\n❌ 실패: ${result.failed}개\n\n실패한 항목:\n${errorDetails}`);
            showStatus(`⚠️ 삭제 부분 완료: ${result.success}개 성공, ${result.failed}개 실패`);
        } else {
            showStatus(`✅ ${result.success}개 항목 삭제 완료 (${deleteTime}초)`);
        }

        // 재스캔
        console.log('Rescanning after deletion...');
        await scanFolder();
    } catch (error) {
        hideProgress();
        console.error('Delete error:', error);
        showStatus('❌ 삭제 실패');
        alert(`❌ 삭제 실패\n\n오류: ${error}`);
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

        // Escape path for use in onclick handlers
        const escapedPath = path.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        const itemType = item.is_file ? '파일' : '폴더';

        previewInfo.innerHTML = `
            <h3>${info.title}</h3>
            <p><strong>타입:</strong> ${getTypeIcon(info.wallpaper_type)} ${typeKorean}</p>
            <p><strong>크기:</strong> ${formatSize(item.size)}</p>
            <p><strong>설명:</strong> ${info.description || '없음'}</p>
            <p><strong>태그:</strong> ${info.tags.join(', ') || '없음'}</p>
            <p><strong>Workshop ID:</strong> ${info.workshop_id || '없음'}</p>
            <div class="preview-actions" style="margin-top: 15px; display: flex; gap: 8px; flex-wrap: wrap;">
                <button class="btn btn-sm btn-primary" onclick="openFolder('${escapedPath}')">📁 폴더 열기</button>
                <button class="btn btn-sm btn-success" onclick="backupItem('${escapedPath}')">💾 백업</button>
                <button class="btn btn-sm btn-danger" onclick="deleteItem('${escapedPath}')">🗑️ 삭제</button>
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

// 항목 백업 (파일 또는 폴더)
async function backupItem(sourcePath) {
    if (!backupPath) {
        alert('백업 폴더를 먼저 설정해주세요!');
        return;
    }

    try {
        showProgress('백업 중...');
        showStatus('💾 백업 중...');

        await invoke('copy_item_cmd', {
            source: sourcePath,
            destination: backupPath
        });

        hideProgress();
        showStatus('✅ 백업 완료!');
        alert('백업이 완료되었습니다!\n\n대상: ' + backupPath);
    } catch (error) {
        hideProgress();
        console.error('Failed to backup item:', error);
        showStatus('❌ 백업 실패: ' + error);
        alert('백업 실패: ' + error);
    }
}

// 단일 항목 삭제
async function deleteItem(itemPath) {
    const item = scanResults.find(r => r.path === itemPath);
    if (!item) {
        alert('항목을 찾을 수 없습니다.');
        return;
    }

    const itemType = item.is_file ? '파일' : '폴더';
    const sizeFormatted = formatSize(item.size);

    if (!confirm(`${itemType} "${item.name}"을(를) 삭제하시겠습니까?\n\n크기: ${sizeFormatted}\n\n⚠️ 이 작업은 되돌릴 수 없습니다!`)) {
        return;
    }

    try {
        showProgress('삭제 중...');
        showStatus('🗑️ 삭제 중...');

        const result = await invoke('delete_items', { paths: [itemPath] });

        hideProgress();

        if (result.failed > 0) {
            alert(`삭제 실패!\n\n에러: ${result.failed_items[0].error}`);
            showStatus('❌ 삭제 실패');
        } else {
            showStatus('✅ 삭제 완료');
            // 선택 해제 및 미리보기 클리어
            selectedItem = null;
            document.getElementById('previewContainer').innerHTML = '<div class="preview-placeholder"><p>항목이 삭제되었습니다</p></div>';
            document.getElementById('previewInfo').innerHTML = '';
            // 재스캔
            await scanFolder();
        }
    } catch (error) {
        hideProgress();
        console.error('Failed to delete item:', error);
        showStatus('❌ 삭제 실패: ' + error);
        alert('삭제 실패: ' + error);
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
        alert('⚠️ 경로를 선택해주세요');
        return;
    }

    const depth = 999; // 전체 스캔

    showProgress('빈 폴더 검색 중...');
    showStatus('📭 빈 폴더 검색 중...');
    console.log('Finding empty folders in:', currentPath);

    try {
        const startTime = performance.now();

        emptyFolders = await invoke('find_empty', {
            path: currentPath,
            depth: depth
        });

        const searchTime = ((performance.now() - startTime) / 1000).toFixed(2);

        hideProgress();

        if (emptyFolders.length === 0) {
            showStatus('✅ 빈 폴더가 없습니다!');
            alert('✅ 빈 폴더를 찾지 못했습니다!\n\n모든 폴더에 파일이 있습니다.');
            document.getElementById('deleteEmptyBtn').style.display = 'none';
            return;
        }

        // 빈 폴더의 level 계산 (currentPath 기준)
        const rootComponents = currentPath.split(/[\\\/]/).length;
        const emptyFoldersWithLevel = emptyFolders.map(path => {
            const pathComponents = path.split(/[\\\/]/).length;
            const level = pathComponents - rootComponents;
            return {
                path: path,
                name: path.split('\\').pop() || path.split('/').pop(),
                size: 0,
                is_file: false,
                level: level,
                parent: path.substring(0, path.lastIndexOf('\\')),
                is_empty: true // 빈 폴더 표시
            };
        });

        // 최상위 빈 폴더만 필터링 (level 1만)
        const topLevelEmpty = emptyFoldersWithLevel.filter(f => f.level === 1);

        console.log(`Found ${emptyFolders.length} empty folders (${topLevelEmpty.length} top-level) in ${searchTime}s`);
        showStatus(`📭 최상위 빈 폴더 ${topLevelEmpty.length}개 발견! (전체 ${emptyFolders.length}개, ${searchTime}초)`);

        // 빈 폴더를 scanResults에 추가하여 표시
        scanResults = emptyFoldersWithLevel;
        expandedFolders.clear();
        selectedItem = null;
        selectedItems.clear();
        displayResults();

        // "빈 폴더 모두 삭제" 버튼 표시
        document.getElementById('deleteEmptyBtn').style.display = 'inline-block';

        alert(`📭 빈 폴더 발견!\n\n전체: ${emptyFolders.length}개\n최상위: ${topLevelEmpty.length}개\n\n목록을 확인하고 삭제할 수 있습니다.`);

    } catch (error) {
        hideProgress();
        console.error('Find empty error:', error);
        showStatus('❌ 빈 폴더 검색 실패');
        alert(`❌ 빈 폴더 검색 실패\n\n오류: ${error}`);
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
