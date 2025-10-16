#!/bin/bash
# Docker跨平台构建脚本

echo "构建跨平台PCM播放器..."

# 构建Windows版本
echo "构建Windows版本..."
docker buildx build --platform windows/amd64 -t pcm-player:windows .

# 构建macOS版本
echo "构建macOS版本..."
docker buildx build --platform linux/amd64 -t pcm-player:macos .

# 构建Linux版本
echo "构建Linux版本..."
docker buildx build --platform linux/amd64 -t pcm-player:linux .

echo "构建完成！"
echo "使用方法："
echo "docker run -p 8000:8000 pcm-player:windows"
echo "docker run -p 8000:8000 pcm-player:macos"
echo "docker run -p 8000:8000 pcm-player:linux"
