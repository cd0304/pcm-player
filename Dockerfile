# 多阶段构建，支持跨平台
FROM python:3.11-slim as builder

# 安装构建依赖
RUN apt-get update && apt-get install -y \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# 安装PyInstaller
RUN pip install pyinstaller

# 复制源代码
COPY . /app
WORKDIR /app

# 创建data目录
RUN mkdir -p data

# 构建可执行文件
RUN pyinstaller --onefile --windowed --name "PCM播放器" --add-data "data:data" desktop-pcm-player.py

# 最终阶段
FROM python:3.11-slim

# 复制构建好的可执行文件
COPY --from=builder /app/dist/PCM播放器 /usr/local/bin/
COPY --from=builder /app/data /app/data

# 设置工作目录
WORKDIR /app

# 暴露端口
EXPOSE 8000

# 运行程序
CMD ["PCM播放器"]
