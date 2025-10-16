#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
桌面版PCM播放器
使用PyInstaller打包成独立可执行文件
"""

import os
import sys
import webbrowser
import threading
import time
from http.server import HTTPServer, SimpleHTTPRequestHandler
from urllib.parse import urlparse
import json
import socket

class DesktopPCMPlayerHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        # 获取可执行文件所在目录
        if getattr(sys, 'frozen', False):
            # 打包后的可执行文件
            self.base_dir = os.path.dirname(sys.executable)
        else:
            # 开发环境
            self.base_dir = os.path.dirname(os.path.abspath(__file__))
        
        self.data_dir = os.path.join(self.base_dir, 'data')
        super().__init__(*args, **kwargs)
    
    def do_GET(self):
        """处理GET请求"""
        parsed_path = urlparse(self.path)
        path = parsed_path.path
        
        try:
            if path == '/':
                # 返回主页面
                self.serve_html()
            elif path == '/api/files':
                # 返回文件列表
                self.handle_file_list()
            elif path.startswith('/api/play/'):
                # 返回PCM文件内容
                filename = path[10:]  # 移除 '/api/play/'
                self.handle_play_file(filename)
            else:
                # 返回静态文件
                self.serve_static_file(path)
        except Exception as e:
            self.send_error(500, f"服务器错误: {str(e)}")
    
    def serve_html(self):
        """返回HTML页面"""
        html_content = self.get_html_content()
        
        self.send_response(200)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.end_headers()
        self.wfile.write(html_content.encode('utf-8'))
    
    def serve_static_file(self, path):
        """返回静态文件"""
        if path == '/style.css':
            self.send_response(200)
            self.send_header('Content-Type', 'text/css')
            self.end_headers()
            self.wfile.write(self.get_css_content().encode('utf-8'))
        elif path == '/script.js':
            self.send_response(200)
            self.send_header('Content-Type', 'application/javascript')
            self.end_headers()
            self.wfile.write(self.get_js_content().encode('utf-8'))
        else:
            self.send_error(404, "文件未找到")
    
    def handle_file_list(self):
        """处理文件列表请求"""
        try:
            if not os.path.exists(self.data_dir):
                os.makedirs(self.data_dir)
                files = []
            else:
                files = []
                for filename in os.listdir(self.data_dir):
                    filepath = os.path.join(self.data_dir, filename)
                    if os.path.isfile(filepath) and filename.lower().endswith('.pcm'):
                        stat = os.stat(filepath)
                        files.append({
                            'name': filename,
                            'size': stat.st_size,
                            'mtime': time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(stat.st_mtime))
                        })
            
            # 按修改时间降序排序
            files.sort(key=lambda x: x['mtime'], reverse=True)
            
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            
            response = json.dumps(files, ensure_ascii=False)
            self.wfile.write(response.encode('utf-8'))
            
        except Exception as e:
            self.send_error(500, f"获取文件列表失败: {str(e)}")
    
    def handle_play_file(self, filename):
        """处理播放文件请求"""
        try:
            # 安全检查，防止路径遍历攻击
            if '..' in filename or '/' in filename or '\\' in filename:
                self.send_error(400, "无效的文件名")
                return
            
            filepath = os.path.join(self.data_dir, filename)
            
            if not os.path.exists(filepath):
                self.send_error(404, "文件不存在")
                return
            
            # 设置PCM文件的MIME类型
            self.send_response(200)
            self.send_header('Content-Type', 'application/octet-stream')
            self.send_header('Content-Disposition', f'inline; filename="{filename}"')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            
            # 读取并发送文件内容
            with open(filepath, 'rb') as f:
                self.wfile.write(f.read())
                
        except Exception as e:
            self.send_error(500, f"读取文件失败: {str(e)}")
    
    def get_html_content(self):
        """获取HTML内容"""
        return '''<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>桌面PCM播放器</title>
    <link rel="stylesheet" href="/style.css">
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>桌面PCM播放器</h1>
            <p>16kHz, 16bit, 单声道, 小端序 - 自动扫描data目录</p>
        </div>
        
        <div class="instructions">
            <h3>使用说明</h3>
            <p>1. 将PCM文件放入程序目录下的data文件夹中</p>
            <p>2. 程序会自动扫描并列出所有PCM文件</p>
            <p>3. 点击文件列表中的文件进行播放</p>
            <p>4. 支持格式：16kHz采样率，16bit位深度，单声道，小端序</p>
        </div>
        
        <div id="loading" class="loading">
            正在扫描data目录...
        </div>
        
        <div id="error" class="error" style="display: none;"></div>
        
        <div id="currentFile" class="current-file" style="display: none;"></div>
        
        <div id="fileList" class="file-list" style="display: none;">
            <h3>data目录中的PCM文件：</h3>
            <div id="fileItems"></div>
        </div>
        
        <div class="waveform">
            <canvas id="waveformCanvas"></canvas>
        </div>
        
        <div class="controls">
            <button id="playButton" class="play-button" disabled>播放</button>
            <button id="stopButton" class="stop-button" disabled>停止</button>
            <div class="progress">
                <div id="progressBar" class="progress-bar"></div>
            </div>
            <div id="timeDisplay" class="time-display">00:00 / 00:00</div>
        </div>
    </div>

    <script src="/script.js"></script>
</body>
</html>'''
    
    def get_css_content(self):
        """获取CSS内容"""
        return '''body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    margin: 0;
    padding: 20px;
    background: #f5f5f5;
}

.container {
    max-width: 800px;
    margin: 0 auto;
    background: white;
    border-radius: 8px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    overflow: hidden;
}

.header {
    background: #2196F3;
    color: white;
    padding: 20px;
    text-align: center;
}

.header h1 {
    margin: 0;
    font-size: 24px;
}

.header p {
    margin: 10px 0 0 0;
    opacity: 0.9;
    font-size: 14px;
}

.instructions {
    padding: 20px;
    background: #e3f2fd;
    border-left: 4px solid #2196F3;
    margin: 20px;
    border-radius: 4px;
}

.instructions h3 {
    margin: 0 0 10px 0;
    color: #1976D2;
}

.instructions p {
    margin: 5px 0;
    color: #424242;
}

.loading {
    text-align: center;
    padding: 40px;
    color: #666;
}

.error {
    background: #ffebee;
    color: #c62828;
    padding: 15px;
    margin: 10px 20px;
    border-radius: 4px;
    border-left: 4px solid #f44336;
}

.current-file {
    padding: 15px 20px;
    background: #e8f5e9;
    border-left: 4px solid #4CAF50;
    margin: 0;
    font-weight: 500;
    color: #2e7d32;
}

.file-list {
    padding: 20px;
}

.file-list h3 {
    margin: 0 0 15px 0;
    color: #333;
    font-size: 16px;
}

.file-item {
    display: flex;
    align-items: center;
    padding: 10px;
    border: 1px solid #e0e0e0;
    border-radius: 6px;
    margin-bottom: 8px;
    cursor: pointer;
    transition: all 0.2s;
    background: #fafafa;
}

.file-item:hover {
    background: #e3f2fd;
    border-color: #2196F3;
}

.file-item.playing {
    background: #e8f5e9;
    border-color: #4CAF50;
}

.file-name {
    flex: 1;
    font-weight: 500;
    color: #333;
}

.file-size {
    color: #666;
    font-size: 12px;
    margin-left: 10px;
}

.file-time {
    color: #999;
    font-size: 12px;
    margin-left: 10px;
}

.waveform {
    height: 120px;
    background: #f8f9fa;
    border: 1px solid #e0e0e0;
    margin: 20px;
    border-radius: 6px;
    position: relative;
    overflow: hidden;
}

.waveform canvas {
    width: 100%;
    height: 100%;
}

.controls {
    padding: 20px;
    background: #f8f9fa;
    display: flex;
    align-items: center;
    gap: 15px;
}

.play-button {
    background: #4CAF50;
    color: white;
    border: none;
    padding: 12px 24px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    transition: background 0.2s;
}

.play-button:hover:not(:disabled) {
    background: #43A047;
}

.play-button:disabled {
    background: #ccc;
    cursor: not-allowed;
}

.stop-button {
    background: #f44336;
    color: white;
    border: none;
    padding: 12px 24px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    transition: background 0.2s;
}

.stop-button:hover:not(:disabled) {
    background: #d32f2f;
}

.stop-button:disabled {
    background: #ccc;
    cursor: not-allowed;
}

.progress {
    flex: 1;
    height: 6px;
    background: #e0e0e0;
    border-radius: 3px;
    overflow: hidden;
    margin: 0 15px;
}

.progress-bar {
    height: 100%;
    background: #2196F3;
    width: 0%;
    transition: width 0.1s;
}

.time-display {
    color: #666;
    font-size: 14px;
    min-width: 100px;
    text-align: center;
}'''
    
    def get_js_content(self):
        """获取JavaScript内容"""
        return '''class DesktopPCMPlayer {
    constructor() {
        this.audioContext = null;
        this.audioBuffer = null;
        this.source = null;
        this.isPlaying = false;
        this.currentTime = 0;
        this.duration = 0;
        this.currentFile = null;
        this.canvas = null;
        this.ctx = null;
        this.wavePoints = [];
        
        this.init();
    }
    
    async init() {
        try {
            // 初始化Web Audio API
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            // 初始化画布
            this.canvas = document.getElementById('waveformCanvas');
            this.ctx = this.canvas.getContext('2d');
            this.resizeCanvas();
            
            // 绑定事件
            this.bindEvents();
            
            // 监听窗口大小变化
            window.addEventListener('resize', () => this.resizeCanvas());
            
            // 自动加载文件列表
            await this.loadFileList();
            
        } catch (error) {
            this.showError('初始化失败: ' + error.message);
        }
    }
    
    resizeCanvas() {
        const rect = this.canvas.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
        this.drawWaveform();
    }
    
    bindEvents() {
        // 播放控制
        document.getElementById('playButton').addEventListener('click', () => this.togglePlay());
        document.getElementById('stopButton').addEventListener('click', () => this.stop());
    }
    
    async loadFileList() {
        try {
            const response = await fetch('/api/files');
            if (!response.ok) {
                throw new Error('无法获取文件列表');
            }
            
            const files = await response.json();
            this.renderFileList(files);
            
            document.getElementById('loading').style.display = 'none';
            document.getElementById('fileList').style.display = 'block';
            
        } catch (error) {
            this.showError('加载文件列表失败: ' + error.message);
        }
    }
    
    renderFileList(files) {
        const fileItems = document.getElementById('fileItems');
        
        if (files.length === 0) {
            fileItems.innerHTML = '<p style="color: #666; text-align: center; padding: 20px;">data目录中未找到PCM文件</p>';
        } else {
            fileItems.innerHTML = '';
            
            files.forEach((file, index) => {
                const fileItem = document.createElement('div');
                fileItem.className = 'file-item';
                fileItem.innerHTML = `
                    <div class="file-name">${file.name}</div>
                    <div class="file-size">${this.formatFileSize(file.size)}</div>
                    <div class="file-time">${file.mtime}</div>
                `;
                
                fileItem.addEventListener('click', () => this.loadFile(file));
                fileItems.appendChild(fileItem);
            });
        }
    }
    
    async loadFile(file) {
        try {
            this.stop();
            this.currentFile = file;
            
            // 更新当前文件显示
            document.getElementById('currentFile').textContent = `当前文件: ${file.name}`;
            document.getElementById('currentFile').style.display = 'block';
            
            // 更新文件项样式
            document.querySelectorAll('.file-item').forEach(item => {
                item.classList.remove('playing');
            });
            event.currentTarget.classList.add('playing');
            
            // 加载PCM文件
            const response = await fetch(`/api/play/${encodeURIComponent(file.name)}`);
            if (!response.ok) {
                throw new Error('无法加载文件');
            }
            
            const arrayBuffer = await response.arrayBuffer();
            await this.decodePCM(arrayBuffer);
            
            // 绘制波形
            this.drawWaveform();
            
            // 启用播放按钮
            document.getElementById('playButton').disabled = false;
            document.getElementById('stopButton').disabled = false;
            
        } catch (error) {
            this.showError('加载文件失败: ' + error.message);
        }
    }
    
    async decodePCM(arrayBuffer) {
        // PCM参数：16kHz, 16bit, 单声道, 小端序
        const sampleRate = 16000;
        const bitDepth = 16;
        const channels = 1;
        const bytesPerSample = bitDepth / 8;
        
        // 计算样本数
        const totalSamples = Math.floor(arrayBuffer.byteLength / (bytesPerSample * channels));
        
        // 创建AudioBuffer
        this.audioBuffer = this.audioContext.createBuffer(channels, totalSamples, sampleRate);
        
        // 解析PCM数据
        const view = new DataView(arrayBuffer);
        const channelData = this.audioBuffer.getChannelData(0);
        
        for (let i = 0; i < totalSamples; i++) {
            const offset = i * bytesPerSample;
            // 16位小端序
            const sample = view.getInt16(offset, true) / 32768.0;
            channelData[i] = sample;
        }
        
        this.duration = this.audioBuffer.duration;
        this.currentTime = 0;
        this.updateTimeDisplay();
        
        // 存储波形数据用于绘制
        this.wavePoints = Array.from(channelData);
    }
    
    drawWaveform() {
        if (!this.wavePoints.length) return;
        
        const width = this.canvas.width;
        const height = this.canvas.height;
        const centerY = height / 2;
        
        this.ctx.clearRect(0, 0, width, height);
        
        // 绘制网格
        this.drawGrid();
        
        // 绘制波形
        const step = Math.ceil(this.wavePoints.length / width);
        this.ctx.strokeStyle = '#2196F3';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        
        for (let i = 0; i < width; i++) {
            const start = i * step;
            let maxAbs = 0;
            
            // 计算峰值
            for (let j = 0; j < step && start + j < this.wavePoints.length; j++) {
                const v = Math.abs(this.wavePoints[start + j]);
                if (v > maxAbs) maxAbs = v;
            }
            
            const amp = maxAbs * centerY * 0.8;
            const x = i;
            const y1 = centerY - amp;
            const y2 = centerY + amp;
            
            if (i === 0) {
                this.ctx.moveTo(x, y1);
            } else {
                this.ctx.lineTo(x, y1);
            }
            this.ctx.moveTo(x, y2);
        }
        
        this.ctx.stroke();
    }
    
    drawGrid() {
        const width = this.canvas.width;
        const height = this.canvas.height;
        
        this.ctx.save();
        this.ctx.strokeStyle = '#eee';
        this.ctx.lineWidth = 1;
        
        // 垂直网格
        for (let x = 0; x <= width; x += 50) {
            this.ctx.beginPath();
            this.ctx.moveTo(x + 0.5, 0);
            this.ctx.lineTo(x + 0.5, height);
            this.ctx.stroke();
        }
        
        // 水平网格
        for (let y = 0; y <= height; y += 20) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y + 0.5);
            this.ctx.lineTo(width, y + 0.5);
            this.ctx.stroke();
        }
        
        // 中心线
        this.ctx.strokeStyle = '#ddd';
        this.ctx.beginPath();
        this.ctx.moveTo(0, height / 2 + 0.5);
        this.ctx.lineTo(width, height / 2 + 0.5);
        this.ctx.stroke();
        
        this.ctx.restore();
    }
    
    togglePlay() {
        if (this.isPlaying) {
            this.pause();
        } else {
            this.play();
        }
    }
    
    play() {
        if (!this.audioBuffer) return;
        
        this.source = this.audioContext.createBufferSource();
        this.source.buffer = this.audioBuffer;
        this.source.connect(this.audioContext.destination);
        
        // 从当前位置开始播放
        const startTime = this.currentTime;
        this.source.start(0, startTime);
        
        this.isPlaying = true;
        this.startTime = this.audioContext.currentTime - startTime;
        
        // 更新按钮状态
        document.getElementById('playButton').textContent = '暂停';
        
        // 开始时间更新
        this.startTimeUpdate();
        
        // 播放结束处理
        this.source.onended = () => {
            this.stop();
        };
    }
    
    pause() {
        if (this.source) {
            this.source.stop();
            this.source = null;
        }
        
        this.isPlaying = false;
        this.currentTime = this.audioContext.currentTime - this.startTime;
        
        // 更新按钮状态
        document.getElementById('playButton').textContent = '播放';
    }
    
    stop() {
        if (this.source) {
            this.source.stop();
            this.source = null;
        }
        
        this.isPlaying = false;
        this.currentTime = 0;
        
        // 更新按钮状态
        document.getElementById('playButton').textContent = '播放';
        this.updateTimeDisplay();
        this.updateProgress();
    }
    
    startTimeUpdate() {
        if (!this.isPlaying) return;
        
        this.currentTime = this.audioContext.currentTime - this.startTime;
        
        if (this.currentTime >= this.duration) {
            this.stop();
            return;
        }
        
        this.updateTimeDisplay();
        this.updateProgress();
        
        requestAnimationFrame(() => this.startTimeUpdate());
    }
    
    updateTimeDisplay() {
        const current = this.formatTime(this.currentTime);
        const total = this.formatTime(this.duration);
        document.getElementById('timeDisplay').textContent = `${current} / ${total}`;
    }
    
    updateProgress() {
        const progress = this.duration > 0 ? (this.currentTime / this.duration) * 100 : 0;
        document.getElementById('progressBar').style.width = progress + '%';
    }
    
    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    
    formatFileSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }
    
    showError(message) {
        const errorEl = document.getElementById('error');
        errorEl.textContent = message;
        errorEl.style.display = 'block';
        
        setTimeout(() => {
            errorEl.style.display = 'none';
        }, 5000);
    }
}

// 页面加载完成后初始化播放器
window.addEventListener('load', () => {
    new DesktopPCMPlayer();
});'''
    
    def log_message(self, format, *args):
        """自定义日志格式"""
        timestamp = time.strftime('%Y-%m-%d %H:%M:%S')
        print(f"[{timestamp}] {format % args}")

def find_free_port(start_port=8000, max_port=8100):
    """查找可用端口"""
    for port in range(start_port, max_port):
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.bind(('localhost', port))
                return port
        except OSError:
            continue
    return None

def main():
    """主函数"""
    print("=" * 50)
    print("桌面PCM播放器")
    print("=" * 50)
    
    # 查找可用端口
    port = find_free_port()
    if port is None:
        print("错误: 无法找到可用端口")
        input("按回车键退出...")
        return
    
    # 创建data目录
    if getattr(sys, 'frozen', False):
        base_dir = os.path.dirname(sys.executable)
    else:
        base_dir = os.path.dirname(os.path.abspath(__file__))
    
    data_dir = os.path.join(base_dir, 'data')
    if not os.path.exists(data_dir):
        os.makedirs(data_dir)
        print(f"已创建data目录: {data_dir}")
        print("请将PCM文件放入data目录中")
    
    # 启动服务器
    try:
        server = HTTPServer(('localhost', port), DesktopPCMPlayerHandler)
        print(f"服务器启动成功!")
        print(f"访问地址: http://localhost:{port}")
        print(f"PCM文件目录: {data_dir}")
        print("\n按 Ctrl+C 停止服务器")
        
        # 自动打开浏览器
        def open_browser():
            time.sleep(1)  # 等待服务器启动
            try:
                webbrowser.open(f'http://localhost:{port}')
                print("已自动打开浏览器")
            except:
                print("无法自动打开浏览器，请手动访问上述地址")
        
        # 在新线程中打开浏览器
        browser_thread = threading.Thread(target=open_browser)
        browser_thread.daemon = True
        browser_thread.start()
        
        print("\n" + "=" * 50)
        server.serve_forever()
        
    except KeyboardInterrupt:
        print("\n\n服务器已停止")
    except Exception as e:
        print(f"服务器启动失败: {e}")
        input("按回车键退出...")

if __name__ == '__main__':
    main()
