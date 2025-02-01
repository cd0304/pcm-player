class PCMPlayer {
    constructor() {
        this.sampleRate = 48000;
        this.isPlaying = false;
        this.audioBuffer = null;
        this.source = null;
        this.startTime = 0;
        this.currentTime = 0;
        this.pausedAt = 0;
        this.amplificationFactor = 1;
        this.rawPcmData = null;  // 存储原始PCM数据
        this.mp3Audio = null;    // 存储 MP3 Audio 对象
        this.isMP3 = false;      // 标记当前是否是 MP3 文件
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 2048;
        this.mediaElement = null; // 存储 MP3 的 MediaElementSource
        this.mp3Data = null;      // 存储 MP3 的音频数据

        this.initializeDOMElements();

        this.setupEventListeners();
        this.setupSampleButton();
        this.setupSampleRateControl();
        this.setupConvertButton();
        
        // 初始化文件名显示样式
        this.fileNameDisplay.classList.add('no-file');
    }

    initializeDOMElements() {
        this.canvas = document.getElementById('waveformCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.currentTimeDisplay = document.getElementById('currentTime');
        this.durationDisplay = document.getElementById('duration');
        this.fileInfo = document.getElementById('fileInfo');
        this.fileNameDisplay = document.getElementById('fileNameDisplay');

        this.canvas.width = this.canvas.offsetWidth;
        this.canvas.height = this.canvas.offsetHeight;
    }

    setupEventListeners() {
        this.fileInput = document.getElementById('fileInput');
        this.playButton = document.getElementById('playButton');
        this.stopButton = document.getElementById('stopButton');

        this.fileInput.addEventListener('change', async (e) => {
            if (!this.audioContext) {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }
            await this.handleFileSelect(e);
        });

        this.playButton.addEventListener('click', () => {
            if (!this.audioContext) {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }
            this.togglePlay();
        });

        this.stopButton.addEventListener('click', () => this.stop());

        this.canvas.addEventListener('click', (e) => this.handleProgressClick(e));
    }

    setupSampleButton() {
        const loadSampleButton = document.getElementById('loadSampleButton');
        loadSampleButton.addEventListener('click', async () => {
            try {
                const response = await fetch('./test.pcm');
                if (!response.ok) {
                    throw new Error('样例文件加载失败');
                }
                const arrayBuffer = await response.arrayBuffer();

                if (!this.audioContext) {
                    this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
                }

                const pcmData = new Float32Array(arrayBuffer.byteLength / 2);
                const dataView = new DataView(arrayBuffer);

                for (let i = 0; i < pcmData.length; i++) {
                    const int16 = dataView.getInt16(i * 2, true);
                    pcmData[i] = int16 / 32768.0;
                }

                this.audioBuffer = this.audioContext.createBuffer(1, pcmData.length, this.sampleRate);
                this.audioBuffer.getChannelData(0).set(pcmData);

                document.getElementById('playButton').disabled = false;
                document.getElementById('stopButton').disabled = false;

                this.fileInfo.textContent = `文件名: test.pcm | 大小: ${(arrayBuffer.byteLength / 1024).toFixed(2)} KB | 时长: ${this.formatTime(this.audioBuffer.duration)}`;
                this.durationDisplay.textContent = this.formatTime(this.audioBuffer.duration);

                this.drawWaveform(pcmData);
                this.resetPlayButton('play');

            } catch (error) {
                console.error('加载样例文件失败:', error);
                alert('加载样例文件失败，请确保 test.pcm 文件存在');
            }
        });
    }

    setupSampleRateControl() {
        const sampleRateSelect = document.getElementById('sampleRateSelect');
        sampleRateSelect.value = this.sampleRate;

        sampleRateSelect.addEventListener('change', (e) => {
            const newSampleRate = parseInt(e.target.value);
            if (this.rawPcmData && newSampleRate !== this.sampleRate) {
                this.sampleRate = newSampleRate;
                this.updateAudioBuffer();
            }
        });
    }

    setupConvertButton() {
        const convertButton = document.getElementById('convertButton');
        if (convertButton) {
            convertButton.addEventListener('click', () => this.convertToMp3());
        }
    }

    updateAudioBuffer() {
        if (!this.rawPcmData || !this.audioContext) {
            console.warn('没有 PCM 数据或音频上下文');
            return;
        }

        try {
            // 停止当前播放
            if (this.isPlaying) {
                this.stop();
            }

            // 重置播放进度
            this.currentTime = 0;
            this.pausedAt = 0;
            this.currentTimeDisplay.textContent = this.formatTime(0);

            // 重新创建 Float32Array
            const pcmData = new Float32Array(this.rawPcmData.byteLength / 2);
            const dataView = new DataView(this.rawPcmData);

            // 将 16 位整数转换为浮点数
            for (let i = 0; i < pcmData.length; i++) {
                const int16 = dataView.getInt16(i * 2, true);  // true 表示小端字节序
                pcmData[i] = int16 / 32768.0;  // 归一化到 [-1, 1] 范围
            }

            // 验证数据
            if (pcmData.length === 0) {
                throw new Error('PCM 数据长度为 0');
            }

            console.log(`正在更新音频缓冲区 - 采样率: ${this.sampleRate}Hz, 数据长度: ${pcmData.length}`);

            // 创建新的音频缓冲区
            this.audioBuffer = this.audioContext.createBuffer(
                1,                // 单声道
                pcmData.length,   // 采样点数量
                this.sampleRate   // 新的采样率
            );

            // 将数据写入缓冲区
            const channelData = this.audioBuffer.getChannelData(0);
            channelData.set(pcmData);

            // 更新显示信息
            this.durationDisplay.textContent = this.formatTime(this.audioBuffer.duration);
            
            // 更新文件信息中的时长
            if (this.fileInfo.textContent && this.fileInfo.textContent !== '未选择文件') {
                const fileInfoParts = this.fileInfo.textContent.split('|');
                if (fileInfoParts.length >= 3) {
                    fileInfoParts[2] = ` 时长: ${this.formatTime(this.audioBuffer.duration)}`;
                    this.fileInfo.textContent = fileInfoParts.join('|');
                }
            }

            // 重新绘制波形
            this.drawWaveform(pcmData);

            // 重置播放按钮状态
            document.getElementById('playButton').disabled = false;
            document.getElementById('stopButton').disabled = false;
            this.resetPlayButton('play');

            console.log('音频缓冲区更新成功');

        } catch (error) {
            console.error('更新音频缓冲区时出错:', error);
            alert(`更新音频缓冲区时出错: ${error.message}`);
            
            // 重置状态
            this.audioBuffer = null;
            document.getElementById('playButton').disabled = true;
            document.getElementById('stopButton').disabled = true;
            this.fileInfo.textContent = '音频处理失败';
            this.durationDisplay.textContent = '00:00';
        }
    }

    handleProgressClick(e) {
        if (!this.audioBuffer || !this.waveformPoints.length) return;

        // 获取点击位置相对于画布的坐标
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const clickX = (e.clientX - rect.left) * scaleX;

        // 找到最接近点击位置的波形点
        const clickedPoint = this.waveformPoints.reduce((closest, point) => {
            return Math.abs(point.x - clickX) < Math.abs(closest.x - clickX) ? point : closest;
        });

        // 使用波形点对应的时间位置
        const seekTime = Math.min(clickedPoint.timePosition, this.audioBuffer.duration);

        if (this.isPlaying) {
            this.pause();
        }
        this.currentTime = seekTime;
        this.pausedAt = seekTime;
        this.currentTimeDisplay.textContent = this.formatTime(seekTime);
        this.drawCurrentState();
    }

    formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        seconds = Math.floor(seconds % 60);
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    async handleFileSelect(event) {
        if (this.isPlaying) {
            this.stop();
        }

        const file = event.target.files[0];
        if (!file) return;

        try {
            this.currentTime = 0;
            this.pausedAt = 0;
            this.resetPlayButton('play');

            // 更新文件名显示
            this.fileNameDisplay.textContent = file.name;
            this.fileNameDisplay.classList.remove('no-file');

            if (file.name.toLowerCase().endsWith('.mp3')) {
                // 处理 MP3 文件
                await this.handleMP3File(file);
            } else {
                // PCM 文件处理逻辑
                await this.handlePCMFile(file);
            }
        } catch (error) {
            console.error('文件处理失败:', error);
            alert('文件处理失败: ' + error.message);
            this.fileNameDisplay.textContent = '文件处理失败';
            this.fileNameDisplay.classList.add('no-file');
            this.fileInfo.textContent = '';
        }
    }

    async handleMP3File(file) {
        // 创建文件 URL
        const fileUrl = URL.createObjectURL(file);
        
        try {
            // 获取 MP3 数据
            const response = await fetch(fileUrl);
            const arrayBuffer = await response.arrayBuffer();
            
            // 解码 MP3 数据
            const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
            
            // 获取音频数据
            const pcmData = audioBuffer.getChannelData(0);
            
            // 更新采样率
            this.sampleRate = audioBuffer.sampleRate;
            const sampleRateSelect = document.getElementById('sampleRateSelect');
            if (sampleRateSelect) {
                const option = Array.from(sampleRateSelect.options)
                    .find(opt => parseInt(opt.value) === this.sampleRate);
                if (option) {
                    sampleRateSelect.value = this.sampleRate;
                }
            }

            // 存储音频缓冲区
            this.audioBuffer = audioBuffer;

            // 更新 UI
            document.getElementById('playButton').disabled = false;
            document.getElementById('stopButton').disabled = false;
            document.getElementById('convertButton').disabled = true;  // MP3 不需要转换

            this.fileInfo.textContent = `类型: MP3 | 采样率: ${this.sampleRate}Hz | 大小: ${(file.size / 1024).toFixed(2)} KB | 时长: ${this.formatTime(audioBuffer.duration)}`;
            this.durationDisplay.textContent = this.formatTime(audioBuffer.duration);

            // 绘制波形
            this.drawWaveform(pcmData);
            this.resetPlayButton('play');
        } finally {
            // 清理 URL
            URL.revokeObjectURL(fileUrl);
        }
    }

    async handlePCMFile(file) {
        // 从文件名检测采样率并更新
        const detectedSampleRate = this.detectSampleRateFromFileName(file.name);
        if (detectedSampleRate !== this.sampleRate) {
            this.sampleRate = detectedSampleRate;
            const sampleRateSelect = document.getElementById('sampleRateSelect');
            if (sampleRateSelect) {
                const option = Array.from(sampleRateSelect.options)
                    .find(opt => parseInt(opt.value) === detectedSampleRate);
                if (option) {
                    sampleRateSelect.value = detectedSampleRate;
                }
            }
        }

        // 存储原始PCM数据
        this.rawPcmData = await file.arrayBuffer();
        
        // 验证文件
        if (this.rawPcmData.byteLength === 0) {
            throw new Error('PCM 文件为空');
        }
        if (this.rawPcmData.byteLength % 2 !== 0) {
            throw new Error('无效的 PCM 文件格式：文件大小必须是 2 的倍数');
        }

        // 转换数据
        const pcmData = new Float32Array(this.rawPcmData.byteLength / 2);
        const dataView = new DataView(this.rawPcmData);

        for (let i = 0; i < pcmData.length; i++) {
            const int16 = dataView.getInt16(i * 2, true);
            pcmData[i] = int16 / 32768.0;
        }

        if (pcmData.length === 0) {
            throw new Error('PCM 数据转换后长度为 0');
        }

        // 创建音频缓冲区
        this.audioBuffer = this.audioContext.createBuffer(
            1,
            pcmData.length,
            this.sampleRate
        );
        this.audioBuffer.getChannelData(0).set(pcmData);

        // 更新 UI
        document.getElementById('playButton').disabled = false;
        document.getElementById('stopButton').disabled = false;
        document.getElementById('convertButton').disabled = false;

        this.fileInfo.textContent = `类型: PCM | 采样率: ${this.sampleRate}Hz | 大小: ${(file.size / 1024).toFixed(2)} KB | 时长: ${this.formatTime(this.audioBuffer.duration)}`;
        this.durationDisplay.textContent = this.formatTime(this.audioBuffer.duration);

        // 绘制波形
        this.drawWaveform(pcmData);
        this.resetPlayButton('play');
    }

    async processMP3Data() {
        // 等待一小段时间以确保音频数据准备就绪
        await new Promise(resolve => setTimeout(resolve, 100));

        // 创建一个临时的 AudioBuffer 来存储音频数据
        const bufferLength = this.analyser.frequencyBinCount;
        const dataArray = new Float32Array(bufferLength);
        this.analyser.getFloatTimeDomainData(dataArray);

        // 使用与 PCM 相同的波形绘制逻辑
        this.drawWaveform(dataArray);

        // 设置定时器更新进度
        const updateProgress = () => {
            if (!this.isMP3 || !this.mp3Audio) return;
            
            // 更新当前时间显示
            this.currentTime = this.mp3Audio.currentTime;
            this.currentTimeDisplay.textContent = this.formatTime(this.currentTime);

            // 更新波形进度
            this.drawCurrentState();

            // 继续更新
            if (this.isPlaying) {
                requestAnimationFrame(updateProgress);
            }
        };

        // 开始更新进度
        if (this.isPlaying) {
            updateProgress();
        }
    }

    drawWaveform(pcmData) {
        const ctx = this.ctx;
        const width = this.canvas.width;
        const height = this.canvas.height;
        const step = Math.ceil(pcmData.length / width);

        ctx.clearRect(0, 0, width, height);

        // 绘制网格
        ctx.strokeStyle = '#f0f0f0';
        ctx.lineWidth = 1;

        for (let i = 0; i < height; i += 40) {
            ctx.beginPath();
            ctx.moveTo(0, i);
            ctx.lineTo(width, i);
            ctx.stroke();
        }

        for (let i = 0; i < width; i += 100) {
            ctx.beginPath();
            ctx.moveTo(i, 0);
            ctx.lineTo(i, height);
            ctx.stroke();
        }

        // 重置波形点数组
        this.waveformPoints = [];
        const centerY = height / 2;

        // 计算音频数据的最大振幅
        let maxAmplitude = 0;
        for (let i = 0; i < pcmData.length; i++) {
            maxAmplitude = Math.max(maxAmplitude, Math.abs(pcmData[i]));
        }

        // 自动计算放大系数，目标是让波形高度占据画布高度的 70%
        const targetHeight = height * 0.7;
        const autoAmplificationFactor = maxAmplitude > 0 ? (targetHeight / 2) / (maxAmplitude * centerY) : 1;
        this.amplificationFactor = Math.min(Math.max(autoAmplificationFactor, 0.5), 5); // 限制在 0.5-5 倍之间

        // 计算并存储波形点
        for (let i = 0; i < width; i++) {
            const startIndex = i * step;
            let sum = 0;
            let count = 0;

            // 计算每个像素位置对应的音频采样点的平均值
            for (let j = 0; j < step && startIndex + j < pcmData.length; j++) {
                sum += Math.abs(pcmData[startIndex + j]);
                count++;
            }

            const average = sum / count;
            const amplitude = average * centerY * 0.95 * this.amplificationFactor;

            // 存储波形点信息，包括位置、对应的音频时间和振幅
            this.waveformPoints.push({
                x: i,
                y: Math.min(centerY + amplitude, height),
                bottomY: Math.max(centerY - amplitude, 0),
                timePosition: this.isMP3 ? 
                    (i / width) * this.mp3Audio.duration : 
                    (startIndex / pcmData.length) * this.audioBuffer.duration
            });
        }

        // 绘制波形
        this.drawCurrentState();
    }

    drawCurrentState() {
        if (!this.waveformPoints) return;

        const ctx = this.ctx;
        const width = this.canvas.width;
        const height = this.canvas.height;

        ctx.clearRect(0, 0, width, height);

        // 绘制网格
        ctx.strokeStyle = '#f0f0f0';
        ctx.lineWidth = 1;

        for (let i = 0; i < height; i += 40) {
            ctx.beginPath();
            ctx.moveTo(0, i);
            ctx.lineTo(width, i);
            ctx.stroke();
        }

        for (let i = 0; i < width; i += 100) {
            ctx.beginPath();
            ctx.moveTo(i, 0);
            ctx.lineTo(i, height);
            ctx.stroke();
        }

        // 计算当前播放时间
        const currentTime = this.isMP3 ? 
            this.mp3Audio.currentTime : 
            (this.isPlaying ? this.pausedAt + (this.audioContext.currentTime - this.startTime) : this.pausedAt);

        // 绘制波形
        ctx.beginPath();
        ctx.strokeStyle = '#2196F3';
        ctx.lineWidth = 2;

        for (let i = 0; i < this.waveformPoints.length; i++) {
            const point = this.waveformPoints[i];
            if (i === 0) {
                ctx.moveTo(point.x, point.y);
            } else {
                ctx.lineTo(point.x, point.y);
            }
        }
        ctx.stroke();

        // 绘制播放进度线
        if (this.isMP3 ? this.mp3Audio : this.audioBuffer) {
            const duration = this.isMP3 ? this.mp3Audio.duration : this.audioBuffer.duration;
            const progress = currentTime / duration;
            const progressX = width * progress;

            ctx.beginPath();
            ctx.strokeStyle = '#1976D2';
            ctx.lineWidth = 2;
            ctx.moveTo(progressX, 0);
            ctx.lineTo(progressX, height);
            ctx.stroke();
        }
    }

    updateProgress() {
        if (!this.isPlaying || !this.audioBuffer) return;

        // 计算当前播放时间
        const playedTime = this.audioContext.currentTime - this.startTime;
        const currentTime = this.pausedAt + playedTime;

        // 确保不超过总时长
        this.currentTime = Math.min(currentTime, this.audioBuffer.duration);

        // 更新显示
        this.currentTimeDisplay.textContent = this.formatTime(this.currentTime);
        this.drawCurrentState();

        // 检查是否需要继续更新
        if (this.currentTime < this.audioBuffer.duration) {
            requestAnimationFrame(() => this.updateProgress());
        } else {
            this.stop();
        }
    }

    togglePlay() {
        if (this.isMP3) {
            if (!this.isPlaying) {
                this.mp3Audio.currentTime = this.pausedAt;
                this.mp3Audio.play();
                this.isPlaying = true;
                this.resetPlayButton('pause');
                
                // 更新进度
                this.updateProgressInterval = setInterval(() => {
                    this.currentTime = this.mp3Audio.currentTime;
                    this.currentTimeDisplay.textContent = this.formatTime(this.currentTime);
                    this.drawCurrentState();
                }, 100);
            } else {
                this.pause();
            }
        } else {
            // 原有的 PCM 播放逻辑
            if (!this.isPlaying) {
                this.play(this.pausedAt);
            } else {
                this.pause();
            }
        }
    }

    pause() {
        if (this.isMP3) {
            if (this.mp3Audio) {
                this.mp3Audio.pause();
                this.pausedAt = this.mp3Audio.currentTime;
                clearInterval(this.updateProgressInterval);
            }
        } else {
            // 原有的 PCM 暂停逻辑
            if (this.source) {
                this.source.stop();
                this.source = null;
            }
            this.pausedAt = this.currentTime;
        }
        
        this.isPlaying = false;
        this.resetPlayButton('play');
    }

    play(startTime = null) {
        if (this.isPlaying || !this.audioBuffer) return;

        this.source = this.audioContext.createBufferSource();
        this.source.buffer = this.audioBuffer;
        this.source.connect(this.audioContext.destination);

        // 确定开始播放的时间位置
        const actualStartTime = startTime !== null ? startTime : this.pausedAt;

        // 从指定位置开始播放
        this.source.start(0, actualStartTime);
        this.startTime = this.audioContext.currentTime;
        this.pausedAt = actualStartTime; // 保存实际的开始位置
        this.isPlaying = true;

        // 立即更新显示
        this.currentTime = actualStartTime;
        this.currentTimeDisplay.textContent = this.formatTime(this.currentTime);
        this.drawCurrentState();

        this.resetPlayButton('pause');
        this.updateProgress();

        // 处理播放结束事件
        this.source.onended = () => {
            if (!this.isPlaying) return; // 如果是手动停止，不处理
            this.stop();
        };
    }

    resetPlayButton(state = 'play') {
        const playButton = document.getElementById('playButton');
        switch (state) {
            case 'pause':
                playButton.innerHTML = `
                    <svg class="icon" viewBox="0 0 24 24">
                        <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
                    </svg>
                    暂停
                `;
                break;
            case 'resume':
                playButton.innerHTML = `
                    <svg class="icon" viewBox="0 0 24 24">
                        <path d="M6 4l15 8-15 8z"/>
                    </svg>
                    继续
                `;
                break;
            default:
                playButton.innerHTML = `
                    <svg class="icon" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z"/>
                    </svg>
                    播放
                `;
        }
    }

    stop() {
        if (this.isMP3) {
            if (this.mp3Audio) {
                this.mp3Audio.pause();
                this.mp3Audio.currentTime = 0;
                clearInterval(this.updateProgressInterval);
            }
        } else {
            // 原有的 PCM 停止逻辑
            if (this.source) {
                this.source.stop();
                this.source = null;
            }
        }
        
        this.isPlaying = false;
        this.currentTime = 0;
        this.pausedAt = 0;
        this.currentTimeDisplay.textContent = this.formatTime(0);
        this.resetPlayButton('play');
        this.drawCurrentState();
    }

    // 添加从文件名识别采样率的方法
    detectSampleRateFromFileName(fileName) {
        // 常见的采样率数值及其别名
        const sampleRateMap = {
            8000: ['8k', '8000'],
            16000: ['16k', '16000'],
            22050: ['22.05k', '22050'],
            24000: ['24k', '24000'],
            32000: ['32k', '32000'],
            44100: ['44.1k', '44100'],
            48000: ['48k', '48000'],
            96000: ['96k', '96000']
        };

        // 标准化文件名（转小写，移除多余空格）
        const normalizedName = fileName.toLowerCase().trim();
        
        try {
            // 1. 首先尝试匹配标准格式
            const standardPatterns = [
                // 匹配 _24000Hz.pcm 或 _24000hz.pcm
                /[_-](\d{4,6})hz\.pcm$/,
                // 匹配 _24000.pcm
                /[_-](\d{4,6})\.pcm$/,
                // 匹配 _24k.pcm 或 _24khz.pcm
                /[_-](\d{1,2})k(?:hz)?\.pcm$/,
                // 匹配 24000Hz_ 格式
                /(\d{4,6})hz[_-]/,
                // 匹配 24k_ 格式
                /(\d{1,2})k[_-]/
            ];

            for (const pattern of standardPatterns) {
                const match = normalizedName.match(pattern);
                if (match) {
                    let rate = parseInt(match[1]);
                    // 如果是 k 单位，转换为完整采样率
                    if (pattern.toString().includes('k') && rate < 100) {
                        rate *= 1000;
                    }
                    // 验证是否是有效的采样率
                    if (sampleRateMap[rate]) {
                        console.log(`从标准格式检测到采样率: ${rate}Hz`);
                        return rate;
                    }
                }
            }

            // 2. 如果没有匹配到标准格式，尝试在文件名中查找所有可能的采样率
            for (const [rate, aliases] of Object.entries(sampleRateMap)) {
                for (const alias of aliases) {
                    if (normalizedName.includes(alias)) {
                        console.log(`从文件名中检测到采样率: ${rate}Hz`);
                        return parseInt(rate);
                    }
                }
            }

            // 3. 最后尝试一个更宽松的匹配（但要求必须带有hz标识）
            const looseMatch = normalizedName.match(/(\d{1,6})hz/);
            if (looseMatch) {
                const rate = parseInt(looseMatch[1]);
                if (sampleRateMap[rate]) {
                    console.log(`从宽松匹配检测到采样率: ${rate}Hz`);
                    return rate;
                }
            }

            // 如果都没匹配到，使用默认值
            console.log('未检测到有效采样率，使用默认值: 48000Hz');
            return 48000;

        } catch (error) {
            console.error('采样率检测出错:', error);
            return 48000;
        }
    }

    async convertToMp3() {
        if (!this.rawPcmData) {
            alert('请先加载 PCM 文件');
            return;
        }

        const convertButton = document.getElementById('convertButton');
        const originalContent = convertButton.innerHTML;

        try {
            // 设置 loading 状态
            convertButton.classList.add('loading');
            convertButton.disabled = true;
            convertButton.innerHTML = `
                <div class="loading-spinner"></div>
                转换中...
            `;

            // 获取源文件名
            const fileInfoText = this.fileInfo.textContent;
            let outputFileName = 'converted.mp3';
            if (fileInfoText && fileInfoText !== '未选择文件') {
                const match = fileInfoText.match(/文件名:\s*([^|]+)/);
                if (match && match[1]) {
                    // 移除原扩展名并添加 .mp3
                    outputFileName = match[1].trim().replace(/\.[^/.]+$/, '') + '.mp3';
                }
            }

            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/lamejs@1.2.1/lame.min.js';
            document.head.appendChild(script);

            await new Promise((resolve, reject) => {
                script.onload = resolve;
                script.onerror = reject;
            });

            const mp3encoder = new lamejs.Mp3Encoder(1, this.sampleRate, 128);
            const samples = new Int16Array(this.rawPcmData);
            const mp3Data = [];

            // 每次处理 1152 个采样点（这是 MP3 编码器的推荐值）
            const blockSize = 1152;
            for (let i = 0; i < samples.length; i += blockSize) {
                const sampleChunk = samples.slice(i, i + blockSize);
                const mp3buf = mp3encoder.encodeBuffer(sampleChunk);
                if (mp3buf.length > 0) {
                    mp3Data.push(mp3buf);
                }
            }

            // 完成编码
            const end = mp3encoder.flush();
            if (end.length > 0) {
                mp3Data.push(end);
            }

            // 合并所有的 MP3 数据
            const blob = new Blob(mp3Data, { type: 'audio/mp3' });

            // 创建下载链接
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = outputFileName;

            // 触发下载
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);

            // 短暂显示完成状态
            convertButton.classList.remove('loading');
            convertButton.innerHTML = `
                <svg class="icon" viewBox="0 0 24 24">
                    <path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"/>
                </svg>
                已完成
            `;

            // 延迟后恢复按钮状态
            setTimeout(() => {
                convertButton.disabled = false;
                convertButton.innerHTML = originalContent;
                URL.revokeObjectURL(url);
            }, 2000);

        } catch (error) {
            console.error('MP3 转换失败:', error);
            alert('MP3 转换失败: ' + error.message);
            // 恢复按钮状态
            convertButton.classList.remove('loading');
            convertButton.disabled = false;
            convertButton.innerHTML = originalContent;
        }
    }
} 