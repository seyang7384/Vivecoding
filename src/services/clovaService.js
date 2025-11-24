import { medicalKeywords } from '../config/medicalKeywords';

class ClovaService {
    constructor() {
        this.audioContext = null;
        this.mediaStream = null;
        this.processor = null;
        this.analyser = null;
        this.sockets = {
            left: null,
            right: null
        };
        this.isRecording = false;
        this.isAutoMode = false;
        this.silenceTimer = null;
        this.silenceTimeout = 1500;

        this.callbacks = {
            onLeftTranscript: null,
            onRightTranscript: null,
            onError: null,
            onVadStatusChange: null,
            onAudioLevel: null
        };
    }

    async startRecording(callbacks, autoMode = false) {
        this.callbacks = { ...this.callbacks, ...callbacks };
        this.isAutoMode = autoMode;

        try {
            this.mediaStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    channelCount: 2,
                    echoCancellation: false,
                    noiseSuppression: true,
                    autoGainControl: false
                }
            });

            this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
                sampleRate: 44100
            });

            const source = this.audioContext.createMediaStreamSource(this.mediaStream);

            // Analyser for visualization
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 256;
            source.connect(this.analyser);

            // Use ScriptProcessor directly without explicit splitter
            // This allows handling both mono (1ch) and stereo (2ch) inputs safely
            this.processor = this.audioContext.createScriptProcessor(4096, 2, 2);

            source.connect(this.processor);
            this.processor.connect(this.audioContext.destination);

            await this.connectWebSockets();

            this.processor.onaudioprocess = (e) => {
                // Always check audio level for visualization
                const level = this.checkAudioLevel();
                if (this.callbacks.onAudioLevel) {
                    this.callbacks.onAudioLevel(level);
                }

                // VAD Logic
                if (this.isAutoMode) {
                    this.handleVad(level);
                }

                if (!this.isRecording) return;

                const numChannels = e.inputBuffer.numberOfChannels;
                let leftChannel, rightChannel;

                if (numChannels === 1) {
                    // Mono input: Duplicate to both channels (fallback)
                    leftChannel = e.inputBuffer.getChannelData(0);
                    rightChannel = e.inputBuffer.getChannelData(0);
                } else {
                    // Stereo input: Separate channels
                    leftChannel = e.inputBuffer.getChannelData(0);
                    rightChannel = e.inputBuffer.getChannelData(1);
                }

                const leftPCM = this.downsampleAndConvert(leftChannel, this.audioContext.sampleRate, 16000);
                const rightPCM = this.downsampleAndConvert(rightChannel, this.audioContext.sampleRate, 16000);

                this.sendAudio('left', leftPCM);
                this.sendAudio('right', rightPCM);
            };

            if (!this.isAutoMode) {
                this.isRecording = true;
            } else {
                console.log('👂 VAD Mode: Listening...');
                if (this.callbacks.onVadStatusChange) this.callbacks.onVadStatusChange('listening');
            }

            console.log('🎙️ Clova Speech Service Started');

        } catch (error) {
            console.error('❌ Failed to start recording:', error);
            if (this.callbacks.onError) this.callbacks.onError(error);
        }
    }

    checkAudioLevel() {
        if (!this.analyser) return 0;
        const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
        this.analyser.getByteFrequencyData(dataArray);

        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
        }
        return sum / dataArray.length; // Average volume (0-255)
    }

    handleVad(level) {
        const isSpeech = level > 20; // Threshold

        if (isSpeech) {
            if (this.silenceTimer) {
                clearTimeout(this.silenceTimer);
                this.silenceTimer = null;
            }

            if (!this.isRecording) {
                this.isRecording = true;
                console.log('🗣️ Speech Detected! Recording started.');
                if (this.callbacks.onVadStatusChange) this.callbacks.onVadStatusChange('speech_start');
            }
        } else {
            if (this.isRecording && !this.silenceTimer) {
                this.silenceTimer = setTimeout(() => {
                    this.isRecording = false;
                    console.log('🤫 Silence Detected. Recording paused.');
                    if (this.callbacks.onVadStatusChange) this.callbacks.onVadStatusChange('speech_end');
                }, this.silenceTimeout);
            }
        }
    }

    stopRecording() {
        this.isRecording = false;
        this.isAutoMode = false;
        if (this.silenceTimer) clearTimeout(this.silenceTimer);

        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach(track => track.stop());
        }
        if (this.processor) {
            this.processor.disconnect();
        }
        if (this.analyser) {
            this.analyser.disconnect();
        }
        if (this.audioContext) {
            this.audioContext.close();
        }

        this.closeSocket('left');
        this.closeSocket('right');

        console.log('⏹️ Clova Speech Service Stopped');
    }

    async connectWebSockets() {
        const createSocket = (role) => {
            return new Promise((resolve, reject) => {
                const ws = new WebSocket(`ws://localhost:3000?role=${role}`);

                ws.onopen = () => {
                    console.log(`✅ WebSocket Connected: ${role}`);
                    ws.send(JSON.stringify({
                        type: 'start',
                        config: {
                            language: 'ko-KR',
                            completion: 'sync',
                            boostings: medicalKeywords
                        }
                    }));
                    resolve(ws);
                };

                ws.onmessage = (event) => {
                    try {
                        const msg = JSON.parse(event.data);
                        if (msg.type === 'transcription') {
                            if (role === 'Doctor' && this.callbacks.onLeftTranscript) {
                                this.callbacks.onLeftTranscript(msg.data.text);
                            } else if (role === 'Nurse' && this.callbacks.onRightTranscript) {
                                this.callbacks.onRightTranscript(msg.data.text);
                            }
                        } else if (msg.type === 'error') {
                            console.error(`[${role}] Server Error:`, msg.message);
                            if (this.callbacks.onError) this.callbacks.onError(new Error(`Server: ${msg.message}`));
                        }
                    } catch (e) {
                        console.error('Failed to parse message:', e);
                    }
                };

                ws.onerror = (error) => {
                    console.error(`[${role}] WebSocket Error:`, error);
                    reject(error);
                };
            });
        };

        this.sockets.left = await createSocket('Doctor');
        this.sockets.right = await createSocket('Nurse');
    }

    sendAudio(channel, pcmData) {
        const socket = channel === 'left' ? this.sockets.left : this.sockets.right;
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(pcmData);
        }
    }

    closeSocket(channel) {
        const socket = channel === 'left' ? this.sockets.left : this.sockets.right;
        if (socket) {
            socket.send(JSON.stringify({ type: 'stop' }));
            socket.close();
        }
    }

    downsampleAndConvert(buffer, inputRate, outputRate) {
        if (outputRate === inputRate) {
            return this.floatTo16BitPCM(buffer);
        }

        const compression = inputRate / outputRate;
        const length = buffer.length / compression;
        const result = new Float32Array(length);

        let index = 0;
        let inputIndex = 0;

        while (index < length) {
            result[index] = buffer[Math.floor(inputIndex)];
            inputIndex += compression;
            index++;
        }

        return this.floatTo16BitPCM(result);
    }

    floatTo16BitPCM(output) {
        const buffer = new ArrayBuffer(output.length * 2);
        const view = new DataView(buffer);
        for (let i = 0; i < output.length; i++) {
            const s = Math.max(-1, Math.min(1, output[i]));
            view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true); // Little Endian
        }
        return buffer;
    }
}

export const clovaService = new ClovaService();
