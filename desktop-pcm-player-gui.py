#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
桌面版PCM播放器 - 真正的桌面GUI应用
使用tkinter作为GUI界面，不依赖浏览器
"""

import os
import sys
import tkinter as tk
from tkinter import ttk, filedialog, messagebox
import threading
import time
import struct
import math
from tkinter import Canvas, Frame, Button, Label, Scale
import tkinter.font as tkFont

class PCMPlayerGUI:
    def __init__(self, root):
        self.root = root
        self.root.title("PCM播放器")
        self.root.geometry("900x700")
        self.root.configure(bg='#f5f5f5')
        
        # 音频相关
        self.audio_data = None
        self.sample_rate = 16000
        self.duration = 0
        self.current_time = 0
        self.is_playing = False
        self.play_thread = None
        
        # 波形数据
        self.waveform_data = []
        self.canvas_width = 800
        self.canvas_height = 200
        
        self.setup_ui()
        self.load_data_directory()
    
    def setup_ui(self):
        """设置用户界面"""
        # 主框架
        main_frame = Frame(self.root, bg='#f5f5f5')
        main_frame.pack(fill='both', expand=True, padx=20, pady=20)
        
        # 标题
        title_label = Label(main_frame, text="PCM播放器", 
                           font=('Arial', 20, 'bold'), 
                           bg='#f5f5f5', fg='#2196F3')
        title_label.pack(pady=(0, 10))
        
        subtitle_label = Label(main_frame, text="16kHz, 16bit, 单声道, 小端序", 
                              font=('Arial', 12), 
                              bg='#f5f5f5', fg='#666')
        subtitle_label.pack(pady=(0, 20))
        
        # 文件选择框架
        file_frame = Frame(main_frame, bg='#f5f5f5')
        file_frame.pack(fill='x', pady=(0, 20))
        
        self.file_label = Label(file_frame, text="未选择文件", 
                               font=('Arial', 12), 
                               bg='#f5f5f5', fg='#666')
        self.file_label.pack(side='left')
        
        select_btn = Button(file_frame, text="选择PCM文件", 
                           command=self.select_file,
                           bg='#4CAF50', fg='white', 
                           font=('Arial', 10, 'bold'),
                           padx=20, pady=5)
        select_btn.pack(side='right')
        
        # 文件列表框架
        list_frame = Frame(main_frame, bg='#f5f5f5')
        list_frame.pack(fill='both', expand=True, pady=(0, 20))
        
        list_label = Label(list_frame, text="data目录中的PCM文件：", 
                          font=('Arial', 12, 'bold'), 
                          bg='#f5f5f5', fg='#333')
        list_label.pack(anchor='w', pady=(0, 10))
        
        # 文件列表
        self.file_listbox = tk.Listbox(list_frame, height=6, 
                                      font=('Arial', 10),
                                      selectmode='single')
        self.file_listbox.pack(fill='both', expand=True)
        self.file_listbox.bind('<<ListboxSelect>>', self.on_file_select)
        
        # 波形显示框架
        waveform_frame = Frame(main_frame, bg='#f5f5f5')
        waveform_frame.pack(fill='x', pady=(0, 20))
        
        waveform_label = Label(waveform_frame, text="波形显示：", 
                              font=('Arial', 12, 'bold'), 
                              bg='#f5f5f5', fg='#333')
        waveform_label.pack(anchor='w', pady=(0, 10))
        
        # 波形画布
        self.canvas = Canvas(waveform_frame, width=self.canvas_width, 
                            height=self.canvas_height, 
                            bg='#f8f9fa', relief='sunken', bd=1)
        self.canvas.pack()
        self.canvas.bind('<Button-1>', self.on_canvas_click)
        self.canvas.bind('<B1-Motion>', self.on_canvas_drag)
        
        # 控制框架
        control_frame = Frame(main_frame, bg='#f5f5f5')
        control_frame.pack(fill='x', pady=(0, 10))
        
        # 播放控制按钮
        button_frame = Frame(control_frame, bg='#f5f5f5')
        button_frame.pack(side='left')
        
        self.play_btn = Button(button_frame, text="播放", 
                              command=self.toggle_play,
                              bg='#4CAF50', fg='white', 
                              font=('Arial', 12, 'bold'),
                              padx=20, pady=8, state='disabled')
        self.play_btn.pack(side='left', padx=(0, 10))
        
        self.stop_btn = Button(button_frame, text="停止", 
                               command=self.stop,
                               bg='#f44336', fg='white', 
                               font=('Arial', 12, 'bold'),
                               padx=20, pady=8, state='disabled')
        self.stop_btn.pack(side='left')
        
        # 时间显示
        time_frame = Frame(control_frame, bg='#f5f5f5')
        time_frame.pack(side='right')
        
        self.time_label = Label(time_frame, text="00:00 / 00:00", 
                               font=('Arial', 12), 
                               bg='#f5f5f5', fg='#666')
        self.time_label.pack()
        
        # 进度条
        self.progress_var = tk.DoubleVar()
        self.progress_scale = Scale(control_frame, from_=0, to=100, 
                                   orient='horizontal', 
                                   variable=self.progress_var,
                                   command=self.on_progress_change,
                                   length=400, resolution=0.1)
        self.progress_scale.pack(fill='x', pady=10)
    
    def load_data_directory(self):
        """加载data目录中的文件"""
        data_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data')
        if not os.path.exists(data_dir):
            os.makedirs(data_dir)
        
        # 清空列表
        self.file_listbox.delete(0, tk.END)
        
        # 扫描PCM文件
        pcm_files = []
        for filename in os.listdir(data_dir):
            if filename.lower().endswith('.pcm'):
                filepath = os.path.join(data_dir, filename)
                stat = os.stat(filepath)
                pcm_files.append({
                    'name': filename,
                    'path': filepath,
                    'size': stat.st_size,
                    'mtime': stat.st_mtime
                })
        
        # 按修改时间排序
        pcm_files.sort(key=lambda x: x['mtime'], reverse=True)
        
        # 添加到列表
        for file_info in pcm_files:
            size_mb = file_info['size'] / (1024 * 1024)
            display_text = f"{file_info['name']} ({size_mb:.1f} MB)"
            self.file_listbox.insert(tk.END, display_text)
            self.file_listbox.file_data = pcm_files  # 存储文件数据
    
    def select_file(self):
        """选择PCM文件"""
        file_path = filedialog.askopenfilename(
            title="选择PCM文件",
            filetypes=[("PCM files", "*.pcm"), ("All files", "*.*")]
        )
        if file_path:
            self.load_pcm_file(file_path)
    
    def on_file_select(self, event):
        """文件列表选择事件"""
        selection = self.file_listbox.curselection()
        if selection and hasattr(self.file_listbox, 'file_data'):
            file_info = self.file_listbox.file_data[selection[0]]
            self.load_pcm_file(file_info['path'])
    
    def load_pcm_file(self, file_path):
        """加载PCM文件"""
        try:
            with open(file_path, 'rb') as f:
                data = f.read()
            
            # 解析PCM数据
            self.audio_data = self.parse_pcm_data(data)
            self.duration = len(self.audio_data) / self.sample_rate
            self.current_time = 0
            
            # 生成波形数据
            self.generate_waveform()
            
            # 更新UI
            filename = os.path.basename(file_path)
            self.file_label.config(text=f"当前文件: {filename}")
            self.play_btn.config(state='normal')
            self.stop_btn.config(state='normal')
            
            # 绘制波形
            self.draw_waveform()
            self.update_time_display()
            
        except Exception as e:
            messagebox.showerror("错误", f"加载文件失败: {str(e)}")
    
    def parse_pcm_data(self, data):
        """解析PCM数据"""
        # 16位小端序PCM数据
        samples = []
        for i in range(0, len(data), 2):
            if i + 1 < len(data):
                sample = struct.unpack('<h', data[i:i+2])[0]  # 16位小端序
                samples.append(sample / 32768.0)  # 归一化到[-1, 1]
        return samples
    
    def generate_waveform(self):
        """生成波形数据"""
        if not self.audio_data:
            return
        
        # 降采样到画布宽度
        step = max(1, len(self.audio_data) // self.canvas_width)
        self.waveform_data = []
        
        for i in range(0, len(self.audio_data), step):
            chunk = self.audio_data[i:i+step]
            if chunk:
                max_val = max(chunk)
                min_val = min(chunk)
                self.waveform_data.append((max_val, min_val))
    
    def draw_waveform(self):
        """绘制波形"""
        if not self.waveform_data:
            return
        
        self.canvas.delete("all")
        
        # 绘制网格
        self.draw_grid()
        
        # 绘制波形
        center_y = self.canvas_height // 2
        scale = center_y * 0.8
        
        for i, (max_val, min_val) in enumerate(self.waveform_data):
            x = i
            y1 = center_y - max_val * scale
            y2 = center_y - min_val * scale
            
            self.canvas.create_line(x, y1, x, y2, fill='#2196F3', width=1)
        
        # 绘制播放指示线
        self.draw_playhead()
    
    def draw_grid(self):
        """绘制网格"""
        # 垂直网格
        for x in range(0, self.canvas_width, 50):
            self.canvas.create_line(x, 0, x, self.canvas_height, fill='#eee', width=1)
        
        # 水平网格
        for y in range(0, self.canvas_height, 20):
            self.canvas.create_line(0, y, self.canvas_width, y, fill='#eee', width=1)
        
        # 中心线
        center_y = self.canvas_height // 2
        self.canvas.create_line(0, center_y, self.canvas_width, center_y, fill='#ddd', width=1)
    
    def draw_playhead(self):
        """绘制播放指示线"""
        if self.duration > 0:
            x = (self.current_time / self.duration) * self.canvas_width
            self.canvas.create_line(x, 0, x, self.canvas_height, fill='#1976D2', width=2)
    
    def on_canvas_click(self, event):
        """画布点击事件"""
        if self.duration > 0:
            x = event.x
            self.current_time = (x / self.canvas_width) * self.duration
            self.update_time_display()
            self.draw_playhead()
    
    def on_canvas_drag(self, event):
        """画布拖拽事件"""
        if self.duration > 0:
            x = event.x
            self.current_time = max(0, min(self.duration, (x / self.canvas_width) * self.duration))
            self.update_time_display()
            self.draw_playhead()
    
    def on_progress_change(self, value):
        """进度条变化事件"""
        if self.duration > 0:
            self.current_time = (float(value) / 100) * self.duration
            self.update_time_display()
            self.draw_playhead()
    
    def toggle_play(self):
        """切换播放状态"""
        if self.is_playing:
            self.pause()
        else:
            self.play()
    
    def play(self):
        """开始播放"""
        if not self.audio_data:
            return
        
        self.is_playing = True
        self.play_btn.config(text="暂停")
        
        # 在新线程中播放
        self.play_thread = threading.Thread(target=self.play_audio)
        self.play_thread.daemon = True
        self.play_thread.start()
    
    def pause(self):
        """暂停播放"""
        self.is_playing = False
        self.play_btn.config(text="播放")
    
    def stop(self):
        """停止播放"""
        self.is_playing = False
        self.current_time = 0
        self.play_btn.config(text="播放")
        self.update_time_display()
        self.draw_playhead()
    
    def play_audio(self):
        """播放音频（模拟）"""
        start_time = time.time()
        
        while self.is_playing and self.current_time < self.duration:
            elapsed = time.time() - start_time
            self.current_time = elapsed
            
            # 更新UI（在主线程中）
            self.root.after(0, self.update_time_display)
            self.root.after(0, self.draw_playhead)
            self.root.after(0, self.update_progress)
            
            time.sleep(0.1)
        
        # 播放结束
        if self.is_playing:
            self.root.after(0, self.stop)
    
    def update_time_display(self):
        """更新时间显示"""
        current_str = self.format_time(self.current_time)
        total_str = self.format_time(self.duration)
        self.time_label.config(text=f"{current_str} / {total_str}")
    
    def update_progress(self):
        """更新进度条"""
        if self.duration > 0:
            progress = (self.current_time / self.duration) * 100
            self.progress_var.set(progress)
    
    def format_time(self, seconds):
        """格式化时间"""
        mins = int(seconds // 60)
        secs = int(seconds % 60)
        return f"{mins:02d}:{secs:02d}"

def main():
    """主函数"""
    # 获取可执行文件所在目录
    if getattr(sys, 'frozen', False):
        base_dir = os.path.dirname(sys.executable)
    else:
        base_dir = os.path.dirname(os.path.abspath(__file__))
    
    # 创建data目录
    data_dir = os.path.join(base_dir, 'data')
    if not os.path.exists(data_dir):
        os.makedirs(data_dir)
        print(f"已创建data目录: {data_dir}")
    
    # 创建GUI应用
    root = tk.Tk()
    app = PCMPlayerGUI(root)
    
    try:
        root.mainloop()
    except KeyboardInterrupt:
        print("\n程序已退出")

if __name__ == '__main__':
    main()
