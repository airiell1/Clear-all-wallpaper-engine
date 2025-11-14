#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
폴더 용량 계산기 (Folder Size Calculator)
폴더 및 파일의 크기를 계산하고 시각화합니다.
"""

import os
import tkinter as tk
from tkinter import ttk, filedialog, messagebox
from pathlib import Path
import threading
import shutil
import json
from PIL import Image, ImageTk


class FolderSizeCalculator:
    def __init__(self, root):
        self.root = root
        self.root.title("폴더 용량 계산기 - Wallpaper Engine")
        self.root.geometry("1400x750")
        
        self.folder_sizes = []
        self.selected_path = None
        self.calculating = False
        self.sort_by = "size"  # size, name, percentage
        self.sort_reverse = True  # 큰 것부터
        self.root_total_size = 0
        self.path_to_tree_id = {}
        self.tree_id_to_path = {}
        
        self.setup_ui()
        
    def setup_ui(self):
        # 상단 프레임
        top_frame = ttk.Frame(self.root, padding="10")
        top_frame.pack(fill=tk.X)
        
        ttk.Label(top_frame, text="분석할 경로:", font=("", 10)).pack(side=tk.LEFT, padx=5)
        
        self.path_entry = ttk.Entry(top_frame, width=50)
        self.path_entry.pack(side=tk.LEFT, padx=5, fill=tk.X, expand=True)
        
        # 기본 Wallpaper Engine 경로 자동 설정 시도
        self.set_default_path()
        
        ttk.Button(top_frame, text="찾아보기", command=self.browse_folder).pack(side=tk.LEFT, padx=5)
        ttk.Button(top_frame, text="분석", command=self.analyze_folder).pack(side=tk.LEFT, padx=5)
        ttk.Button(top_frame, text="Steam 열기 🌐", command=self.open_in_steam).pack(side=tk.LEFT, padx=5)
        
        # 옵션 프레임
        option_frame = ttk.Frame(self.root, padding="5 0 10 0")
        option_frame.pack(fill=tk.X)
        
        self.depth_var = tk.IntVar(value=1)
        ttk.Label(option_frame, text="탐색 깊이:").pack(side=tk.LEFT, padx=(10, 5))
        ttk.Radiobutton(option_frame, text="1단계", variable=self.depth_var, value=1).pack(side=tk.LEFT, padx=5)
        ttk.Radiobutton(option_frame, text="2단계", variable=self.depth_var, value=2).pack(side=tk.LEFT, padx=5)
        ttk.Radiobutton(option_frame, text="전체", variable=self.depth_var, value=999).pack(side=tk.LEFT, padx=5)
        
        self.show_files_var = tk.BooleanVar(value=False)
        ttk.Checkbutton(option_frame, text="파일도 표시", variable=self.show_files_var).pack(side=tk.LEFT, padx=20)
        
        # 필터 옵션
        ttk.Label(option_frame, text="| 최소 크기:").pack(side=tk.LEFT, padx=(20, 5))
        self.min_size_var = tk.StringVar(value="0")
        size_combo = ttk.Combobox(option_frame, textvariable=self.min_size_var, width=10, 
                                   values=["0 MB", "100 MB", "500 MB", "1 GB", "2 GB", "5 GB"])
        size_combo.pack(side=tk.LEFT, padx=5)
        size_combo.set("0 MB")
        
        # 메인 컨텐츠 프레임 (좌우 분할)
        main_content = ttk.Frame(self.root)
        main_content.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)
        
        # 왼쪽 프레임 - 트리뷰
        left_frame = ttk.LabelFrame(main_content, text="폴더/파일 크기", padding="10")
        left_frame.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        
        # Treeview로 계층 구조 표시
        tree_scroll_y = ttk.Scrollbar(left_frame)
        tree_scroll_y.pack(side=tk.RIGHT, fill=tk.Y)
        
        tree_scroll_x = ttk.Scrollbar(left_frame, orient=tk.HORIZONTAL)
        tree_scroll_x.pack(side=tk.BOTTOM, fill=tk.X)
        
        self.tree = ttk.Treeview(
            left_frame,
            columns=("size", "percentage"),
            yscrollcommand=tree_scroll_y.set,
            xscrollcommand=tree_scroll_x.set,
            selectmode="extended"
        )
        self.tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        
        tree_scroll_y.config(command=self.tree.yview)
        tree_scroll_x.config(command=self.tree.xview)
        
        # 열 설정
        self.tree.heading("#0", text="경로 ▼", anchor=tk.W, command=lambda: self.sort_tree("name"))
        self.tree.heading("size", text="크기 ▼", anchor=tk.E, command=lambda: self.sort_tree("size"))
        self.tree.heading("percentage", text="비율", anchor=tk.E, command=lambda: self.sort_tree("percentage"))
        
        self.tree.column("#0", width=500, minwidth=300)
        self.tree.column("size", width=120, minwidth=100, anchor=tk.E)
        self.tree.column("percentage", width=80, minwidth=60, anchor=tk.E)
        
        # 트리뷰 이벤트 바인딩
        self.tree.bind("<<TreeviewSelect>>", self.on_tree_select)
        self.tree.bind("<Delete>", self.on_delete_key)
        self.tree.bind("<Double-Button-1>", self.on_double_click)
        self.tree.bind("<Button-3>", self.show_context_menu)  # 우클릭 메뉴
        
        # 오른쪽 프레임 - 미리보기
        right_frame = ttk.LabelFrame(main_content, text="미리보기 (Wallpaper Engine)", padding="10")
        right_frame.pack(side=tk.RIGHT, fill=tk.BOTH, padx=(10, 0))
        
        # 미리보기 캔버스
        self.preview_canvas = tk.Canvas(right_frame, width=350, height=350, bg="gray95")
        self.preview_canvas.pack(pady=5)
        
        self.preview_label = ttk.Label(right_frame, text="폴더를 선택하면\npreview.jpg/gif를 표시합니다", 
                                       justify=tk.CENTER, foreground="gray", wraplength=330)
        self.preview_label.pack(pady=10)
        
        # 정보 레이블
        info_frame = ttk.Frame(self.root, padding="10")
        info_frame.pack(fill=tk.X)
        
        self.info_label = ttk.Label(
            info_frame, 
            text="폴더를 선택하고 '분석' 버튼을 눌러주세요.",
            font=("", 9)
        )
        self.info_label.pack(side=tk.LEFT)
        
        # 하단 버튼 프레임
        button_frame = ttk.Frame(self.root, padding="10")
        button_frame.pack(fill=tk.X)
        
        ttk.Button(button_frame, text="🗑️ 선택 항목 즉시 삭제 (Del)", command=self.delete_selected_items).pack(side=tk.LEFT, padx=5)
        ttk.Button(button_frame, text="CSV로 내보내기", command=self.export_csv).pack(side=tk.LEFT, padx=5)
        ttk.Button(button_frame, text="클립보드 복사", command=self.copy_to_clipboard).pack(side=tk.LEFT, padx=5)
        ttk.Button(button_frame, text="새로고침", command=self.analyze_folder).pack(side=tk.LEFT, padx=5)
        ttk.Button(button_frame, text="종료", command=self.root.quit).pack(side=tk.RIGHT, padx=5)
        
        # 진행 표시줄
        self.progress = ttk.Progressbar(self.root, mode='indeterminate')
        self.progress.pack(fill=tk.X, padx=10, pady=5)
        
        # 헤더 초기화
        self.update_headers()
        
        # 이미지 캐시
        self.current_preview_image = None
        
        # 키보드 단축키 바인딩
        self.tree.bind('<Delete>', lambda e: self.delete_selected_items())
        self.tree.bind('<BackSpace>', lambda e: self.delete_selected_items())  # Mac용
        
    def browse_folder(self):
        folder = filedialog.askdirectory(title="분석할 폴더를 선택하세요")
        if folder:
            self.path_entry.delete(0, tk.END)
            self.path_entry.insert(0, folder)
            self.selected_path = folder
    
    def set_default_path(self):
        """Wallpaper Engine 기본 경로 자동 설정"""
        default_paths = [
            r"C:\Program Files (x86)\Steam\steamapps\workshop\content\431960",
            r"D:\Steam\steamapps\workshop\content\431960",
            r"E:\Steam\steamapps\workshop\content\431960",
        ]
        
        # Steam 레지스트리에서 경로 찾기 (Windows)
        if os.name == 'nt':
            try:
                import winreg
                key = winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, r"SOFTWARE\WOW6432Node\Valve\Steam")
                steam_path = winreg.QueryValueEx(key, "InstallPath")[0]
                winreg.CloseKey(key)
                
                we_path = os.path.join(steam_path, "steamapps", "workshop", "content", "431960")
                if os.path.exists(we_path):
                    self.path_entry.insert(0, we_path)
                    self.selected_path = we_path
                    return
            except:
                pass
        
        # 기본 경로 시도
        for path in default_paths:
            if os.path.exists(path):
                self.path_entry.insert(0, path)
                self.selected_path = path
                return
        
        # 없으면 빈 상태로
        self.path_entry.insert(0, "")
    
    def open_in_steam(self):
        """선택한 항목의 Steam 워크샵 페이지 열기"""
        selection = self.tree.selection()
        if not selection:
            messagebox.showinfo("안내", "폴더를 선택해주세요.")
            return
        
        tree_id = selection[0]
        if tree_id not in self.tree_id_to_path:
            return
        
        selected_path = self.tree_id_to_path[tree_id]
        
        if os.path.isdir(selected_path):
            project_info = self.read_project_json(selected_path)
            if project_info and project_info['workshop_id']:
                url = f"https://steamcommunity.com/sharedfiles/filedetails/?id={project_info['workshop_id']}"
                import webbrowser
                webbrowser.open(url)
            else:
                messagebox.showwarning("경고", "워크샵 ID를 찾을 수 없습니다.")
        else:
            messagebox.showwarning("경고", "폴더를 선택해주세요.")
    
    def get_size(self, path):
        """파일 또는 폴더의 크기 계산"""
        total_size = 0
        try:
            if os.path.isfile(path):
                return os.path.getsize(path)
            
            for dirpath, dirnames, filenames in os.walk(path):
                for filename in filenames:
                    filepath = os.path.join(dirpath, filename)
                    try:
                        total_size += os.path.getsize(filepath)
                    except:
                        pass
        except:
            pass
        return total_size
    
    def format_size(self, size_bytes):
        """바이트를 읽기 쉬운 형식으로 변환"""
        if size_bytes == 0:
            return "0 B"
        for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
            if size_bytes < 1024.0:
                return f"{size_bytes:.2f} {unit}"
            size_bytes /= 1024.0
        return f"{size_bytes:.2f} PB"
    
    def analyze_folder(self):
        """폴더 분석 실행"""
        if self.calculating:
            messagebox.showwarning("경고", "이미 분석 중입니다.")
            return
        
        path = self.path_entry.get().strip()
        
        if not path:
            messagebox.showwarning("경고", "분석할 경로를 입력해주세요.")
            return
            
        if not os.path.exists(path):
            messagebox.showerror("오류", "존재하지 않는 경로입니다.")
            return
        
        self.selected_path = path
        
        # 별도 스레드에서 분석
        def analyze_thread():
            self.calculating = True
            self.progress.start()
            self.info_label.config(text="분석 중...")
            
            try:
                self.folder_sizes = self.scan_folder(path)
                self.progress.stop()
                self.display_results()
            except Exception as e:
                self.progress.stop()
                messagebox.showerror("오류", f"분석 중 오류 발생:\n{str(e)}")
            finally:
                self.calculating = False
        
        thread = threading.Thread(target=analyze_thread, daemon=True)
        thread.start()
    
    def sort_tree(self, column):
        """정렬 방식 변경"""
        if self.sort_by == column:
            # 같은 열을 클릭하면 정렬 순서 반전
            self.sort_reverse = not self.sort_reverse
        else:
            # 다른 열을 클릭하면 해당 열로 정렬 (내림차순)
            self.sort_by = column
            self.sort_reverse = True
        
        # 헤더 업데이트
        self.update_headers()
        
        # 결과 재표시
        self.display_results()
    
    def update_headers(self):
        """헤더에 정렬 표시 업데이트"""
        arrow = "▼" if self.sort_reverse else "▲"
        
        name_text = f"경로 {arrow}" if self.sort_by == "name" else "경로"
        size_text = f"크기 {arrow}" if self.sort_by == "size" else "크기"
        percentage_text = f"비율 {arrow}" if self.sort_by == "percentage" else "비율"
        
        self.tree.heading("#0", text=name_text)
        self.tree.heading("size", text=size_text)
        self.tree.heading("percentage", text=percentage_text)
    
    def scan_folder(self, root_path):
        """폴더를 스캔하여 크기 정보 수집"""
        depth = self.depth_var.get()
        show_files = self.show_files_var.get()
        
        items = []
        root_level = root_path.count(os.sep)
        
        # 전체 크기 계산용
        self.root_total_size = self.get_size(root_path)
        
        try:
            # 하위 항목 스캔
            for dirpath, dirnames, filenames in os.walk(root_path):
                current_level = dirpath.count(os.sep) - root_level
                
                # 루트 폴더 자체는 건너뛰기
                if dirpath == root_path:
                    # 루트의 직계 자식들만 추가
                    for dirname in sorted(dirnames):
                        folder_path = os.path.join(dirpath, dirname)
                        folder_size = self.get_size(folder_path)
                        items.append({
                            'path': folder_path,
                            'name': dirname,
                            'size': folder_size,
                            'is_file': False,
                            'level': 0,  # 루트 레벨로 표시
                            'parent': None  # 부모 없음
                        })
                    
                    if show_files:
                        for filename in sorted(filenames):
                            file_path = os.path.join(dirpath, filename)
                            try:
                                file_size = os.path.getsize(file_path)
                                items.append({
                                    'path': file_path,
                                    'name': filename,
                                    'size': file_size,
                                    'is_file': True,
                                    'level': 0,
                                    'parent': None
                                })
                            except:
                                pass
                    
                    # 깊이 제한 확인
                    if depth == 1:
                        dirnames[:] = []
                        continue
                else:
                    # 깊이 제한 확인
                    if depth != 999 and current_level >= depth:
                        dirnames[:] = []
                        continue
                    
                    # 폴더 추가
                    for dirname in sorted(dirnames):
                        folder_path = os.path.join(dirpath, dirname)
                        folder_size = self.get_size(folder_path)
                        items.append({
                            'path': folder_path,
                            'name': dirname,
                            'size': folder_size,
                            'is_file': False,
                            'level': current_level,
                            'parent': dirpath
                        })
                    
                    # 파일 추가 (옵션이 켜진 경우)
                    if show_files:
                        for filename in sorted(filenames):
                            file_path = os.path.join(dirpath, filename)
                            try:
                                file_size = os.path.getsize(file_path)
                                items.append({
                                    'path': file_path,
                                    'name': filename,
                                    'size': file_size,
                                    'is_file': True,
                                    'level': current_level,
                                    'parent': dirpath
                                })
                            except:
                                pass
                    
                    # 깊이 제한이 있으면 더 깊이 들어가지 않기
                    if depth != 999 and current_level >= depth - 1:
                        dirnames[:] = []
                    
        except Exception as e:
            messagebox.showerror("오류", f"스캔 중 오류 발생:\n{str(e)}")
        
        return items
    
    def display_results(self):
        """분석 결과를 Treeview에 표시"""
        # 기존 항목 삭제
        for item in self.tree.get_children():
            self.tree.delete(item)
        
        if not self.folder_sizes:
            self.info_label.config(text="분석 결과가 없습니다.")
            return
        
        # 루트 전체 크기 사용
        root_size = self.root_total_size
        
        # 최소 크기 필터 적용
        min_size_text = self.min_size_var.get()
        min_size_bytes = 0
        if "MB" in min_size_text:
            min_size_bytes = float(min_size_text.split()[0]) * 1024 * 1024
        elif "GB" in min_size_text:
            min_size_bytes = float(min_size_text.split()[0]) * 1024 * 1024 * 1024
        
        # 필터링된 항목
        filtered_items = [item for item in self.folder_sizes if item['size'] >= min_size_bytes]
        
        if not filtered_items:
            self.info_label.config(text=f"필터 조건({min_size_text} 이상)에 맞는 항목이 없습니다.")
            return
        
        # 부모별로 자식 그룹화
        children_by_parent = {}
        for item in filtered_items:
            parent = item.get('parent')
            if parent not in children_by_parent:
                children_by_parent[parent] = []
            children_by_parent[parent].append(item)
        
        # 각 그룹 내에서 정렬
        for parent in children_by_parent:
            items = children_by_parent[parent]
            
            if self.sort_by == "size":
                items.sort(key=lambda x: x['size'], reverse=self.sort_reverse)
            elif self.sort_by == "name":
                items.sort(key=lambda x: x['name'].lower(), reverse=self.sort_reverse)
            elif self.sort_by == "percentage":
                items.sort(key=lambda x: (x['size'] / root_size if root_size > 0 else 0), reverse=self.sort_reverse)
            
            children_by_parent[parent] = items
        
        # 항목을 부모-자식 관계로 삽입
        self.path_to_tree_id = {}  # 경로 -> 트리 ID 매핑
        self.tree_id_to_path = {}  # 트리 ID -> 경로 매핑
        
        def insert_items(parent_path, parent_id):
            """재귀적으로 항목 삽입"""
            if parent_path not in children_by_parent:
                return
            
            for item in children_by_parent[parent_path]:
                path = item['path']
                name = item['name']
                size = item['size']
                is_file = item['is_file']
                
                # 비율 계산
                percentage = (size / root_size * 100) if root_size > 0 else 0
                
                # 아이콘 선택
                icon = "📄" if is_file else "📁"
                
                # Wallpaper Engine 폴더인 경우 제목 추가
                display_name = name
                if not is_file:
                    project_info = self.read_project_json(path)
                    if project_info and project_info['title']:
                        display_name = f"{name} - {project_info['title']}"
                
                # Treeview에 삽입
                tree_id = self.tree.insert(
                    parent_id,
                    "end",
                    text=f"{icon} {display_name}",
                    values=(self.format_size(size), f"{percentage:.1f}%")
                )
                
                self.path_to_tree_id[path] = tree_id
                self.tree_id_to_path[tree_id] = path
                
                # 자식이 있으면 재귀 호출
                if not is_file:
                    insert_items(path, tree_id)
        
        # 루트부터 시작
        insert_items(None, "")
        
        # 정보 업데이트
        total_items = len(filtered_items)
        min_size_text = self.min_size_var.get()
        filter_text = f" (필터: {min_size_text} 이상)" if min_size_bytes > 0 else ""
        self.info_label.config(
            text=f"총 {total_items}개 항목{filter_text} | 전체 크기: {self.format_size(root_size)}"
        )
    
    def export_csv(self):
        """CSV 파일로 내보내기"""
        if not self.folder_sizes:
            messagebox.showwarning("경고", "내보낼 데이터가 없습니다.")
            return
        
        filename = filedialog.asksaveasfilename(
            defaultextension=".csv",
            filetypes=[("CSV 파일", "*.csv"), ("모든 파일", "*.*")]
        )
        
        if not filename:
            return
        
        try:
            import csv
            with open(filename, 'w', newline='', encoding='utf-8-sig') as f:
                writer = csv.writer(f)
                writer.writerow(['경로', '이름', '크기(바이트)', '크기', '타입'])
                
                for item in self.folder_sizes:
                    writer.writerow([
                        item['path'],
                        item['name'],
                        item['size'],
                        self.format_size(item['size']),
                        '파일' if item['is_file'] else '폴더'
                    ])
            
            messagebox.showinfo("성공", f"CSV 파일로 저장했습니다:\n{filename}")
        except Exception as e:
            messagebox.showerror("오류", f"CSV 저장 중 오류:\n{str(e)}")
    
    def on_tree_select(self, event):
        """트리뷰 항목 선택 시 미리보기 표시"""
        selection = self.tree.selection()
        if not selection:
            self.clear_preview()
            return
        
        # 첫 번째 선택 항목의 경로 가져오기
        tree_id = selection[0]
        if tree_id not in self.tree_id_to_path:
            self.clear_preview()
            return
        
        selected_path = self.tree_id_to_path[tree_id]
        
        # 폴더인 경우 Wallpaper Engine 구조 확인
        if os.path.isdir(selected_path):
            # project.json에서 정보 읽기
            project_info = self.read_project_json(selected_path)
            
            # preview.gif 우선, 없으면 preview.jpg
            preview_gif = os.path.join(selected_path, "preview.gif")
            preview_jpg = os.path.join(selected_path, "preview.jpg")
            
            if os.path.exists(preview_gif):
                self.show_preview(preview_gif, project_info)
            elif os.path.exists(preview_jpg):
                self.show_preview(preview_jpg, project_info)
            else:
                self.show_no_preview("미리보기 없음", project_info)
        else:
            # 파일인 경우 이미지 파일이면 자체 미리보기
            if selected_path.lower().endswith(('.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp')):
                self.show_preview(selected_path, None)
            else:
                self.show_no_preview("미리보기 불가", None)
    
    def read_project_json(self, folder_path):
        """project.json 파일에서 정보 읽기"""
        project_json_path = os.path.join(folder_path, "project.json")
        if not os.path.exists(project_json_path):
            return None
        
        try:
            with open(project_json_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                return {
                    'title': data.get('title', '제목 없음'),
                    'description': data.get('description', ''),
                    'type': data.get('type', ''),
                    'tags': data.get('tags', []),
                    'workshop_id': data.get('workshopid', '')
                }
        except:
            return None
    
    def show_preview(self, image_path, project_info=None):
        """이미지 미리보기 표시"""
        try:
            # GIF 애니메이션 지원
            is_gif = image_path.lower().endswith('.gif')
            
            if is_gif:
                self.show_gif_preview(image_path, project_info)
            else:
                # 정적 이미지 - 파일을 열고 즉시 복사 후 닫기
                with Image.open(image_path) as img:
                    # 이미지 복사 (파일 핸들 독립)
                    image = img.copy()
                
                # 캔버스 크기에 맞게 리사이즈
                canvas_width = 350
                canvas_height = 350
                
                # 원본 크기 저장
                original_size = image.size
                
                # 비율 유지하며 리사이즈
                image.thumbnail((canvas_width, canvas_height), Image.Resampling.LANCZOS)
                
                # PhotoImage로 변환
                photo = ImageTk.PhotoImage(image)
                
                # 캔버스에 표시
                self.preview_canvas.delete("all")
                self.preview_canvas.config(bg="white")
                
                x = (canvas_width - photo.width()) // 2
                y = (canvas_height - photo.height()) // 2
                
                self.preview_canvas.create_image(x, y, anchor=tk.NW, image=photo)
                
                # 참조 유지 (가비지 컬렉션 방지)
                self.current_preview_image = photo
                
                # 레이블 업데이트
                label_text = self.format_preview_label(os.path.basename(image_path), original_size, project_info)
                self.preview_label.config(text=label_text)
            
        except Exception as e:
            self.show_no_preview(f"로드 실패:\n{str(e)}", project_info)
    
    def show_gif_preview(self, gif_path, project_info=None):
        """GIF 애니메이션 미리보기"""
        try:
            # GIF 파일 열기
            gif_file = Image.open(gif_path)
            original_size = gif_file.size
            
            self.gif_frames = []
            self.gif_frame_index = 0
            
            # 모든 프레임 로드
            canvas_width = 350
            canvas_height = 350
            
            try:
                frame_index = 0
                while True:
                    gif_file.seek(frame_index)
                    # 프레임 복사 (독립적인 이미지 생성)
                    frame = gif_file.copy().convert('RGBA')
                    frame.thumbnail((canvas_width, canvas_height), Image.Resampling.LANCZOS)
                    photo = ImageTk.PhotoImage(frame)
                    self.gif_frames.append(photo)
                    frame_index += 1
            except EOFError:
                pass
            
            # GIF 파일 닫기 (중요!)
            gif_file.close()
            
            if self.gif_frames:
                self.preview_canvas.delete("all")
                self.preview_canvas.config(bg="white")
                self.current_preview_image = self.gif_frames[0]
                
                # 첫 프레임 표시
                self.animate_gif()
                
                # 레이블 업데이트
                label_text = self.format_preview_label(
                    f"{os.path.basename(gif_path)} (GIF)", 
                    original_size, 
                    project_info
                )
                self.preview_label.config(text=label_text)
        except Exception as e:
            self.show_no_preview(f"GIF 로드 실패:\n{str(e)}", project_info)
    
    def animate_gif(self):
        """GIF 애니메이션 재생"""
        if not hasattr(self, 'gif_frames') or not self.gif_frames:
            return
        
        canvas_width = 350
        canvas_height = 350
        
        frame = self.gif_frames[self.gif_frame_index]
        
        self.preview_canvas.delete("all")
        x = (canvas_width - frame.width()) // 2
        y = (canvas_height - frame.height()) // 2
        self.preview_canvas.create_image(x, y, anchor=tk.NW, image=frame)
        
        self.gif_frame_index = (self.gif_frame_index + 1) % len(self.gif_frames)
        
        # 다음 프레임 스케줄 (약 100ms)
        self.root.after(100, self.animate_gif)
    
    def format_preview_label(self, filename, size, project_info):
        """미리보기 레이블 포맷"""
        label_text = f"{filename}"
        if size:
            label_text += f"\n{size[0]} x {size[1]}"
        
        if project_info:
            label_text += f"\n\n📝 {project_info['title']}"
            if project_info['type']:
                label_text += f"\n🎨 타입: {project_info['type']}"
            if project_info['description']:
                # 설명이 너무 길면 줄이기
                desc = project_info['description']
                if len(desc) > 100:
                    desc = desc[:100] + "..."
                label_text += f"\n💬 {desc}"
            if project_info['tags']:
                tags_str = ", ".join(project_info['tags'][:5])  # 최대 5개
                if len(project_info['tags']) > 5:
                    tags_str += f" +{len(project_info['tags']) - 5}"
                label_text += f"\n🏷️ {tags_str}"
            if project_info['workshop_id']:
                label_text += f"\n🆔 {project_info['workshop_id']}"
        
        return label_text
    
    def show_no_preview(self, message, project_info=None):
        """미리보기 없을 때 메시지 표시"""
        self.preview_canvas.delete("all")
        self.preview_canvas.config(bg="gray95")
        
        label_text = message
        if project_info:
            label_text += f"\n\n📝 {project_info['title']}"
            if project_info['type']:
                label_text += f"\n🎨 타입: {project_info['type']}"
            if project_info['description']:
                desc = project_info['description']
                if len(desc) > 100:
                    desc = desc[:100] + "..."
                label_text += f"\n💬 {desc}"
            if project_info['tags']:
                tags_str = ", ".join(project_info['tags'][:5])
                if len(project_info['tags']) > 5:
                    tags_str += f" +{len(project_info['tags']) - 5}"
                label_text += f"\n🏷️ {tags_str}"
            if project_info['workshop_id']:
                label_text += f"\n🆔 {project_info['workshop_id']}"
        
        self.preview_label.config(text=label_text)
        self.current_preview_image = None
        
        # GIF 애니메이션 중지
        if hasattr(self, 'gif_frames'):
            self.gif_frames = []
    
    def clear_preview(self):
        """미리보기 초기화"""
        self.preview_canvas.delete("all")
        self.preview_canvas.config(bg="gray95")
        self.preview_label.config(text="폴더를 선택하면\npreview.jpg/gif를 표시합니다")
        self.current_preview_image = None
        
        # GIF 애니메이션 중지
        if hasattr(self, 'gif_frames'):
            self.gif_frames = []
    
    def clear_preview_completely(self):
        """미리보기 완전히 클리어 (파일 참조 완전 해제)"""
        # 캔버스 클리어
        self.preview_canvas.delete("all")
        self.preview_canvas.config(bg="gray95")
        self.preview_label.config(text="삭제 중...")
        
        # 이미지 참조 완전 해제
        self.current_preview_image = None
        
        # GIF 관련 리소스 해제
        if hasattr(self, 'gif_frames'):
            self.gif_frames = []
        if hasattr(self, 'gif_image'):
            try:
                self.gif_image.close()
            except:
                pass
            self.gif_image = None
        if hasattr(self, 'gif_frame_index'):
            self.gif_frame_index = 0
        
        # 강제 가비지 컬렉션
        import gc
        gc.collect()
    
    def on_double_click(self, event):
        """더블클릭 시 폴더 열기"""
        selection = self.tree.selection()
        if not selection:
            return
        
        tree_id = selection[0]
        if tree_id not in self.tree_id_to_path:
            return
        
        selected_path = self.tree_id_to_path[tree_id]
        
        try:
            if os.path.isdir(selected_path):
                # 폴더면 탐색기로 열기
                if os.name == 'nt':  # Windows
                    os.startfile(selected_path)
                elif os.name == 'posix':  # Mac, Linux
                    import subprocess
                    subprocess.Popen(['xdg-open', selected_path])
            else:
                # 파일이면 기본 프로그램으로 열기
                if os.name == 'nt':
                    os.startfile(selected_path)
                elif os.name == 'posix':
                    import subprocess
                    subprocess.Popen(['xdg-open', selected_path])
        except Exception as e:
            messagebox.showerror("오류", f"열기 실패:\n{str(e)}")
    
    def show_context_menu(self, event):
        """우클릭 컨텍스트 메뉴 표시"""
        # 클릭한 위치의 항목 선택
        item = self.tree.identify_row(event.y)
        if item:
            self.tree.selection_set(item)
            
            # 컨텍스트 메뉴 생성
            menu = tk.Menu(self.root, tearoff=0)
            menu.add_command(label="📂 탐색기에서 열기", command=lambda: self.on_double_click(None))
            menu.add_command(label="🌐 Steam 페이지 열기", command=self.open_in_steam)
            menu.add_separator()
            menu.add_command(label="🗑️ 삭제 (Del)", command=self.delete_selected_items)
            
            # 메뉴 표시
            menu.post(event.x_root, event.y_root)
    
    def on_delete_key(self, event):
        """Del 키 눌렀을 때 즉시 삭제"""
        self.delete_selected_items()
        return "break"  # 이벤트 전파 중지
    
    def delete_selected_items(self):
        """선택한 항목 즉시 삭제 (확인 없음)"""
        selection = self.tree.selection()
        if not selection:
            return
        
        # 선택한 경로들 수집
        paths_to_delete = []
        for tree_id in selection:
            if tree_id in self.tree_id_to_path:
                paths_to_delete.append(self.tree_id_to_path[tree_id])
        
        if not paths_to_delete:
            return
        
        # 삭제 중 표시
        self.info_label.config(text=f"🗑️ {len(paths_to_delete)}개 항목 삭제 중...")
        self.progress.start()
        self.root.update()
        
        # 🔥 삭제 전에 미리보기 완전히 클리어 (파일 참조 해제)
        self.clear_preview_completely()
        
        # 잠시 대기 (파일 핸들 완전 해제)
        self.root.update()
        import time
        time.sleep(0.15)
        
        # 삭제 실행
        success_count = 0
        fail_count = 0
        failed_items = []
        
        # 깊은 것부터 삭제 (자식부터 부모로)
        paths_sorted = sorted(paths_to_delete, key=lambda x: x.count(os.sep), reverse=True)
        
        for path in paths_sorted:
            try:
                if os.path.isfile(path):
                    # 파일 삭제 전 읽기 전용 속성 제거 (Windows)
                    if os.name == 'nt':
                        try:
                            import stat
                            os.chmod(path, stat.S_IWRITE)
                        except:
                            pass
                    os.remove(path)
                    success_count += 1
                elif os.path.isdir(path):
                    # 폴더 삭제 전 모든 파일 읽기 전용 해제
                    if os.name == 'nt':
                        try:
                            import stat
                            for root, dirs, files in os.walk(path):
                                for fname in files:
                                    fpath = os.path.join(root, fname)
                                    try:
                                        os.chmod(fpath, stat.S_IWRITE)
                                    except:
                                        pass
                        except:
                            pass
                    shutil.rmtree(path)
                    success_count += 1
            except Exception as e:
                fail_count += 1
                failed_items.append(f"{os.path.basename(path)}: {str(e)}")
        
        self.progress.stop()
        
        # 결과 처리
        if fail_count > 0:
            # 실패가 있으면 메시지 표시
            result_msg = f"삭제 완료: 성공 {success_count}개, 실패 {fail_count}개"
            if failed_items:
                result_msg += "\n\n실패한 항목:\n" + "\n".join(failed_items[:5])
                if len(failed_items) > 5:
                    result_msg += f"\n... 외 {len(failed_items) - 5}개"
            messagebox.showwarning("일부 항목 삭제 실패", result_msg)
        else:
            # 모두 성공하면 상태바에만 표시
            self.info_label.config(text=f"✅ {success_count}개 항목 삭제 완료")
        
        # 새로고침
        if success_count > 0:
            self.analyze_folder()
    
    def copy_to_clipboard(self):
        """결과를 클립보드에 복사"""
        if not self.folder_sizes:
            messagebox.showwarning("경고", "복사할 데이터가 없습니다.")
            return
        
        try:
            # 텍스트 형식으로 변환
            lines = []
            for item in self.folder_sizes:
                indent = "  " * item['level']
                icon = "📄" if item['is_file'] else "📁"
                size_str = self.format_size(item['size'])
                lines.append(f"{indent}{icon} {item['name']} - {size_str}")
            
            text = "\n".join(lines)
            
            # 클립보드에 복사
            self.root.clipboard_clear()
            self.root.clipboard_append(text)
            
            messagebox.showinfo("성공", "클립보드에 복사했습니다.")
        except Exception as e:
            messagebox.showerror("오류", f"클립보드 복사 중 오류:\n{str(e)}")


def main():
    root = tk.Tk()
    app = FolderSizeCalculator(root)
    root.mainloop()


if __name__ == "__main__":
    main()
