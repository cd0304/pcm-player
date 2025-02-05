class PCMPlayer {
    constructor() {
        // 基本配置
        this.config = {
            sampleRate: 48000,
            bitDepth: 16,
            channels: 1,
            endianness: 'little', // 'little' 或 'big'
        };
        
        // 播放器状态
        this.playerState = {
            isPlaying: false,
            currentTime: 0,
            pausedAt: 0,
            startTime: 0,
            amplificationFactor: 1
        };

        // 音频数据
        this.audioData = {
            audioBuffer: null,
            source: null,
            rawPcmData: null,
            mp3Audio: null,
            isMP3: false,
            mediaElement: null,
            mp3Data: null
        };

        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 2048;
        this.mediaElement = null; // 存储 MP3 的 MediaElementSource
        this.mp3Data = null;      // 存储 MP3 的音频数据

        this.initializeDOMElements();

        this.setupEventListeners();
        this.setupSampleButton();
        this.setupAudioControls();
        this.setupConvertButton();
        this.setupWavConvertButton();
        
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

                // 存储原始 PCM 数据
                this.audioData.rawPcmData = arrayBuffer;

                if (!this.audioContext) {
                    this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
                }

                // 特判设置采样率为 24000Hz
                this.config.sampleRate = 24000;
                const sampleRateSelect = document.getElementById('sampleRateSelect');
                if (sampleRateSelect) {
                    sampleRateSelect.value = '24000';
                }

                // 更新音频缓冲区
                this.updateAudioBuffer();

                // 更新文件名显示
                this.fileNameDisplay.textContent = 'test.pcm';
                this.fileNameDisplay.classList.remove('no-file');

                // 启用转换按钮
                document.getElementById('convertButton').disabled = false;
                document.getElementById('convertWavButton').disabled = false;
            } catch (error) {
                console.error('加载样例文件失败:', error);
                alert('加载样例文件失败，请确保 test.pcm 文件存在');
            }
        });
    }

    setupAudioControls() {
        // 采样率控制
        const sampleRateSelect = document.getElementById('sampleRateSelect');
        sampleRateSelect.value = this.config.sampleRate;
        sampleRateSelect.addEventListener('change', (e) => {
            this.config.sampleRate = parseInt(e.target.value);
            if (this.audioData.rawPcmData) {
                this.updateAudioBuffer();
            }
        });

        // 添加位深度选择
        const bitDepthSelect = document.getElementById('bitDepthSelect');
        bitDepthSelect.addEventListener('change', (e) => {
            this.config.bitDepth = parseInt(e.target.value);
            if (this.audioData.rawPcmData) {
                this.updateAudioBuffer();
            }
        });

        // 添加声道数选择
        const channelsSelect = document.getElementById('channelsSelect');
        channelsSelect.addEventListener('change', (e) => {
            this.config.channels = parseInt(e.target.value);
            if (this.audioData.rawPcmData) {
                this.updateAudioBuffer();
            }
        });

        // 添加字节序选择
        const endiannessSelect = document.getElementById('endiannessSelect');
        endiannessSelect.addEventListener('change', (e) => {
            this.config.endianness = e.target.value;
            if (this.audioData.rawPcmData) {
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

    setupWavConvertButton() {
        const convertWavButton = document.getElementById('convertWavButton');
        if (convertWavButton) {
            convertWavButton.addEventListener('click', () => this.convertToWav());
        }
    }

    updateAudioBuffer() {
        if (!this.audioData.rawPcmData || !this.audioContext) {
            console.warn('没有 PCM 数据或音频上下文');
            return;
        }

        try {
            // 停止当前播放
            if (this.playerState.isPlaying) {
                this.stop();
            }

            // 重置播放进度
            this.playerState.currentTime = 0;
            this.playerState.pausedAt = 0;
            this.currentTimeDisplay.textContent = this.formatTime(0);

            // 计算每个采样点占用的字节数
            const bytesPerSample = this.config.bitDepth / 8;
            const totalSamples = Math.floor(this.audioData.rawPcmData.byteLength / (bytesPerSample * this.config.channels));
            
            // 创建多声道数据数组
            const channelData = Array(this.config.channels).fill().map(() => new Float32Array(totalSamples));
            const dataView = new DataView(this.audioData.rawPcmData);

            // 检测系统字节序并设置
            this.config.endianness = this.detectEndianness();
            
            // 更新字节序选择器
            const endiannessSelect = document.getElementById('endiannessSelect');
            if (endiannessSelect) {
                endiannessSelect.value = this.config.endianness;
                // 禁用选择器，因为我们使用系统字节序
                endiannessSelect.disabled = true;
                // 添加提示信息
                endiannessSelect.title = `已自动检测为${this.config.endianness === 'little' ? '小端序' : '大端序'}`;
            }

            const isLittleEndian = this.config.endianness === 'little';

            // 根据位深度选择合适的读取方法
            for (let i = 0; i < totalSamples; i++) {
                for (let channel = 0; channel < this.config.channels; channel++) {
                    const byteOffset = (i * this.config.channels + channel) * bytesPerSample;
                    let sample = 0;

                    switch (this.config.bitDepth) {
                        case 8:
                            sample = dataView.getInt8(byteOffset) / 128.0;
                            break;
                        case 16:
                            sample = dataView.getInt16(byteOffset, isLittleEndian) / 32768.0;
                            break;
                        case 24:
                            // 24位需要特殊处理
                            const byte1 = dataView.getUint8(byteOffset);
                            const byte2 = dataView.getUint8(byteOffset + 1);
                            const byte3 = dataView.getUint8(byteOffset + 2);
                            let val = isLittleEndian
                                ? (byte3 << 16) | (byte2 << 8) | byte1
                                : (byte1 << 16) | (byte2 << 8) | byte3;
                            // 处理符号位
                            if (val & 0x800000) val |= ~0xFFFFFF;
                            sample = val / 8388608.0;
                            break;
                        case 32:
                            sample = dataView.getFloat32(byteOffset, isLittleEndian);
                            break;
                        default:
                            throw new Error(`不支持的位深度: ${this.config.bitDepth}`);
                    }
                    channelData[channel][i] = sample;
                }
            }

            // 创建新的音频缓冲区
            this.audioData.audioBuffer = this.audioContext.createBuffer(
                this.config.channels,
                totalSamples,
                this.config.sampleRate
            );

            // 将数据写入缓冲区
            for (let channel = 0; channel < this.config.channels; channel++) {
                this.audioData.audioBuffer.copyToChannel(channelData[channel], channel);
            }

            // 更新显示信息
            this.durationDisplay.textContent = this.formatTime(this.audioData.audioBuffer.duration);
            
            // 更新文件信息
            this.updateFileInfo();

            // 重新绘制波形（使用第一个声道的数据）
            this.drawWaveform(channelData[0]);

            // 重置播放按钮状态
            document.getElementById('playButton').disabled = false;
            document.getElementById('stopButton').disabled = false;
            this.resetPlayButton('play');

            console.log('音频缓冲区更新成功');

        } catch (error) {
            console.error('更新音频缓冲区时出错:', error);
            alert(`更新音频缓冲区时出错: ${error.message}`);
            
            // 重置状态
            this.audioData.audioBuffer = null;
            document.getElementById('playButton').disabled = true;
            document.getElementById('stopButton').disabled = true;
            this.fileInfo.innerHTML = '<span class="file-tag">音频处理失败</span>';
            this.durationDisplay.textContent = '00:00';
        }
    }

    updateFileInfo() {
        this.fileInfo.innerHTML = `
            <span class="file-tag type">PCM</span>
            <span class="file-tag size">${(this.audioData.rawPcmData.byteLength / 1024).toFixed(2)} KB</span>
            <span class="file-tag duration">${this.formatTime(this.audioData.audioBuffer.duration)}</span>
            <span class="file-tag sample-rate">${this.config.sampleRate}Hz</span>
            <span class="file-tag channels">${this.config.channels}ch</span>
            <span class="file-tag bit-depth">${this.config.bitDepth}bit</span>
        `;
    }

    handleProgressClick(e) {
        if (!this.audioData.audioBuffer || !this.waveformPoints.length) return;

        // 获取点击位置相对于画布的坐标
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const clickX = (e.clientX - rect.left) * scaleX;

        // 找到最接近点击位置的波形点
        const clickedPoint = this.waveformPoints.reduce((closest, point) => {
            return Math.abs(point.x - clickX) < Math.abs(closest.x - clickX) ? point : closest;
        });

        // 使用波形点对应的时间位置
        const seekTime = Math.min(clickedPoint.timePosition, this.audioData.audioBuffer.duration);

        if (this.playerState.isPlaying) {
            this.pause();
        }
        this.playerState.currentTime = seekTime;
        this.playerState.pausedAt = seekTime;
        this.currentTimeDisplay.textContent = this.formatTime(seekTime);
        this.drawCurrentState();
    }

    formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        seconds = Math.floor(seconds % 60);
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    async handleFileSelect(event) {
        const file = event.target.files[0];
        if (!file) return;

        // 停止当前播放
        this.stop();

        // 更新文件名显示
        this.fileNameDisplay.textContent = file.name;
        this.fileNameDisplay.classList.remove('no-file');

        // 根据文件类型处理
        if (file.name.toLowerCase().endsWith('.mp3')) {
            await this.handleMP3File(file);
            // MP3 文件不支持转换为 WAV
            document.getElementById('convertWavButton').disabled = true;
        } else {
            await this.handlePCMFile(file);
            // PCM 文件支持转换为 WAV
            document.getElementById('convertWavButton').disabled = false;
        }

        // 启用播放和停止按钮
        this.playButton.disabled = false;
        this.stopButton.disabled = false;
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
            this.config.sampleRate = audioBuffer.sampleRate;
            const sampleRateSelect = document.getElementById('sampleRateSelect');
            if (sampleRateSelect) {
                const option = Array.from(sampleRateSelect.options)
                    .find(opt => parseInt(opt.value) === this.config.sampleRate);
                if (option) {
                    sampleRateSelect.value = this.config.sampleRate;
                }
            }

            // 存储音频缓冲区
            this.audioData.audioBuffer = audioBuffer;

            // 更新 UI
            document.getElementById('playButton').disabled = false;
            document.getElementById('stopButton').disabled = false;
            document.getElementById('convertButton').disabled = true;  // MP3 不需要转换

            // 更新文件信息显示
            this.fileInfo.innerHTML = `
                <span class="file-tag type">MP3</span>
                <span class="file-tag size">${(file.size / 1024).toFixed(2)} KB</span>
                <span class="file-tag duration">${this.formatTime(audioBuffer.duration)}</span>
            `;
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
        const detectedSampleRate = this.detectSampleRateFromFileName(file.name);
        if (detectedSampleRate !== this.config.sampleRate) {
            this.updateConfig({ sampleRate: detectedSampleRate });
            const sampleRateSelect = document.getElementById('sampleRateSelect');
            if (sampleRateSelect) {
                sampleRateSelect.value = detectedSampleRate.toString();
            }
        }

        this.audioData.rawPcmData = await file.arrayBuffer();
        this.validatePCMFile(this.audioData.rawPcmData);

        const pcmData = this.processAudioData(new Int16Array(this.audioData.rawPcmData));
        this.createAudioBuffer(pcmData);

        this.updateAllButtonsState('enabled');
        this.updateDisplayInfo('PCM', file.size, this.audioData.audioBuffer.duration);
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
            if (!this.audioData.isMP3 || !this.audioData.mp3Audio) return;
            
            // 更新当前时间显示
            this.playerState.currentTime = this.audioData.mp3Audio.currentTime;
            this.currentTimeDisplay.textContent = this.formatTime(this.playerState.currentTime);

            // 更新波形进度
            this.drawCurrentState();

            // 继续更新
            if (this.playerState.isPlaying) {
                requestAnimationFrame(updateProgress);
            }
        };

        // 开始更新进度
        if (this.playerState.isPlaying) {
            updateProgress();
        }
    }

    drawWaveform(pcmData) {
        const ctx = this.ctx;
        const width = this.canvas.width;
        const height = this.canvas.height;
        const step = Math.ceil(pcmData.length / width);

        ctx.clearRect(0, 0, width, height);
        this.drawGrid(ctx, width, height);

        // 重置波形点数组
        this.waveformPoints = [];
        const centerY = height / 2;

        // 计算音频数据的最大振幅
        let maxAmplitude = 0;
        for (let i = 0; i < pcmData.length; i++) {
            maxAmplitude = Math.max(maxAmplitude, Math.abs(pcmData[i]));
        }

        // 自动计算放大系数
        const targetHeight = height * 0.7;
        const autoAmplificationFactor = maxAmplitude > 0 ? (targetHeight / 2) / (maxAmplitude * centerY) : 1;
        this.playerState.amplificationFactor = Math.min(Math.max(autoAmplificationFactor, 0.5), 5);

        // 计算波形点
        this.calculateWaveformPoints(pcmData, width, height, step, centerY);

        // 绘制波形
        this.drawCurrentState();
    }

    calculateWaveformPoints(pcmData, width, height, step, centerY) {
        for (let i = 0; i < width; i++) {
            const startIndex = i * step;
            let sum = 0;
            let count = 0;

            for (let j = 0; j < step && startIndex + j < pcmData.length; j++) {
                sum += Math.abs(pcmData[startIndex + j]);
                count++;
            }

            const average = sum / count;
            const amplitude = average * centerY * 0.95 * this.playerState.amplificationFactor;

            this.waveformPoints.push({
                x: i,
                y: Math.min(centerY + amplitude, height),
                bottomY: Math.max(centerY - amplitude, 0),
                timePosition: this.audioData.isMP3 ? 
                    (i / width) * this.audioData.mp3Audio.duration : 
                    (startIndex / pcmData.length) * this.audioData.audioBuffer.duration
            });
        }
    }

    drawCurrentState() {
        if (!this.waveformPoints) return;

        const ctx = this.ctx;
        const width = this.canvas.width;
        const height = this.canvas.height;

        ctx.clearRect(0, 0, width, height);
        this.drawGrid(ctx, width, height);

        // 计算当前播放时间
        const currentTime = this.audioData.isMP3 ? 
            this.audioData.mp3Audio.currentTime : 
            (this.playerState.isPlaying ? 
                this.playerState.pausedAt + (this.audioContext.currentTime - this.playerState.startTime) : 
                this.playerState.pausedAt);

        // 绘制波形
        this.drawWaveformPath(ctx);

        // 绘制播放进度
        this.drawPlaybackProgress(ctx, width, height, currentTime);
    }

    drawWaveformPath(ctx) {
        ctx.beginPath();
        ctx.strokeStyle = '#2196F3';
        ctx.lineWidth = 2;

        this.waveformPoints.forEach((point, i) => {
            if (i === 0) {
                ctx.moveTo(point.x, point.y);
            } else {
                ctx.lineTo(point.x, point.y);
            }
        });
        ctx.stroke();
    }

    drawPlaybackProgress(ctx, width, height, currentTime) {
        const audioSource = this.audioData.isMP3 ? this.audioData.mp3Audio : this.audioData.audioBuffer;
        if (!audioSource) return;

        const duration = this.audioData.isMP3 ? 
            this.audioData.mp3Audio.duration : 
            this.audioData.audioBuffer.duration;
        const progress = currentTime / duration;
        const progressX = width * progress;

        ctx.beginPath();
        ctx.strokeStyle = '#1976D2';
        ctx.lineWidth = 2;
        ctx.moveTo(progressX, 0);
        ctx.lineTo(progressX, height);
        ctx.stroke();
    }

    updateProgress() {
        if (!this.playerState.isPlaying || !this.audioData.audioBuffer) return;

        // 计算当前播放时间
        const playedTime = this.audioContext.currentTime - this.playerState.startTime;
        const currentTime = this.playerState.pausedAt + playedTime;

        // 确保不超过总时长
        this.playerState.currentTime = Math.min(currentTime, this.audioData.audioBuffer.duration);

        // 更新显示
        this.currentTimeDisplay.textContent = this.formatTime(this.playerState.currentTime);
        this.drawCurrentState();

        // 检查是否需要继续更新
        if (this.playerState.currentTime < this.audioData.audioBuffer.duration) {
            requestAnimationFrame(() => this.updateProgress());
        } else {
            this.stop();
        }
    }

    togglePlay() {
        if (this.audioData.isMP3) {
            if (!this.playerState.isPlaying) {
                this.audioData.mp3Audio.currentTime = this.playerState.pausedAt;
                this.audioData.mp3Audio.play();
                this.updatePlayerState({ isPlaying: true });
                this.resetPlayButton('pause');
                
                // 更新进度
                this.updateProgressInterval = setInterval(() => {
                    this.updatePlayerState({ 
                        currentTime: this.audioData.mp3Audio.currentTime 
                    });
                    this.currentTimeDisplay.textContent = this.formatTime(this.playerState.currentTime);
                    this.drawCurrentState();
                }, 100);
            } else {
                this.pause();
            }
        } else {
            if (!this.playerState.isPlaying) {
                this.play(this.playerState.pausedAt);
            } else {
                this.pause();
            }
        }
    }

    pause() {
        if (this.audioData.isMP3) {
            if (this.audioData.mp3Audio) {
                this.audioData.mp3Audio.pause();
                this.updatePlayerState({ 
                    pausedAt: this.audioData.mp3Audio.currentTime 
                });
                clearInterval(this.updateProgressInterval);
            }
        } else {
            if (this.audioData.source) {
                this.audioData.source.stop();
                this.updateAudioData({ source: null });
            }
            this.updatePlayerState({ 
                pausedAt: this.playerState.currentTime 
            });
        }
        
        this.updatePlayerState({ isPlaying: false });
        this.resetPlayButton('play');
    }

    play(startTime = null) {
        if (this.playerState.isPlaying || !this.audioData.audioBuffer) return;

        this.audioData.source = this.audioContext.createBufferSource();
        this.audioData.source.buffer = this.audioData.audioBuffer;
        this.audioData.source.connect(this.audioContext.destination);

        // 确定开始播放的时间位置
        const actualStartTime = startTime !== null ? startTime : this.playerState.pausedAt;

        // 从指定位置开始播放
        this.audioData.source.start(0, actualStartTime);
        this.playerState.startTime = this.audioContext.currentTime;
        this.playerState.pausedAt = actualStartTime; // 保存实际的开始位置
        this.playerState.isPlaying = true;

        // 立即更新显示
        this.playerState.currentTime = actualStartTime;
        this.currentTimeDisplay.textContent = this.formatTime(this.playerState.currentTime);
        this.drawCurrentState();

        this.resetPlayButton('pause');
        this.updateProgress();

        // 处理播放结束事件
        this.audioData.source.onended = () => {
            if (!this.playerState.isPlaying) return; // 如果是手动停止，不处理
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
        if (this.audioData.isMP3) {
            if (this.audioData.mp3Audio) {
                this.audioData.mp3Audio.pause();
                this.audioData.mp3Audio.currentTime = 0;
                clearInterval(this.updateProgressInterval);
            }
        } else {
            if (this.audioData.source) {
                this.audioData.source.stop();
                this.updateAudioData({ source: null });
            }
        }
        
        this.updatePlayerState({
            isPlaying: false,
            currentTime: 0,
            pausedAt: 0
        });
        
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

    // 新增工具方法
    updateButtonState(button, state, content) {
        button.disabled = state === 'loading' || state === 'disabled';
        button.classList.toggle('loading', state === 'loading');
        
        if (content) {
            button.innerHTML = content;
        } else {
            switch (state) {
                case 'loading':
                    button.innerHTML = `
                        <div class="loading-spinner"></div>
                        转换中...
                    `;
                    break;
                case 'success':
                    button.innerHTML = `
                        <svg class="icon" viewBox="0 0 24 24">
                            <path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"/>
                        </svg>
                        已完成
                    `;
                    break;
            }
        }
    }

    getOutputFileName(originalName, newExtension) {
        return originalName.replace(/\.[^/.]+$/, '') + '.' + newExtension;
    }

    async handleConvertButton(button, convertFunction, newExtension) {
        const originalContent = button.innerHTML;

        try {
            this.updateButtonState(button, 'loading');
            
            // 获取输出文件名
            const outputFileName = this.getOutputFileName(this.fileNameDisplay.textContent, newExtension);
            
            // 执行转换
            const url = await convertFunction(outputFileName);
            
            // 创建下载链接
            const a = document.createElement('a');
            a.href = url;
            a.download = outputFileName;
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);

            // 显示成功状态
            this.updateButtonState(button, 'success');

            // 延迟后恢复按钮状态
            setTimeout(() => {
                this.updateButtonState(button, 'normal', originalContent);
                URL.revokeObjectURL(url);
            }, 2000);

        } catch (error) {
            console.error(`${newExtension.toUpperCase()} 转换失败:`, error);
            alert(`${newExtension.toUpperCase()} 转换失败: ${error.message}`);
            
            // 恢复按钮状态
            this.updateButtonState(button, 'normal', originalContent);
        }
    }

    async convertToMp3() {
        if (!this.audioData.rawPcmData) {
            alert('请先加载 PCM 文件');
            return;
        }

        const convertButton = document.getElementById('convertButton');
        
        await this.handleConvertButton(convertButton, async (outputFileName) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/lamejs@1.2.1/lame.min.js';
            document.head.appendChild(script);

            await new Promise((resolve, reject) => {
                script.onload = resolve;
                script.onerror = reject;
            });

            const mp3encoder = new lamejs.Mp3Encoder(1, this.config.sampleRate, 128);
            const samples = new Int16Array(this.audioData.rawPcmData);
            const mp3Data = [];

            const blockSize = 1152;
            for (let i = 0; i < samples.length; i += blockSize) {
                const sampleChunk = samples.slice(i, i + blockSize);
                const mp3buf = mp3encoder.encodeBuffer(sampleChunk);
                if (mp3buf.length > 0) {
                    mp3Data.push(mp3buf);
                }
            }

            const end = mp3encoder.flush();
            if (end.length > 0) {
                mp3Data.push(end);
            }

            const blob = new Blob(mp3Data, { type: 'audio/mp3' });
            return URL.createObjectURL(blob);
        }, 'mp3');
    }

    async convertToWav() {
        if (!this.audioData.rawPcmData && !this.audioData.audioBuffer) {
            console.warn('没有可用的音频数据');
            return;
        }

        const convertWavButton = document.getElementById('convertWavButton');
        
        await this.handleConvertButton(convertWavButton, async (outputFileName) => {
            const wavHeader = this.createWavHeader(
                this.audioData.audioBuffer.length * this.config.channels * (this.config.bitDepth / 8),
                this.config.channels,
                this.config.sampleRate,
                this.config.bitDepth
            );

            const wavBlob = new Blob([wavHeader, this.audioData.rawPcmData], { type: 'audio/wav' });
            return URL.createObjectURL(wavBlob);
        }, 'wav');
    }

    createWavHeader(dataLength, channels, sampleRate, bitDepth) {
        const buffer = new ArrayBuffer(44);
        const view = new DataView(buffer);

        // RIFF chunk descriptor
        writeString(view, 0, 'RIFF');
        view.setUint32(4, 36 + dataLength, true);
        writeString(view, 8, 'WAVE');

        // fmt sub-chunk
        writeString(view, 12, 'fmt ');
        view.setUint32(16, 16, true); // fmt chunk size
        view.setUint16(20, 1, true); // audio format (1 for PCM)
        view.setUint16(22, channels, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * channels * (bitDepth / 8), true); // byte rate
        view.setUint16(32, channels * (bitDepth / 8), true); // block align
        view.setUint16(34, bitDepth, true);

        // data sub-chunk
        writeString(view, 36, 'data');
        view.setUint32(40, dataLength, true);

        return buffer;

        function writeString(view, offset, string) {
            for (let i = 0; i < string.length; i++) {
                view.setUint8(offset + i, string.charCodeAt(i));
            }
        }
    }

    detectEndianness() {
        // 使用 DataView 和 TypedArray 来检测系统字节序
        const buffer = new ArrayBuffer(2);
        new DataView(buffer).setInt16(0, 256, true);
        const systemEndianness = new Int16Array(buffer)[0] === 256 ? 'little' : 'big';
        
        console.log(`系统字节序检测结果: ${systemEndianness === 'little' ? '小端序' : '大端序'}`);
        return systemEndianness;
    }

    // 新增方法：更新播放器状态
    updatePlayerState(updates) {
        Object.assign(this.playerState, updates);
    }

    // 新增方法：更新音频数据
    updateAudioData(updates) {
        Object.assign(this.audioData, updates);
    }

    // 新增方法：更新音频配置
    updateConfig(updates) {
        Object.assign(this.config, updates);
    }

    // 新增方法：统一管理按钮状态
    updateAllButtonsState(state) {
        const buttons = {
            play: document.getElementById('playButton'),
            stop: document.getElementById('stopButton'),
            convert: document.getElementById('convertButton'),
            convertWav: document.getElementById('convertWavButton')
        };

        for (const [key, button] of Object.entries(buttons)) {
            if (button) {
                button.disabled = state === 'disabled';
            }
        }
    }

    // 新增：绘制网格的通用方法
    drawGrid(ctx, width, height) {
        ctx.strokeStyle = '#f0f0f0';
        ctx.lineWidth = 1;

        // 绘制水平线
        for (let i = 0; i < height; i += 40) {
            ctx.beginPath();
            ctx.moveTo(0, i);
            ctx.lineTo(width, i);
            ctx.stroke();
        }

        // 绘制垂直线
        for (let i = 0; i < width; i += 100) {
            ctx.beginPath();
            ctx.moveTo(i, 0);
            ctx.lineTo(i, height);
            ctx.stroke();
        }
    }

    // 新增：更新音频显示信息的通用方法
    updateDisplayInfo(type, size, duration, additionalInfo = {}) {
        let infoHTML = `
            <span class="file-tag type">${type}</span>
            <span class="file-tag size">${(size / 1024).toFixed(2)} KB</span>
            <span class="file-tag duration">${this.formatTime(duration)}</span>
        `;

        if (type === 'PCM') {
            infoHTML += `
                <span class="file-tag sample-rate">${this.config.sampleRate}Hz</span>
                <span class="file-tag channels">${this.config.channels}ch</span>
                <span class="file-tag bit-depth">${this.config.bitDepth}bit</span>
            `;
        }

        this.fileInfo.innerHTML = infoHTML;
        this.durationDisplay.textContent = this.formatTime(duration);
    }

    // 新增：通用的音频数据处理方法
    processAudioData(data, normalize = true) {
        if (!data) return null;
        
        const processedData = new Float32Array(data.length);
        const maxValue = normalize ? 32768.0 : 1.0;

        for (let i = 0; i < data.length; i++) {
            processedData[i] = normalize ? data[i] / maxValue : data[i];
        }

        return processedData;
    }

    // 新增：创建音频缓冲区的方法
    createAudioBuffer(pcmData) {
        this.audioData.audioBuffer = this.audioContext.createBuffer(
            1,
            pcmData.length,
            this.config.sampleRate
        );
        this.audioData.audioBuffer.getChannelData(0).set(pcmData);
    }

    // 新增：验证PCM文件的方法
    validatePCMFile(data) {
        if (data.byteLength === 0) {
            throw new Error('PCM 文件为空');
        }
        if (data.byteLength % 2 !== 0) {
            throw new Error('无效的 PCM 文件格式：文件大小必须是 2 的倍数');
        }
    }
} 