class VADService {
    constructor() {
        this.audioContext = null;
        this.analyser = null;
        this.mediaStream = null;
        this.isMonitoring = false;
        this.isSpeaking = false;
        this.silenceTimer = null;

        // Configuration
        this.silenceThreshold = 2000; // 2 seconds
        this.volumeThreshold = -20; // dB
        this.checkInterval = 100; // ms
        this.minVoiceDuration = 800; // ms - minimum duration to filter keyboard typing

        // Callbacks
        this.onVoiceStart = null;
        this.onVoiceEnd = null;
        this.onVolumeChange = null;

        // Tracking
        this.voiceStartTime = null;
    }

    async startMonitoring(stream) {
        try {
            console.log('🎧 Starting VAD monitoring...');

            this.mediaStream = stream;
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.analyser = this.audioContext.createAnalyser();

            const source = this.audioContext.createMediaStreamSource(stream);
            source.connect(this.analyser);

            this.analyser.fftSize = 2048;
            this.analyser.smoothingTimeConstant = 0.8; // Moderate smoothing

            this.isMonitoring = true;
            this.monitorVolume();

            console.log('✅ VAD monitoring started');
            return true;
        } catch (error) {
            console.error('❌ Failed to start VAD monitoring:', error);
            throw error;
        }
    }

    monitorVolume() {
        if (!this.isMonitoring) return;

        const bufferLength = this.analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        this.analyser.getByteFrequencyData(dataArray);

        // Simple average calculation
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
            sum += dataArray[i];
        }
        const average = sum / bufferLength;

        // Convert to dB
        const volume = average > 0 ? 20 * Math.log10(average / 255) : -100;

        // Emit volume change
        if (this.onVolumeChange) {
            this.onVolumeChange(volume);
        }

        // Voice activity detection
        const isCurrentlySpeaking = volume > this.volumeThreshold;

        if (isCurrentlySpeaking && !this.isSpeaking) {
            // Voice started
            console.log('🗣️ Voice detected! Volume:', volume.toFixed(2) + 'dB', 'Threshold:', this.volumeThreshold + 'dB');
            this.isSpeaking = true;
            this.voiceStartTime = Date.now();

            // Clear silence timer
            if (this.silenceTimer) {
                clearTimeout(this.silenceTimer);
                this.silenceTimer = null;
            }

            if (this.onVoiceStart) {
                this.onVoiceStart();
            }
        } else if (!isCurrentlySpeaking && this.isSpeaking) {
            // Potential silence - start timer
            if (!this.silenceTimer) {
                console.log('🔇 Silence detected! Volume:', volume.toFixed(2) + 'dB', '< Threshold:', this.volumeThreshold + 'dB', '| Waiting', this.silenceThreshold / 1000, 'seconds...');
                this.silenceTimer = setTimeout(() => {
                    const voiceDuration = Date.now() - this.voiceStartTime;
                    console.log('⏹️ Voice duration:', voiceDuration, 'ms | Min required:', this.minVoiceDuration, 'ms');

                    this.isSpeaking = false;
                    this.silenceTimer = null;

                    // Only trigger onVoiceEnd if voice was long enough
                    if (voiceDuration >= this.minVoiceDuration) {
                        console.log('✅ Confirmed silence - voice ended');
                        if (this.onVoiceEnd) {
                            this.onVoiceEnd();
                        }
                    } else {
                        console.log('⚠️ Voice too short, ignoring (likely non-voice sound)');
                    }
                }, this.silenceThreshold);
            }
        } else if (isCurrentlySpeaking && this.isSpeaking) {
            // Still speaking - reset silence timer
            if (this.silenceTimer) {
                console.log('🔄 Voice continues, canceling silence timer. Volume:', volume.toFixed(2) + 'dB');
                clearTimeout(this.silenceTimer);
                this.silenceTimer = null;
            }
        }

        // Continue monitoring
        setTimeout(() => this.monitorVolume(), this.checkInterval);
    }

    stopMonitoring() {
        console.log('🛑 Stopping VAD monitoring...');

        this.isMonitoring = false;

        if (this.silenceTimer) {
            clearTimeout(this.silenceTimer);
            this.silenceTimer = null;
        }

        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }

        this.analyser = null;
        this.isSpeaking = false;

        console.log('✅ VAD monitoring stopped');
    }

    setCallbacks({ onVoiceStart, onVoiceEnd, onVolumeChange }) {
        this.onVoiceStart = onVoiceStart;
        this.onVoiceEnd = onVoiceEnd;
        this.onVolumeChange = onVolumeChange;
    }

    setSilenceThreshold(ms) {
        this.silenceThreshold = ms;
        console.log('🔧 Silence threshold set to', ms / 1000, 'seconds');
    }

    setVolumeThreshold(db) {
        this.volumeThreshold = db;
        console.log('🔧 Volume threshold set to', db, 'dB');
    }
}

export const vadService = new VADService();
