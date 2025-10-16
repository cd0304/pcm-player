#!/bin/bash

echo "================================================"
echo "简单PCM播放器"
echo "================================================"
echo

# 检查Python是否安装
if ! command -v python3 &> /dev/null; then
    echo "错误: 未找到Python3，请先安装Python 3.x"
    echo "在Mac上可以使用: brew install python3"
    echo "在Ubuntu上可以使用: sudo apt install python3"
    echo
    read -p "按回车键退出..."
    exit 1
fi

# 检查必要文件
if [ ! -f "simple-pcm-player.html" ]; then
    echo "错误: 未找到 simple-pcm-player.html 文件"
    echo "请确保所有文件在同一目录下"
    echo
    read -p "按回车键退出..."
    exit 1
fi

if [ ! -f "server.py" ]; then
    echo "错误: 未找到 server.py 文件"
    echo "请确保所有文件在同一目录下"
    echo
    read -p "按回车键退出..."
    exit 1
fi

# 创建data目录
if [ ! -d "data" ]; then
    mkdir -p data
    echo "已创建data目录，请将PCM文件放入其中"
    echo
fi

echo "正在启动PCM播放器服务器..."
echo

# 启动Python服务器
python3 server.py

echo
echo "服务器已停止"
read -p "按回车键退出..."
