class PCMPlayer {
    constructor() {
        this.sampleRate = 24000;
        this.isPlaying = false;
        this.audioBuffer = null;
        this.source = null;
        this.startTime = 0;
        this.currentTime = 0;
        this.pausedAt = 0;
        
        this.initializeDOMElements();
        
        this.setupEventListeners();
        this.setupSampleButton();
    }

    initializeDOMElements() {
        this.canvas = document.getElementById('waveformCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.progressBar = document.getElementById('progressBar');
        this.progressContainer = document.getElementById('progressContainer');
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

    handleProgressClick(e) {
        if (!this.audioBuffer) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const percentage = x / rect.width;
        const seekTime = percentage * this.audioBuffer.duration;
        
        this.currentTime = seekTime;
        this.pausedAt = seekTime;
        
        if (this.isPlaying) {
            this.source.stop();
            this.play(seekTime);
        } else {
            this.currentTimeDisplay.textContent = this.formatTime(seekTime);
            this.drawCurrentState();
        }
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

        this.currentTime = 0;
        this.pausedAt = 0;
        this.resetPlayButton('play');
        
        const arrayBuffer = await file.arrayBuffer();
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
        
        this.fileInfo.textContent = `文件名: ${file.name} | 大小: ${(file.size / 1024).toFixed(2)} KB | 时长: ${this.formatTime(this.audioBuffer.duration)}`;
        this.durationDisplay.textContent = this.formatTime(this.audioBuffer.duration);
        
        this.drawWaveform(pcmData);
        
        this.resetPlayButton('play');
    }

    drawWaveform(pcmData) {
        const ctx = this.ctx;
        const width = this.canvas.width;
        const height = this.canvas.height;
        const step = Math.ceil(pcmData.length / width);
        
        ctx.clearRect(0, 0, width, height);
        
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
        
        this.waveformPoints = [];
        
        ctx.beginPath();
        const gradient = ctx.createLinearGradient(0, 0, 0, height);
        gradient.addColorStop(0, 'rgba(33, 150, 243, 0.2)');
        gradient.addColorStop(1, 'rgba(33, 150, 243, 0.1)');
        
        const centerY = height / 2;
        
        for (let i = 0; i < width; i++) {
            const index = i * step;
            let sum = 0;
            let count = 0;
            
            for (let j = 0; j < step && index + j < pcmData.length; j++) {
                sum += pcmData[index + j];
                count++;
            }
            
            const average = sum / count;
            const y = centerY + (average * centerY * 0.95);
            this.waveformPoints.push({x: i, y: y});
            
            if (i === 0) {
                ctx.moveTo(i, y);
            } else {
                ctx.lineTo(i, y);
            }
        }
        
        for (let i = width - 1; i >= 0; i--) {
            const point = this.waveformPoints[i];
            const y = centerY - (point.y - centerY);
            ctx.lineTo(i, y);
        }
        
        ctx.closePath();
        ctx.fillStyle = gradient;
        ctx.fill();
        
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

    drawCurrentState() {
        const ctx = this.ctx;
        const width = this.canvas.width;
        const height = this.canvas.height;
        
        ctx.clearRect(0, 0, width, height);
        
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
        
        if (this.waveformPoints) {
            const centerY = height / 2;
            
            ctx.beginPath();
            const gradient = ctx.createLinearGradient(0, 0, 0, height);
            gradient.addColorStop(0, 'rgba(33, 150, 243, 0.2)');
            gradient.addColorStop(1, 'rgba(33, 150, 243, 0.1)');
            
            this.waveformPoints.forEach((point, i) => {
                if (i === 0) {
                    ctx.moveTo(point.x, point.y);
                } else {
                    ctx.lineTo(point.x, point.y);
                }
            });
            
            for (let i = this.waveformPoints.length - 1; i >= 0; i--) {
                const point = this.waveformPoints[i];
                const y = centerY - (point.y - centerY);
                ctx.lineTo(point.x, y);
            }
            
            ctx.closePath();
            ctx.fillStyle = gradient;
            ctx.fill();
            
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
        
        if (this.audioBuffer) {
            const progress = this.currentTime / this.audioBuffer.duration;
            const progressWidth = width * progress;
            ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
            ctx.fillRect(progressWidth, 0, width - progressWidth, height);
        }
    }

    updateProgress() {
        if (!this.isPlaying) return;
        
        const currentTime = this.audioContext.currentTime - this.startTime;
        const duration = this.audioBuffer.duration;
        
        this.currentTime = currentTime;
        this.currentTimeDisplay.textContent = this.formatTime(currentTime);
        
        this.drawCurrentState();
        
        if (this.isPlaying) {
            requestAnimationFrame(() => this.updateProgress());
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
        
        this.pausedAt = this.audioContext.currentTime - this.startTime;
        
        this.source.stop();
        this.isPlaying = false;
        
        this.currentTime = this.pausedAt;
        
        this.resetPlayButton('resume');
        this.drawCurrentState();
    }

    play(startTime = null) {
        if (this.isPlaying || !this.audioBuffer) return;
        
        this.source = this.audioContext.createBufferSource();
        this.source.buffer = this.audioBuffer;
        this.source.connect(this.audioContext.destination);
        
        let actualStartTime;
        if (startTime !== null) {
            actualStartTime = startTime;
        } else {
            actualStartTime = this.pausedAt || 0;
        }
        
        if (actualStartTime >= this.audioBuffer.duration) {
            actualStartTime = 0;
        }
        
        this.source.start(0, actualStartTime);
        this.startTime = this.audioContext.currentTime - actualStartTime;
        this.isPlaying = true;
        
        this.resetPlayButton('pause');
        
        this.updateProgress();
        
        this.source.onended = () => {
            if (this.audioContext.currentTime - this.startTime >= this.audioBuffer.duration) {
                this.isPlaying = false;
                this.pausedAt = 0;
                this.currentTime = 0;
                this.resetPlayButton('play');
                this.drawCurrentState();
            }
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
        if (!this.isPlaying && !this.source) return;
        
        if (this.source) {
            this.source.stop();
        }
        this.isPlaying = false;
        this.currentTime = 0;
        this.pausedAt = 0;
        this.currentTimeDisplay.textContent = '00:00';
        
        this.resetPlayButton('play');
        this.drawCurrentState();
    }
} 