#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
使用PyInstaller将Python应用打包成独立可执行文件
"""

import os
import sys
import subprocess
import shutil

def build_standalone():
    """构建独立可执行文件"""
    
    print("开始构建PCM播放器...")
    
    # 检查PyInstaller是否安装
    try:
        import PyInstaller
    except ImportError:
        print("正在安装PyInstaller...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "pyinstaller"])
    
    # 创建构建脚本
    build_script = """
import os
import sys
import webbrowser
from http.server import HTTPServer, SimpleHTTPRequestHandler
from urllib.parse import urlparse
import json
import time
import mimetypes

class PCMPlayerHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        self.data_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data')
        super().__init__(*args, **kwargs)
    
    def do_GET(self):
        parsed_path = urlparse(self.path)
        path = parsed_path.path
        
        try:
            if path == '/api/files':
                self.handle_file_list()
            elif path.startswith('/api/play/'):
                filename = path[10:]
                self.handle_play_file(filename)
            else:
                super().do_GET()
        except Exception as e:
            self.send_error(500, f"服务器错误: {str(e)}")
    
    def handle_file_list(self):
        try:
            if not os.path.exists(self.data_dir):
                os.makedirs(self.data_dir)
                files = []
            else:
                files = []
                for filename in os.listdir(self.data_dir):
                    filepath = os.path.join(self.data_dir, filename)
                    if os.path.isfile(filepath):
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
            if '..' in filename or '/' in filename or '\\\\' in filename:
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

def main():
    print("PCM播放器启动中...")
    
    # 查找可用端口
    import socket
    port = 8000
    for p in range(8000, 8100):
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.bind(('localhost', p))
                port = p
                break
        except OSError:
            continue
    
    # 创建data目录
    data_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data')
    if not os.path.exists(data_dir):
        os.makedirs(data_dir)
        print(f"已创建data目录: {data_dir}")
    
    try:
        server = HTTPServer(('localhost', port), PCMPlayerHandler)
        print(f"服务器启动成功! 访问: http://localhost:{port}")
        
        # 自动打开浏览器
        try:
            webbrowser.open(f'http://localhost:{port}')
        except:
            pass
        
        server.serve_forever()
        
    except KeyboardInterrupt:
        print("\\n服务器已停止")
    except Exception as e:
        print(f"服务器启动失败: {e}")

if __name__ == '__main__':
    main()
"""
    
    # 写入构建脚本
    with open('pcm_player_app.py', 'w', encoding='utf-8') as f:
        f.write(build_script)
    
    # 复制HTML文件
    if os.path.exists('simple-pcm-player.html'):
        shutil.copy('simple-pcm-player.html', 'simple-pcm-player.html')
    
    # 构建命令
    build_cmd = [
        'pyinstaller',
        '--onefile',  # 打包成单个文件
        '--windowed',  # 无控制台窗口
        '--name', 'PCM播放器',
        '--add-data', 'simple-pcm-player.html;.',
        '--add-data', 'data;data',
        'pcm_player_app.py'
    ]
    
    print("正在构建可执行文件...")
    subprocess.run(build_cmd)
    
    print("构建完成!")
    print("可执行文件位置: dist/PCM播放器.exe")
    print("使用方法: 双击运行，将PCM文件放入data目录")

if __name__ == '__main__':
    build_standalone()
