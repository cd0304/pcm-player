#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
测试桌面PCM播放器
直接运行，不打包
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

class TestPCMPlayerHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        self.base_dir = os.path.dirname(os.path.abspath(__file__))
        self.data_dir = os.path.join(self.base_dir, 'data')
        super().__init__(*args, **kwargs)
    
    def do_GET(self):
        parsed_path = urlparse(self.path)
        path = parsed_path.path
        
        try:
            if path == '/':
                self.serve_html()
            elif path == '/api/files':
                self.handle_file_list()
            elif path.startswith('/api/play/'):
                filename = path[10:]
                self.handle_play_file(filename)
            else:
                self.serve_static_file(path)
        except Exception as e:
            self.send_error(500, f"服务器错误: {str(e)}")
    
    def serve_html(self):
        html_content = '''<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>测试PCM播放器</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        .container { max-width: 800px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { background: #2196F3; color: white; padding: 20px; text-align: center; border-radius: 6px; margin-bottom: 20px; }
        .file-item { padding: 10px; border: 1px solid #ddd; margin: 5px 0; cursor: pointer; border-radius: 4px; }
        .file-item:hover { background: #e3f2fd; }
        .controls { margin: 20px 0; }
        button { padding: 10px 20px; margin: 5px; border: none; border-radius: 4px; cursor: pointer; }
        .play-btn { background: #4CAF50; color: white; }
        .stop-btn { background: #f44336; color: white; }
        .progress { width: 100%; height: 6px; background: #ddd; border-radius: 3px; margin: 10px 0; }
        .progress-bar { height: 100%; background: #2196F3; width: 0%; transition: width 0.1s; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>测试PCM播放器</h1>
            <p>16kHz, 16bit, 单声道, 小端序</p>
        </div>
        
        <div id="loading">正在扫描data目录...</div>
        <div id="fileList" style="display: none;">
            <h3>PCM文件列表：</h3>
            <div id="fileItems"></div>
        </div>
        
        <div class="controls">
            <button id="playBtn" class="play-btn" disabled>播放</button>
            <button id="stopBtn" class="stop-btn" disabled>停止</button>
            <div class="progress">
                <div id="progressBar" class="progress-bar"></div>
            </div>
            <div id="timeDisplay">00:00 / 00:00</div>
        </div>
    </div>

    <script>
        class TestPCMPlayer {
            constructor() {
                this.audioContext = null;
                this.audioBuffer = null;
                this.source = null;
                this.isPlaying = false;
                this.currentTime = 0;
                this.duration = 0;
                this.currentFile = null;
                this.init();
            }
            
            async init() {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
                this.bindEvents();
                await this.loadFileList();
            }
            
            bindEvents() {
                document.getElementById('playBtn').addEventListener('click', () => this.togglePlay());
                document.getElementById('stopBtn').addEventListener('click', () => this.stop());
            }
            
            async loadFileList() {
                try {
                    const response = await fetch('/api/files');
                    const files = await response.json();
                    this.renderFileList(files);
                    document.getElementById('loading').style.display = 'none';
                    document.getElementById('fileList').style.display = 'block';
                } catch (error) {
                    console.error('加载文件列表失败:', error);
                }
            }
            
            renderFileList(files) {
                const fileItems = document.getElementById('fileItems');
                if (files.length === 0) {
                    fileItems.innerHTML = '<p>data目录中未找到PCM文件</p>';
                } else {
                    fileItems.innerHTML = '';
                    files.forEach(file => {
                        const fileItem = document.createElement('div');
                        fileItem.className = 'file-item';
                        fileItem.innerHTML = `
                            <strong>${file.name}</strong> 
                            (${this.formatFileSize(file.size)}) 
                            - ${file.mtime}
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
                    
                    const response = await fetch(`/api/play/${encodeURIComponent(file.name)}`);
                    const arrayBuffer = await response.arrayBuffer();
                    await this.decodePCM(arrayBuffer);
                    
                    document.getElementById('playBtn').disabled = false;
                    document.getElementById('stopBtn').disabled = false;
                } catch (error) {
                    console.error('加载文件失败:', error);
                }
            }
            
            async decodePCM(arrayBuffer) {
                const sampleRate = 16000;
                const bitDepth = 16;
                const channels = 1;
                const bytesPerSample = bitDepth / 8;
                const totalSamples = Math.floor(arrayBuffer.byteLength / (bytesPerSample * channels));
                
                this.audioBuffer = this.audioContext.createBuffer(channels, totalSamples, sampleRate);
                const view = new DataView(arrayBuffer);
                const channelData = this.audioBuffer.getChannelData(0);
                
                for (let i = 0; i < totalSamples; i++) {
                    const offset = i * bytesPerSample;
                    const sample = view.getInt16(offset, true) / 32768.0;
                    channelData[i] = sample;
                }
                
                this.duration = this.audioBuffer.duration;
                this.currentTime = 0;
                this.updateTimeDisplay();
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
                
                const startTime = this.currentTime;
                this.source.start(0, startTime);
                
                this.isPlaying = true;
                this.startTime = this.audioContext.currentTime - startTime;
                
                document.getElementById('playBtn').textContent = '暂停';
                this.startTimeUpdate();
                
                this.source.onended = () => this.stop();
            }
            
            pause() {
                if (this.source) {
                    this.source.stop();
                    this.source = null;
                }
                this.isPlaying = false;
                this.currentTime = this.audioContext.currentTime - this.startTime;
                document.getElementById('playBtn').textContent = '播放';
            }
            
            stop() {
                if (this.source) {
                    this.source.stop();
                    this.source = null;
                }
                this.isPlaying = false;
                this.currentTime = 0;
                document.getElementById('playBtn').textContent = '播放';
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
        }
        
        window.addEventListener('load', () => new TestPCMPlayer());
    </script>
</body>
</html>'''
        
        self.send_response(200)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.end_headers()
        self.wfile.write(html_content.encode('utf-8'))
    
    def serve_static_file(self, path):
        self.send_error(404, "文件未找到")
    
    def handle_file_list(self):
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
        try:
            if '..' in filename or '/' in filename or '\\' in filename:
                self.send_error(400, "无效的文件名")
                return
            
            filepath = os.path.join(self.data_dir, filename)
            
            if not os.path.exists(filepath):
                self.send_error(404, "文件不存在")
                return
            
            self.send_response(200)
            self.send_header('Content-Type', 'application/octet-stream')
            self.send_header('Content-Disposition', f'inline; filename="{filename}"')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            
            with open(filepath, 'rb') as f:
                self.wfile.write(f.read())
                
        except Exception as e:
            self.send_error(500, f"读取文件失败: {str(e)}")

def find_free_port(start_port=8000, max_port=8100):
    for port in range(start_port, max_port):
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.bind(('localhost', port))
                return port
        except OSError:
            continue
    return None

def main():
    print("=" * 50)
    print("测试PCM播放器")
    print("=" * 50)
    
    port = find_free_port()
    if port is None:
        print("错误: 无法找到可用端口")
        return
    
    # 创建data目录
    data_dir = 'data'
    if not os.path.exists(data_dir):
        os.makedirs(data_dir)
        print(f"已创建data目录: {data_dir}")
        print("请将PCM文件放入data目录中")
    
    try:
        server = HTTPServer(('localhost', port), TestPCMPlayerHandler)
        print(f"服务器启动成功!")
        print(f"访问地址: http://localhost:{port}")
        print(f"PCM文件目录: {data_dir}")
        print("\n按 Ctrl+C 停止服务器")
        
        # 自动打开浏览器
        def open_browser():
            time.sleep(1)
            try:
                webbrowser.open(f'http://localhost:{port}')
                print("已自动打开浏览器")
            except:
                print("无法自动打开浏览器，请手动访问上述地址")
        
        browser_thread = threading.Thread(target=open_browser)
        browser_thread.daemon = True
        browser_thread.start()
        
        server.serve_forever()
        
    except KeyboardInterrupt:
        print("\n\n服务器已停止")
    except Exception as e:
        print(f"服务器启动失败: {e}")

if __name__ == '__main__':
    main()
