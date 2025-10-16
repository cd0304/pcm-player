@echo off
chcp 65001 >nul
title 构建PCM播放器

echo ================================================
echo 构建桌面PCM播放器
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
if not exist "desktop-pcm-player.py" (
    echo 错误: 未找到 desktop-pcm-player.py 文件
    echo 请确保所有文件在同一目录下
    echo.
    pause
    exit /b 1
)

echo 正在构建PCM播放器...
echo.

REM 运行构建脚本
python build-desktop-app.py

echo.
echo 构建完成！
pause
