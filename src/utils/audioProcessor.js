/**
 * Audio Processor Utility
 * Handles microphone capture, resampling to 16kHz, and Float32→Int16 conversion
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

    /**
     * Initialize and request microphone access
     */
    async initialize() {
        try {
            // Request microphone access with optimal settings
            this.mediaStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    channelCount: 1, // Force mono
                    sampleRate: 16000, // Request 16kHz (may not be honored)
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false // DISABLE auto gain - we want max volume
                }
            });

            // Create AudioContext with 16kHz sample rate
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
                sampleRate: 16000
            });

            console.log(`✅ AudioContext created: ${this.audioContext.sampleRate}Hz`);

            // Log selected microphone
            const tracks = this.mediaStream.getAudioTracks();
            if (tracks.length > 0) {
                console.log(`🎙️ Using microphone: ${tracks[0].label}`);
            }

            return true;
        } catch (error) {
            console.error('❌ Microphone access denied:', error);
            throw error;
        }
    }

    /**
     * Start capturing and processing audio
     */
    async startCapture(callbacks) {
        if (!this.audioContext || !this.mediaStream) {
            await this.initialize();
        }

        this.onAudioData = callbacks.onAudioData;
        this.onAudioLevel = callbacks.onAudioLevel;
        this.isRecording = true;

        // Create source from microphone stream
        this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);

        // Create processor node (4096 samples buffer)
        this.processorNode = this.audioContext.createScriptProcessor(4096, 1, 1);

        this.processorNode.onaudioprocess = (e) => {
            if (!this.isRecording) return;

            const inputData = e.inputBuffer.getChannelData(0); // Float32Array

            // Calculate RMS for audio level
            const rms = this.calculateRMS(inputData);

            // Apply gain boost for better visualization
            const boostedRMS = rms * 10.0; // 10x boost for meter

            // Log periodically for debugging
            if (Math.random() < 0.05) { // 5% chance to log
                console.log(`🎤 Audio Level - Raw: ${rms.toFixed(4)}, Boosted: ${boostedRMS.toFixed(4)}`);
            }

            if (this.onAudioLevel) {
                this.onAudioLevel(Math.min(boostedRMS, 1.0)); // Cap at 1.0
            }

            // Convert Float32 → Int16
            const pcmData = this.float32ToInt16(inputData);

            // Send PCM data
            if (this.onAudioData && pcmData.length > 0) {
                this.onAudioData(pcmData.buffer); // Send as ArrayBuffer
            }
        };

        // Connect nodes: Source → Processor → Destination
        this.sourceNode.connect(this.processorNode);
        this.processorNode.connect(this.audioContext.destination);

        console.log('🎙️ Audio capture started');
    }

    /**
     * Stop capturing audio
     */
    stopCapture() {
        this.isRecording = false;

        if (this.processorNode) {
            this.processorNode.disconnect();
            this.processorNode = null;
        }

        if (this.sourceNode) {
            this.sourceNode.disconnect();
            this.sourceNode = null;
        }

        console.log('⏹️ Audio capture stopped');
    }

    /**
     * Cleanup resources
     */
    cleanup() {
        this.stopCapture();

        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach(track => track.stop());
            this.mediaStream = null;
        }

        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }

        console.log('🧹 Audio processor cleaned up');
    }

    /**
     * Convert Float32Array to Int16Array
     */
    float32ToInt16(float32Array) {
        const int16Array = new Int16Array(float32Array.length);

        for (let i = 0; i < float32Array.length; i++) {
            // Clamp to [-1, 1]
            const s = Math.max(-1, Math.min(1, float32Array[i]));
            // Convert to 16-bit range
            int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }

        return int16Array;
    }

    /**
     * Calculate RMS (Root Mean Square) for audio level
     */
    calculateRMS(float32Array) {
        let sum = 0;
        for (let i = 0; i < float32Array.length; i++) {
            sum += float32Array[i] * float32Array[i];
        }
        return Math.sqrt(sum / float32Array.length);
    }

    /**
     * Get current sample rate
     */
    getSampleRate() {
        return this.audioContext ? this.audioContext.sampleRate : null;
    }
}

export default AudioProcessor;
