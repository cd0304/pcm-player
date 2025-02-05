# PCM/MP3/WAV 音频播放器

一个功能丰富的在线音频播放器，支持 PCM、MP3、WAV 格式的音频文件播放、波形显示和格式转换功能。

## 🌟 特性

- 支持 PCM、MP3 和 WAV 音频文件播放
- 实时音频波形可视化显示
- PCM 转 MP3/WAV 格式转换
- 支持多种音频参数配置：
  - 采样率（Sample Rate）调节
  - 位深度（Bit Depth）选择
  - 声道数（Channels）设置
  - 字节序（Endianness）自动检测
- 美观的现代化 UI 界面
- 完全在浏览器端运行，无需服务器

## 🚀 在线体验

访问 [https://pcm.qer.im](https://pcm.qer.im) 即可在线使用。

## 💻 本地运行

1. 克隆项目到本地：
```bash
git clone https://github.com/yourusername/pcm-player.git
cd pcm-player
```

2. 使用任意 HTTP 服务器启动项目，例如：
```bash
# 使用 Python
python -m http.server

# 或使用 Node.js
npx http-server
```

3. 在浏览器中访问 `http://localhost:8000`

## 📖 使用说明

1. 点击"选择文件"按钮上传音频文件（支持 PCM、MP3 或 WAV 格式）
2. 可以通过界面上的控制面板调整音频参数：
   - 采样率
   - 位深度
   - 声道数
3. 使用播放控制按钮控制音频播放
4. 点击波形图任意位置可以跳转到指定播放位置
5. 使用转换按钮可以将 PCM 文件转换为 MP3 或 WAV 格式

## 🔧 技术栈

- 原生 JavaScript (ES6+)
- Web Audio API
- HTML5 Canvas
- 响应式 CSS

## 📝 注意事项

- PCM 文件需要是原始格式，不包含文件头
- WAV 文件支持标准 PCM 编码格式
- 建议使用现代浏览器（Chrome、Firefox、Safari 等）以获得最佳体验
- 文件转换完全在浏览器端进行，大文件可能需要较长处理时间

## 📄 开源协议

MIT License

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

1. Fork 本项目
2. 创建你的特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交你的改动 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启一个 Pull Request
