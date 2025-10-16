# 简单PCM播放器

一个基于Web技术的简单PCM音频播放器，支持16kHz/16bit/单声道/小端序的PCM文件播放。

## 功能特点

- 🎵 支持16kHz, 16bit, 单声道, 小端序PCM文件播放
- 📁 自动扫描data目录下的所有文件
- 📅 按文件修改时间降序排序
- 🎮 简单的播放控制（播放/暂停/停止）
- 📊 实时进度显示
- 💻 跨平台支持（Windows/Mac/Linux）

## 使用方法

### Windows用户

1. 双击运行 `start-pcm-player.bat`
2. 浏览器会自动打开播放器页面
3. 将PCM文件放入 `data` 目录
4. 点击文件列表中的文件进行播放

### Mac/Linux用户

1. 在终端中运行：
   ```bash
   chmod +x start-pcm-player.sh
   ./start-pcm-player.sh
   ```
2. 浏览器会自动打开播放器页面
3. 将PCM文件放入 `data` 目录
4. 点击文件列表中的文件进行播放

## 系统要求

- Python 3.x
- 现代浏览器（Chrome、Firefox、Safari、Edge等）
- 支持Web Audio API的浏览器

## 文件结构

```
├── simple-pcm-player.html    # 播放器主页面
├── server.py                 # Python服务器
├── start-pcm-player.bat      # Windows启动脚本
├── start-pcm-player.sh       # Mac/Linux启动脚本
├── data/                     # PCM文件目录
└── README.md                 # 说明文档
```

## 技术实现

- **前端**: HTML5 + JavaScript + Web Audio API
- **后端**: Python HTTP服务器
- **PCM解码**: 使用DataView解析16位小端序PCM数据
- **音频播放**: Web Audio API的AudioBuffer和BufferSource

## 支持的PCM格式

- 采样率: 16kHz (固定)
- 位深度: 16bit (固定)
- 声道数: 单声道 (固定)
- 字节序: 小端序 (固定)

## 故障排除

1. **无法启动服务器**
   - 确保已安装Python 3.x
   - 检查端口是否被占用

2. **无法播放音频**
   - 确保PCM文件格式正确（16kHz/16bit/单声道/小端序）
   - 检查浏览器是否支持Web Audio API

3. **文件列表为空**
   - 确保PCM文件在 `data` 目录中
   - 检查文件权限

## 开发说明

这个播放器使用了以下关键技术：

1. **PCM数据解析**: 使用DataView精确控制字节序和数据类型
2. **Web Audio API**: 将PCM数据转换为AudioBuffer进行播放
3. **文件系统API**: 通过Python服务器提供文件列表和内容
4. **响应式设计**: 适配不同屏幕尺寸

## 许可证

MIT License