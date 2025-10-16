#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
构建桌面PCM播放器
使用PyInstaller打包成独立可执行文件
"""

import os
import sys
import subprocess
import shutil

def build_desktop_app():
    """构建桌面应用"""
    
    print("=" * 60)
    print("构建桌面PCM播放器")
    print("=" * 60)
    
    # 检查PyInstaller是否安装
    try:
        import PyInstaller
        print("✓ PyInstaller 已安装")
    except ImportError:
        print("正在安装PyInstaller...")
        try:
            subprocess.check_call([sys.executable, "-m", "pip", "install", "pyinstaller"])
            print("✓ PyInstaller 安装完成")
        except subprocess.CalledProcessError:
            print("❌ PyInstaller 安装失败")
            return False
    
    # 检查必要文件
    if not os.path.exists('desktop-pcm-player.py'):
        print("❌ 未找到 desktop-pcm-player.py 文件")
        return False
    
    print("✓ 源文件检查完成")
    
    # 创建data目录
    data_dir = 'data'
    if not os.path.exists(data_dir):
        os.makedirs(data_dir)
        print(f"✓ 已创建data目录: {data_dir}")
    
    # 构建命令
    build_cmd = [
        'pyinstaller',
        '--onefile',  # 打包成单个文件
        '--windowed',  # 无控制台窗口
        '--name', 'PCM播放器',
        '--add-data', f'{data_dir};data',
        '--distpath', 'dist',
        '--workpath', 'build',
        '--specpath', '.',
        'desktop-pcm-player.py'
    ]
    
    # 如果有图标文件，添加图标参数
    if os.path.exists('icon.ico'):
        build_cmd.insert(-1, '--icon')
        build_cmd.insert(-1, 'icon.ico')
    
    print("\n正在构建可执行文件...")
    print(f"构建命令: {' '.join(build_cmd)}")
    
    try:
        result = subprocess.run(build_cmd, capture_output=True, text=True)
        
        if result.returncode == 0:
            print("✓ 构建成功!")
            
            # 检查输出文件
            exe_path = os.path.join('dist', 'PCM播放器.exe')
            if os.path.exists(exe_path):
                file_size = os.path.getsize(exe_path) / (1024 * 1024)  # MB
                print(f"✓ 可执行文件: {exe_path}")
                print(f"✓ 文件大小: {file_size:.1f} MB")
                
                # 创建使用说明
                create_readme()
                
                print("\n" + "=" * 60)
                print("构建完成!")
                print("=" * 60)
                print(f"可执行文件位置: {exe_path}")
                print("使用方法:")
                print("1. 双击运行 'PCM播放器.exe'")
                print("2. 将PCM文件放入程序目录下的data文件夹")
                print("3. 程序会自动扫描并列出所有PCM文件")
                print("4. 点击文件列表中的文件进行播放")
                print("\n支持格式: 16kHz, 16bit, 单声道, 小端序")
                
                return True
            else:
                print("❌ 未找到生成的可执行文件")
                return False
        else:
            print("❌ 构建失败:")
            print(result.stderr)
            return False
            
    except Exception as e:
        print(f"❌ 构建过程中出错: {e}")
        return False

def create_readme():
    """创建使用说明文件"""
    readme_content = """# PCM播放器使用说明

## 功能特点
- 🎵 支持16kHz, 16bit, 单声道, 小端序PCM文件播放
- 📁 自动扫描data目录下的所有PCM文件
- 📅 按文件修改时间降序排序
- 🎮 简单的播放控制（播放/暂停/停止）
- 📊 实时进度显示和波形显示
- 💻 跨平台支持（Windows/Mac/Linux）

## 使用方法

### 1. 运行程序
双击 `PCM播放器.exe` 启动程序

### 2. 添加PCM文件
将PCM文件放入程序目录下的 `data` 文件夹中

### 3. 播放音频
- 程序会自动扫描并列出所有PCM文件
- 点击文件列表中的文件进行播放
- 使用播放控制按钮控制播放

## 支持的PCM格式
- 采样率: 16kHz (固定)
- 位深度: 16bit (固定)
- 声道数: 单声道 (固定)
- 字节序: 小端序 (固定)

## 故障排除

1. **程序无法启动**
   - 确保系统支持Web Audio API
   - 检查防火墙设置

2. **无法播放音频**
   - 确保PCM文件格式正确
   - 检查文件是否损坏

3. **文件列表为空**
   - 确保PCM文件在data目录中
   - 检查文件扩展名是否为.pcm

## 技术说明
本程序使用以下技术：
- Python HTTP服务器
- Web Audio API音频处理
- HTML5 Canvas波形显示
- PyInstaller打包

## 许可证
MIT License
"""
    
    with open('使用说明.txt', 'w', encoding='utf-8') as f:
        f.write(readme_content)
    
    print("✓ 已创建使用说明文件: 使用说明.txt")

def main():
    """主函数"""
    if build_desktop_app():
        print("\n🎉 桌面PCM播放器构建成功!")
        print("现在可以分发PCM播放器.exe文件给用户使用了")
    else:
        print("\n❌ 构建失败，请检查错误信息")
    
    input("\n按回车键退出...")

if __name__ == '__main__':
    main()
