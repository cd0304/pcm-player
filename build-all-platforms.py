#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
跨平台构建脚本
使用GitHub Actions自动构建所有平台版本
"""

import os
import sys
import subprocess
import platform

def build_current_platform():
    """构建当前平台版本"""
    
    print("=" * 60)
    print(f"构建PCM播放器 - {platform.system()}")
    print("=" * 60)
    
    # 检查PyInstaller
    try:
        import PyInstaller
        print("✓ PyInstaller 已安装")
    except ImportError:
        print("正在安装PyInstaller...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "pyinstaller"])
        print("✓ PyInstaller 安装完成")
    
    # 创建data目录
    data_dir = 'data'
    if not os.path.exists(data_dir):
        os.makedirs(data_dir)
        print(f"✓ 已创建data目录: {data_dir}")
    
    # 根据平台设置参数
    if platform.system() == "Windows":
        add_data = f"{data_dir};data"
        exe_name = "PCM播放器.exe"
    else:
        add_data = f"{data_dir}:data"
        exe_name = "PCM播放器"
    
    # 构建命令
    build_cmd = [
        'pyinstaller',
        '--onefile',
        '--windowed',
        '--name', 'PCM播放器',
        '--add-data', add_data,
        'desktop-pcm-player.py'
    ]
    
    print("\n正在构建...")
    print(f"命令: {' '.join(build_cmd)}")
    
    try:
        result = subprocess.run(build_cmd, capture_output=True, text=True)
        
        if result.returncode == 0:
            print("✓ 构建成功!")
            
            exe_path = os.path.join('dist', exe_name)
            if os.path.exists(exe_path):
                file_size = os.path.getsize(exe_path) / (1024 * 1024)
                print(f"✓ 可执行文件: {exe_path}")
                print(f"✓ 文件大小: {file_size:.1f} MB")
                print(f"✓ 平台: {platform.system()}")
                return True
            else:
                print("❌ 未找到生成的文件")
                return False
        else:
            print("❌ 构建失败:")
            print(result.stderr)
            return False
            
    except Exception as e:
        print(f"❌ 构建出错: {e}")
        return False

def create_github_workflow():
    """创建GitHub Actions工作流"""
    
    workflow_content = '''name: Build PCM Player for All Platforms

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
        python-version: [3.11]

    steps:
    - uses: actions/checkout@v3
    
    - name: Set up Python ${{ matrix.python-version }}
      uses: actions/setup-python@v4
      with:
        python-version: ${{ matrix.python-version }}
    
    - name: Install dependencies
      run: |
        python -m pip install --upgrade pip
        pip install pyinstaller
    
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
    
    # 创建.github/workflows目录
    os.makedirs('.github/workflows', exist_ok=True)
    
    with open('.github/workflows/build.yml', 'w', encoding='utf-8') as f:
        f.write(workflow_content)
    
    print("✓ 已创建GitHub Actions工作流")
    print("✓ 推送到GitHub后会自动构建所有平台版本")

def main():
    """主函数"""
    print("PCM播放器跨平台构建工具")
    print("=" * 60)
    print("1. 构建当前平台版本")
    print("2. 创建GitHub Actions工作流")
    print("3. 退出")
    
    choice = input("\n请选择 (1-3): ").strip()
    
    if choice == "1":
        if build_current_platform():
            print("\n🎉 当前平台构建成功!")
        else:
            print("\n❌ 构建失败!")
    
    elif choice == "2":
        create_github_workflow()
        print("\n✓ GitHub Actions工作流已创建!")
        print("现在可以推送到GitHub，自动构建所有平台版本")
    
    elif choice == "3":
        print("退出")
    
    else:
        print("无效选择")

if __name__ == '__main__':
    main()
