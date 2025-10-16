#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
简单PCM播放器服务器
支持Windows和Mac系统，双击运行
"""

import os
import sys
import json
import time
import webbrowser
from http.server import HTTPServer, SimpleHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
import mimetypes

class PCMPlayerHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        # 设置data目录路径
        self.data_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data')
        super().__init__(*args, **kwargs)
    
    def do_GET(self):
        """处理GET请求"""
        parsed_path = urlparse(self.path)
        path = parsed_path.path
        
        try:
            if path == '/api/files':
                # 返回文件列表
                self.handle_file_list()
            elif path.startswith('/api/play/'):
                # 返回PCM文件内容
                filename = path[10:]  # 移除 '/api/play/'
                self.handle_play_file(filename)
            else:
                # 默认处理静态文件
                super().do_GET()
        except Exception as e:
            self.send_error(500, f"服务器错误: {str(e)}")
    
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
                    if os.path.isfile(filepath):
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
    
    def log_message(self, format, *args):
        """自定义日志格式"""
        timestamp = time.strftime('%Y-%m-%d %H:%M:%S')
        print(f"[{timestamp}] {format % args}")

def find_free_port(start_port=8000, max_port=8100):
    """查找可用端口"""
    import socket
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
    print("简单PCM播放器服务器")
    print("=" * 50)
    
    # 查找可用端口
    port = find_free_port()
    if port is None:
        print("错误: 无法找到可用端口")
        input("按回车键退出...")
        return
    
    # 创建data目录
    data_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data')
    if not os.path.exists(data_dir):
        os.makedirs(data_dir)
        print(f"已创建data目录: {data_dir}")
        print("请将PCM文件放入data目录中")
    
    # 启动服务器
    try:
        server = HTTPServer(('localhost', port), PCMPlayerHandler)
        print(f"服务器启动成功!")
        print(f"访问地址: http://localhost:{port}")
        print(f"PCM文件目录: {data_dir}")
        print("\n按 Ctrl+C 停止服务器")
        
        # 自动打开浏览器
        try:
            webbrowser.open(f'http://localhost:{port}')
            print("已自动打开浏览器")
        except:
            print("无法自动打开浏览器，请手动访问上述地址")
        
        print("\n" + "=" * 50)
        server.serve_forever()
        
    except KeyboardInterrupt:
        print("\n\n服务器已停止")
    except Exception as e:
        print(f"服务器启动失败: {e}")
        input("按回车键退出...")

if __name__ == '__main__':
    main()
