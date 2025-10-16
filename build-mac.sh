#!/bin/bash
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
