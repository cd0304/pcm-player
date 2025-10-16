#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
构建Mac版本的说明脚本
由于无法在Windows上直接构建Mac版本，这里提供替代方案
"""

import os
import sys

def show_mac_build_instructions():
    """显示Mac版本构建说明"""
    
    print("=" * 60)
    print("构建Mac版本PCM播放器")
    print("=" * 60)
    print()
    print("由于无法在Windows上直接构建Mac版本，请使用以下方案：")
    print()
    print("方案1: 使用GitHub Actions (推荐)")
    print("-" * 40)
    print("1. 将代码推送到GitHub仓库")
    print("2. GitHub Actions会自动构建Mac版本")
    print("3. 在Actions页面下载Mac版本")
    print()
    print("方案2: 在Mac电脑上构建")
    print("-" * 40)
    print("1. 将以下文件复制到Mac电脑：")
    print("   - desktop-pcm-player.py")
    print("   - data/ 目录")
    print("2. 在Mac上运行：")
    print("   pip install pyinstaller")
    print("   pyinstaller --onefile --windowed --name 'PCM播放器' --add-data 'data:data' desktop-pcm-player.py")
    print()
    print("方案3: 使用Docker (需要Docker Desktop)")
    print("-" * 40)
    print("1. 安装Docker Desktop")
    print("2. 运行: docker buildx build --platform linux/amd64 -t pcm-player .")
    print()
    print("方案4: 使用云服务")
    print("-" * 40)
    print("1. 使用GitHub Codespaces")
    print("2. 使用Replit")
    print("3. 使用Google Colab")
    print()
    
    # 创建Mac构建脚本
    create_mac_build_script()
    
    print("✓ 已创建Mac构建脚本: build-mac.sh")
    print("✓ 将脚本复制到Mac电脑运行即可")

def create_mac_build_script():
    """创建Mac构建脚本"""
    
    mac_script = '''#!/bin/bash
# Mac版本构建脚本

echo "构建Mac版本PCM播放器..."

# 检查Python
if ! command -v python3 &> /dev/null; then
    echo "错误: 未找到Python3，请先安装Python 3.x"
    echo "可以使用: brew install python3"
    exit 1
fi

# 检查PyInstaller
if ! python3 -c "import PyInstaller" &> /dev/null; then
    echo "正在安装PyInstaller..."
    pip3 install pyinstaller
fi

# 创建data目录
mkdir -p data

# 构建命令
echo "正在构建..."
pyinstaller --onefile --windowed --name "PCM播放器" --add-data "data:data" desktop-pcm-player.py

if [ $? -eq 0 ]; then
    echo "✓ 构建成功!"
    echo "可执行文件位置: dist/PCM播放器"
    echo "使用方法: 双击运行或 ./dist/PCM播放器"
else
    echo "❌ 构建失败"
    exit 1
fi
'''
    
    with open('build-mac.sh', 'w', encoding='utf-8') as f:
        f.write(mac_script)
    
    # 设置执行权限
    os.chmod('build-mac.sh', 0o755)

def create_github_workflow_simple():
    """创建简化的GitHub Actions工作流"""
    
    workflow = '''name: Build PCM Player

on:
  push:
    branches: [ main ]
  workflow_dispatch:

jobs:
  build:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [windows-latest, macos-latest, ubuntu-latest]

    steps:
    - uses: actions/checkout@v3
    
    - name: Set up Python
      uses: actions/setup-python@v4
      with:
        python-version: '3.11'
    
    - name: Install dependencies
      run: pip install pyinstaller
    
    - name: Create data directory
      run: mkdir -p data
    
    - name: Build executable
      run: |
        if [ "${{ matrix.os }}" = "windows-latest" ]; then
          pyinstaller --onefile --windowed --name "PCM播放器" --add-data "data;data" desktop-pcm-player.py
        else
          pyinstaller --onefile --windowed --name "PCM播放器" --add-data "data:data" desktop-pcm-player.py
        fi
    
    - name: Upload Windows executable
      if: matrix.os == 'windows-latest'
      uses: actions/upload-artifact@v3
      with:
        name: pcm-player-windows
        path: dist/PCM播放器.exe
    
    - name: Upload macOS executable
      if: matrix.os == 'macos-latest'
      uses: actions/upload-artifact@v3
      with:
        name: pcm-player-macos
        path: dist/PCM播放器
    
    - name: Upload Linux executable
      if: matrix.os == 'ubuntu-latest'
      uses: actions/upload-artifact@v3
      with:
        name: pcm-player-linux
        path: dist/PCM播放器'''
    
    # 确保目录存在
    os.makedirs('.github/workflows', exist_ok=True)
    
    with open('.github/workflows/build.yml', 'w', encoding='utf-8') as f:
        f.write(workflow)
    
    print("✓ 已创建GitHub Actions工作流")

def main():
    """主函数"""
    show_mac_build_instructions()
    
    print("\n" + "=" * 60)
    print("推荐使用GitHub Actions方案：")
    print("1. 推送代码到GitHub")
    print("2. 自动构建所有平台版本")
    print("3. 下载Mac版本")
    print("=" * 60)

if __name__ == '__main__':
    main()
