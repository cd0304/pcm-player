@echo off
chcp 65001 >nul
title 简单PCM播放器

echo ================================================
echo 简单PCM播放器
echo ================================================
echo.

REM 检查Python是否安装
python --version >nul 2>&1
if errorlevel 1 (
    echo 错误: 未找到Python，请先安装Python 3.x
    echo 下载地址: https://www.python.org/downloads/
    echo.
    pause
    exit /b 1
)

REM 检查必要文件
if not exist "simple-pcm-player.html" (
    echo 错误: 未找到 simple-pcm-player.html 文件
    echo 请确保所有文件在同一目录下
    echo.
    pause
    exit /b 1
)

if not exist "server.py" (
    echo 错误: 未找到 server.py 文件
    echo 请确保所有文件在同一目录下
    echo.
    pause
    exit /b 1
)

REM 创建data目录
if not exist "data" (
    mkdir data
    echo 已创建data目录，请将PCM文件放入其中
    echo.
)

echo 正在启动PCM播放器服务器...
echo.

REM 启动Python服务器
python server.py

echo.
echo 服务器已停止
pause
