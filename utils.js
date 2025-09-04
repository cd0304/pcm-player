// 通用工具集合：提供时间格式化、WAV 头生成、网格绘制、文件名推断与端序检测
(function () {
    const Utils = {
        // 将秒格式化为 00:00 或 00:00:00
        formatTime(seconds) {
            if (!isFinite(seconds) || seconds < 0) seconds = 0;
            const total = Math.floor(seconds);
            const h = Math.floor(total / 3600);
            const m = Math.floor((total % 3600) / 60);
            const s = total % 60;
            const pad = (n) => String(n).padStart(2, '0');
            return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
        },

        // 在画布上绘制浅色网格，便于观察波形
        drawGrid(ctx, width, height) {
            if (!ctx) return;
            const gridX = Math.max(25, Math.floor(width / 20));
            const gridY = Math.max(20, Math.floor(height / 8));
            ctx.save();
            ctx.strokeStyle = '#eee';
            ctx.lineWidth = 1;

            // 垂直网格
            for (let x = 0; x <= width; x += gridX) {
                ctx.beginPath();
                ctx.moveTo(x + 0.5, 0);
                ctx.lineTo(x + 0.5, height);
                ctx.stroke();
            }
            // 水平网格
            for (let y = 0; y <= height; y += gridY) {
                ctx.beginPath();
                ctx.moveTo(0, y + 0.5);
                ctx.lineTo(width, y + 0.5);
                ctx.stroke();
            }

            // 中心线
            ctx.strokeStyle = '#ddd';
            ctx.beginPath();
            ctx.moveTo(0, height / 2 + 0.5);
            ctx.lineTo(width, height / 2 + 0.5);
            ctx.stroke();
            ctx.restore();
        },

        // 创建 WAV 头（PCM，little-endian）
        // dataLength: PCM 数据字节数
        // channels: 声道数
        // sampleRate: 采样率
        // bitDepth: 位深（8/16/24/32）
        createWavHeader(dataLength, channels, sampleRate, bitDepth) {
            const header = new ArrayBuffer(44);
            const view = new DataView(header);
            const writeStr = (offset, str) => { for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i)); };

            const bytesPerSample = Math.max(1, Math.floor(bitDepth / 8));
            const blockAlign = channels * bytesPerSample;
            const byteRate = sampleRate * blockAlign;

            // RIFF chunk descriptor
            writeStr(0, 'RIFF');
            view.setUint32(4, 36 + dataLength, true); // ChunkSize
            writeStr(8, 'WAVE');

            // fmt subchunk
            writeStr(12, 'fmt ');
            view.setUint32(16, 16, true); // Subchunk1Size (PCM)
            view.setUint16(20, 1, true);  // AudioFormat = 1 (PCM)
            view.setUint16(22, channels, true);
            view.setUint32(24, sampleRate, true);
            view.setUint32(28, byteRate, true);
            view.setUint16(32, blockAlign, true);
            view.setUint16(34, bitDepth, true);

            // data subchunk
            writeStr(36, 'data');
            view.setUint32(40, dataLength, true);

            return header;
        },

        // 根据文件名推断采样率（支持如 8000/16000/24000/44100/48000 或 8k/16k/24k/44.1k/48k 等）
        detectSampleRateFromFileName(name) {
            if (!name) return null;
            const lower = String(name).toLowerCase();
            // 优先匹配 44100、48000、24000 等纯数字
            const exact = lower.match(/(?<!\d)(8000|11025|16000|22050|24000|32000|44100|48000|96000)(?!\d)/);
            if (exact) return parseInt(exact[1], 10);
            // 匹配 8k/16k/24k/44.1k/48k
            const k = lower.match(/(8|11\.025|16|22\.05|24|32|44\.1|48|96)k(?!\d)/);
            if (k) {
                const map = { '8': 8000, '11.025': 11025, '16': 16000, '22.05': 22050, '24': 24000, '32': 32000, '44.1': 44100, '48': 48000, '96': 96000 };
                return map[k[1]] || null;
            }
            return null;
        },

        // 根据文件名推断端序（匹配 little/le, big/be）
        detectEndiannessFromFileName(name) {
            if (!name) return null;
            const lower = String(name).toLowerCase();
            if (/(little|\ble\b|_le\b|\ble_)/.test(lower)) return 'little';
            if (/(big|\bbe\b|_be\b|\bbe_)/.test(lower)) return 'big';
            return null;
        },

        // 检测系统端序
        detectSystemEndianness() {
            const buf = new ArrayBuffer(4);
            const u32 = new Uint32Array(buf);
            const u8 = new Uint8Array(buf);
            u32[0] = 0x01020304;
            return u8[0] === 0x04 ? 'little' : 'big';
        }
    };

    window.Utils = Utils;
})();

