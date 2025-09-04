// 旧版：WebAudio 播放实现
(function () {
    class WebAudioPlayer {
        constructor(options = {}) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 2048;
            this.config = {
                sampleRate: options.sampleRate || 48000,
                bitDepth: options.bitDepth || 16,
                channels: options.channels || 1,
                endianness: options.endianness || (window.Utils ? Utils.detectSystemEndianness() : 'little'),
                sampleFormat: options.sampleFormat || 'int'
            };
            this.state = { isPlaying: false, currentTime: 0, pausedAt: 0, startTime: 0 };
            this.data = { audioBuffer: null, source: null, rawPcmData: null };
            this.onTimeUpdate = options.onTimeUpdate || (() => {});
            this.onStateChange = options.onStateChange || (() => {});
        }

        loadPCM(arrayBuffer) {
            this.data.rawPcmData = arrayBuffer;
            const bytesPerSample = this.config.bitDepth / 8;
            const totalSamples = Math.floor(arrayBuffer.byteLength / (bytesPerSample * this.config.channels));
            const channelData = Array(this.config.channels).fill().map(() => new Float32Array(totalSamples));
            const view = new DataView(arrayBuffer);
            const little = this.config.endianness === 'little';
            for (let i = 0; i < totalSamples; i++) {
                for (let ch = 0; ch < this.config.channels; ch++) {
                    const offset = (i * this.config.channels + ch) * bytesPerSample;
                    let sample = 0;
                    switch (this.config.bitDepth) {
                        case 8:
                            sample = view.getInt8(offset) / 128.0; break;
                        case 16:
                            sample = view.getInt16(offset, little) / 32768.0; break;
                        case 24: {
                            const b1 = view.getUint8(offset);
                            const b2 = view.getUint8(offset + 1);
                            const b3 = view.getUint8(offset + 2);
                            let v = little ? (b3 << 16) | (b2 << 8) | b1 : (b1 << 16) | (b2 << 8) | b3;
                            if (v & 0x800000) v |= ~0xFFFFFF;
                            sample = v / 8388608.0; break; }
                        case 32:
                            if (this.config.sampleFormat === 'float') sample = view.getFloat32(offset, little);
                            else sample = view.getInt32(offset, little) / 2147483648.0;
                            break;
                        default:
                            throw new Error('Unsupported bit depth');
                    }
                    channelData[ch][i] = sample;
                }
            }
            const buffer = this.audioContext.createBuffer(this.config.channels, totalSamples, this.config.sampleRate);
            for (let ch = 0; ch < this.config.channels; ch++) buffer.copyToChannel(channelData[ch], ch);
            this.data.audioBuffer = buffer;
            this.state.currentTime = 0;
            this.state.pausedAt = 0;
            this.onStateChange({ type: 'loaded', duration: buffer.duration });
        }

        loadAudioBuffer(audioBuffer) {
            this.data.audioBuffer = audioBuffer;
            this.state.currentTime = 0;
            this.state.pausedAt = 0;
            this.onStateChange({ type: 'loaded', duration: audioBuffer.duration });
        }

        play(startAt = null) {
            if (!this.data.audioBuffer || this.state.isPlaying) return;
            this.data.source = this.audioContext.createBufferSource();
            this.data.source.buffer = this.data.audioBuffer;
            this.data.source.connect(this.analyser);
            this.analyser.connect(this.audioContext.destination);
            const t = startAt != null ? startAt : this.state.pausedAt;
            this.data.source.start(0, t);
            this.state.startTime = this.audioContext.currentTime;
            this.state.pausedAt = t;
            this.state.currentTime = t;
            this.state.isPlaying = true;
            this._tick();
            this.data.source.onended = () => {
                if (!this.state.isPlaying) return;
                this.stop();
            };
            this.onStateChange({ type: 'play' });
        }

        pause() {
            if (this.data.source) {
                try { this.data.source.stop(); } catch (_) {}
                this.data.source = null;
            }
            this.state.pausedAt = this.state.currentTime;
            this.state.isPlaying = false;
            this.onStateChange({ type: 'pause' });
        }

        stop() {
            if (this.data.source) {
                try { this.data.source.stop(); } catch (_) {}
                this.data.source = null;
            }
            this.state.isPlaying = false;
            this.state.currentTime = 0;
            this.state.pausedAt = 0;
            this.onStateChange({ type: 'stop' });
        }

        seek(time) {
            const wasPlaying = this.state.isPlaying;
            if (wasPlaying) this.pause();
            this.state.pausedAt = Math.max(0, Math.min(time, this.data.audioBuffer ? this.data.audioBuffer.duration : 0));
            this.state.currentTime = this.state.pausedAt;
            if (wasPlaying) this.play();
            this.onTimeUpdate(this.state.currentTime);
        }

        _tick() {
            if (!this.state.isPlaying || !this.data.audioBuffer) return;
            const played = this.audioContext.currentTime - this.state.startTime;
            this.state.currentTime = Math.min(this.state.pausedAt + played, this.data.audioBuffer.duration);
            this.onTimeUpdate(this.state.currentTime);
            if (this.state.currentTime < this.data.audioBuffer.duration) {
                requestAnimationFrame(() => this._tick());
            } else {
                this.stop();
            }
        }
    }

    window.WebAudioPlayer = WebAudioPlayer;
})();


