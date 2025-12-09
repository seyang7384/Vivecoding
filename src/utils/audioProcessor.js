/**
 * Audio Processor Utility
 * Handles microphone capture and Mono conversion
 */

class AudioProcessor {
    constructor() {
        this.audioContext = null;
        this.mediaStream = null;
        this.sourceNode = null;
        this.processorNode = null;
        this.isRecording = false;
        this.onAudioData = null;
        this.onAudioLevel = null;
    }

    async initialize() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
                sampleRate: 16000
            });
            return true;
        } catch (error) {
            console.error('❌ Init failed:', error);
            throw error;
        }
    }

    async startCapture(callbacks) {
        if (!this.audioContext) await this.initialize();

        this.onAudioData = callbacks.onAudioData;
        this.onAudioLevel = callbacks.onAudioLevel;
        this.isRecording = true;

        try {
            // Simple Mono Capture
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    channelCount: 1,
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false
                }
            });

            this.mediaStream = stream;
            this.sourceNode = this.audioContext.createMediaStreamSource(stream);

            // Create Processor (Mono In/Out)
            this.processorNode = this.audioContext.createScriptProcessor(4096, 1, 1);

            this.processorNode.onaudioprocess = (e) => {
                if (!this.isRecording) return;

                const inputData = e.inputBuffer.getChannelData(0);

                // Calculate RMS
                let sum = 0;
                for (let i = 0; i < inputData.length; i++) {
                    sum += inputData[i] * inputData[i];
                }
                const rms = Math.sqrt(sum / inputData.length);

                if (this.onAudioLevel) this.onAudioLevel(Math.min(rms * 10, 1.0));

                // Convert Float32 to Int16
                const int16Array = new Int16Array(inputData.length);
                for (let i = 0; i < inputData.length; i++) {
                    const s = Math.max(-1, Math.min(1, inputData[i]));
                    int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
                }

                if (this.onAudioData) {
                    this.onAudioData(int16Array.buffer);
                }
            };

            this.sourceNode.connect(this.processorNode);
            this.processorNode.connect(this.audioContext.destination);

            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }

            console.log('✅ Mono Capture Started');

        } catch (err) {
            console.error("❌ Start Capture Failed:", err);
            throw err;
        }
    }

    stopCapture() {
        this.isRecording = false;
        if (this.processorNode) { this.processorNode.disconnect(); this.processorNode = null; }
        if (this.sourceNode) { this.sourceNode.disconnect(); this.sourceNode = null; }
        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach(t => t.stop());
            this.mediaStream = null;
        }
    }

    cleanup() {
        this.stopCapture();
        if (this.audioContext) { this.audioContext.close(); this.audioContext = null; }
    }

    getSampleRate() {
        return this.audioContext ? this.audioContext.sampleRate : null;
    }
}

export default AudioProcessor;
