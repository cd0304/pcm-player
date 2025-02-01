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

        this.initializeDOMElements();

        this.setupEventListeners();
        this.setupSampleButton();
        this.setupSampleRateControl();
    }

    initializeDOMElements() {
        this.canvas = document.getElementById('waveformCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.currentTimeDisplay = document.getElementById('currentTime');
        this.durationDisplay = document.getElementById('duration');
        this.fileInfo = document.getElementById('fileInfo');

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

            // 从文件名检测采样率并更新
            const detectedSampleRate = this.detectSampleRateFromFileName(file.name);
            if (detectedSampleRate !== this.sampleRate) {
                this.sampleRate = detectedSampleRate;
                // 更新采样率选择器的值
                const sampleRateSelect = document.getElementById('sampleRateSelect');
                if (sampleRateSelect) {
                    // 如果检测到的采样率在选项中存在，就选中它
                    const option = Array.from(sampleRateSelect.options)
                        .find(opt => parseInt(opt.value) === detectedSampleRate);
                    
                    if (option) {
                        sampleRateSelect.value = detectedSampleRate;
                    } else {
                        console.log(`检测到的采样率 ${detectedSampleRate}Hz 不在预设选项中`);
                    }
                }
            }

            // 存储原始PCM数据
            this.rawPcmData = await file.arrayBuffer();
            
            // 验证文件大小
            if (this.rawPcmData.byteLength === 0) {
                throw new Error('PCM 文件为空');
            }
            
            // 验证文件大小是否为偶数（因为每个采样点是 16 位）
            if (this.rawPcmData.byteLength % 2 !== 0) {
                throw new Error('无效的 PCM 文件格式：文件大小必须是 2 的倍数');
            }

            const pcmData = new Float32Array(this.rawPcmData.byteLength / 2);
            const dataView = new DataView(this.rawPcmData);

            // 将 16 位整数转换为浮点数
            for (let i = 0; i < pcmData.length; i++) {
                const int16 = dataView.getInt16(i * 2, true);  // true 表示小端字节序
                pcmData[i] = int16 / 32768.0;  // 归一化到 [-1, 1] 范围
            }

            // 验证转换后的数据
            if (pcmData.length === 0) {
                throw new Error('PCM 数据转换后长度为 0');
            }

            // 创建音频缓冲区
            this.audioBuffer = this.audioContext.createBuffer(
                1,                // 单声道
                pcmData.length,   // 采样点数量
                this.sampleRate   // 采样率
            );
            
            // 将数据写入音频缓冲区
            this.audioBuffer.getChannelData(0).set(pcmData);

            // 更新 UI
            document.getElementById('playButton').disabled = false;
            document.getElementById('stopButton').disabled = false;

            this.fileInfo.textContent = `文件名: ${file.name} | 大小: ${(file.size / 1024).toFixed(2)} KB | 时长: ${this.formatTime(this.audioBuffer.duration)}`;
            this.durationDisplay.textContent = this.formatTime(this.audioBuffer.duration);

            // 绘制波形
            this.drawWaveform(pcmData);
            this.resetPlayButton('play');

        } catch (error) {
            console.error('处理 PCM 文件时出错:', error);
            alert(`处理 PCM 文件时出错: ${error.message}`);
            
            // 重置状态
            this.rawPcmData = null;
            this.audioBuffer = null;
            document.getElementById('playButton').disabled = true;
            document.getElementById('stopButton').disabled = true;
            this.fileInfo.textContent = '文件处理失败';
            this.durationDisplay.textContent = '00:00';
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
                timePosition: (startIndex / pcmData.length) * this.audioBuffer.duration
            });
        }

        // 绘制波形
        this.drawCurrentState();
    }

    drawCurrentState() {
        if (!this.waveformPoints || !this.audioBuffer) return;

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
        const currentTime = this.isPlaying ?
            this.pausedAt + (this.audioContext.currentTime - this.startTime) :
            this.pausedAt;

        // 找到当前时间对应的波形点索引
        const currentIndex = this.waveformPoints.findIndex(point => point.timePosition >= currentTime);

        // 绘制已播放部分
        ctx.beginPath();
        ctx.strokeStyle = '#1976D2';
        ctx.lineWidth = 2;

        for (let i = 0; i < currentIndex; i++) {
            const point = this.waveformPoints[i];
            if (i === 0) {
                ctx.moveTo(point.x, point.y);
            } else {
                ctx.lineTo(point.x, point.y);
            }
        }
        ctx.stroke();

        // 绘制未播放部分
        if (currentIndex >= 0) {
            ctx.beginPath();
            ctx.strokeStyle = '#2196F3';
            ctx.lineWidth = 2;

            for (let i = currentIndex; i < this.waveformPoints.length; i++) {
                const point = this.waveformPoints[i];
                if (i === currentIndex) {
                    ctx.moveTo(point.x, point.y);
                } else {
                    ctx.lineTo(point.x, point.y);
                }
            }
            ctx.stroke();
        }

        // 绘制进度指示器
        if (currentIndex >= 0) {
            const currentX = this.waveformPoints[currentIndex].x;
            ctx.beginPath();
            ctx.strokeStyle = '#1976D2';
            ctx.lineWidth = 2;
            ctx.moveTo(currentX, 0);
            ctx.lineTo(currentX, height);
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
        if (this.isPlaying) {
            this.pause();
        } else {
            const seekTime = this.currentTime;
            this.play(seekTime);
        }
    }

    pause() {
        if (!this.isPlaying || !this.source) return;

        // 计算实际暂停时的时间位置
        const currentTime = this.audioContext.currentTime - this.startTime + this.pausedAt;
        this.pausedAt = Math.min(currentTime, this.audioBuffer.duration);

        this.source.stop();
        this.source = null;
        this.isPlaying = false;

        // 更新显示
        this.currentTime = this.pausedAt;
        this.currentTimeDisplay.textContent = this.formatTime(this.currentTime);

        this.resetPlayButton('resume');
        this.drawCurrentState();
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
        if (this.source) {
            this.source.stop();
            this.source = null;
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
        // 常见的采样率数值
        const commonSampleRates = [8000, 16000, 22050, 24000, 32000, 44100, 48000, 96000];
        
        // 尝试从文件名中匹配数字
        const matches = fileName.match(/[_-]?(\d{4,6})(hz|k)?[_-]?/i);
        if (matches) {
            let detectedRate = parseInt(matches[1]);
            
            // 如果数字是以k结尾，将其转换为完整的采样率
            if (matches[2] && matches[2].toLowerCase() === 'k') {
                detectedRate *= 1000;
            }
            
            // 验证检测到的采样率是否在合理范围内
            if (commonSampleRates.includes(detectedRate)) {
                console.log(`从文件名检测到采样率: ${detectedRate}Hz`);
                return detectedRate;
            }
        }
        
        console.log('未从文件名检测到有效采样率，使用默认值: 48000Hz');
        return 48000;
    }
} 