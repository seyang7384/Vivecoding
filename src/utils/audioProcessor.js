/**
 * Audio Processor Utility
 * Handles microphone capture, merging dual USB mics, and Float32→Int16 conversion
 */

class AudioProcessor {
    constructor() {
        this.audioContext = null;
        this.mediaStreams = null; // Array of streams
        this.sourceNodes = null;  // Array of source nodes
        this.processorNode = null;
        this.isRecording = false;
        this.onAudioData = null;
        this.onAudioLevel = null;
        this.micDeviceIds = null; // [mic1, mic2]
    }

    /**
     * Initialize and find microphones
     */
    async initialize() {
        try {
            // 0. Request permission FIRST to ensure we get device labels
            await navigator.mediaDevices.getUserMedia({ audio: true });

            // 1. Find all audio devices
            const devices = await navigator.mediaDevices.enumerateDevices();
            const audioInputs = devices.filter(d => d.kind === 'audioinput');

            console.log("🔎 All Audio Inputs:", audioInputs.map(d => d.label));

            // 2. Filter for wireless microphones
            // Looking for devices with "wireless" in label
            const wirelessMics = audioInputs.filter(d =>
                d.label.toLowerCase().includes('wireless') ||
                d.label.includes('마이크')
            );

            // We need at least 2 mics for dual-channel, otherwise fallback to default
            if (wirelessMics.length >= 2) {
                // Sort by label to ensure consistent ordering (Mic 1 -> Left, Mic 2 -> Right)
                wirelessMics.sort((a, b) => a.label.localeCompare(b.label));

                // Use the first two distinct devices found
                // Filter out duplicates if any (sometimes default and specific device are same)
                const uniqueMics = [];
                const seenIds = new Set();
                for (const mic of wirelessMics) {
                    if (!seenIds.has(mic.deviceId) && mic.deviceId !== 'default' && mic.deviceId !== 'communications') {
                        uniqueMics.push(mic);
                        seenIds.add(mic.deviceId);
                    }
                }

                if (uniqueMics.length >= 2) {
                    this.micDeviceIds = [uniqueMics[0].deviceId, uniqueMics[1].deviceId];
                    console.log(`🎤 Dual Mics Configured: 
                      L: ${uniqueMics[0].label}
                      R: ${uniqueMics[1].label}`);
                } else {
                    // Fallback if filtering removed too many
                    this.micDeviceIds = [wirelessMics[0].deviceId, wirelessMics[1].deviceId];
                    console.log(`⚠️ Using raw filtered mics (potential duplicates):
                      L: ${wirelessMics[0].label}
                      R: ${wirelessMics[1].label}`);
                }

            } else {
                this.micDeviceIds = null; // Use default single device
                console.log('⚠️ Dual mics not found, using default single device');
            }

            // Create AudioContext
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
                sampleRate: 16000
            });
            console.log(`✅ AudioContext created: ${this.audioContext.sampleRate}Hz`);

            return true;
        } catch (error) {
            console.error('❌ Init failed:', error);
            throw error;
        }
    }

    /**
     * Start capturing and processing audio
     */
    async startCapture(callbacks) {
        if (!this.audioContext) await this.initialize();

        this.onAudioData = callbacks.onAudioData;
        this.onAudioLevel = callbacks.onAudioLevel;
        this.isRecording = true;

        try {
            let sourceNode;

            if (this.micDeviceIds && this.micDeviceIds.length === 2) {
                // === DUAL MIC MODE ===
                console.log("🎧 Starting Dual Mic Mode (Merging 2 Devices)");

                // Capture two separate streams
                const stream1 = await navigator.mediaDevices.getUserMedia({
                    audio: { deviceId: { exact: this.micDeviceIds[0] }, echoCancellation: false, noiseSuppression: false, autoGainControl: false }
                });
                const stream2 = await navigator.mediaDevices.getUserMedia({
                    audio: { deviceId: { exact: this.micDeviceIds[1] }, echoCancellation: false, noiseSuppression: false, autoGainControl: false }
                });

                this.mediaStreams = [stream1, stream2];

                // Create sources
                const source1 = this.audioContext.createMediaStreamSource(stream1);
                const source2 = this.audioContext.createMediaStreamSource(stream2);

                // Create Merger (2 inputs -> 1 output with 2 channels)
                const merger = this.audioContext.createChannelMerger(2);
                merger.channelInterpretation = 'speakers';

                // Connect Mic 1 -> Left (Channel 0)
                source1.connect(merger, 0, 0);

                // Connect Mic 2 -> Right (Channel 1)
                source2.connect(merger, 0, 1);

                sourceNode = merger;
                this.sourceNodes = [source1, source2]; // Keep references to disconnect later

            } else {
                // === SINGLE MIC MODE (Fallback) ===
                console.log("🎤 Starting Single Mic Mode");
                const stream = await navigator.mediaDevices.getUserMedia({
                    audio: { channelCount: 2, echoCancellation: false, noiseSuppression: false, autoGainControl: false }
                });
                this.mediaStreams = [stream];
                sourceNode = this.audioContext.createMediaStreamSource(stream);
                this.sourceNodes = [sourceNode];
            }

            // Create Processor (Stereo In/Out)
            this.processorNode = this.audioContext.createScriptProcessor(4096, 2, 2);

            this.processorNode.onaudioprocess = (e) => {
                if (!this.isRecording) return;

                // Get Left/Right Data
                const leftChannel = e.inputBuffer.getChannelData(0);
                const rightChannel = e.inputBuffer.getChannelData(1);

                // Calculate RMS
                const rmsLeft = this.calculateRMS(leftChannel);
                const rmsRight = this.calculateRMS(rightChannel);
                const rms = (rmsLeft + rmsRight) / 2;

                // Log periodically
                if (Math.random() < 0.1) { // Increased log frequency
                    console.log(`🎤 Input L: ${rmsLeft.toFixed(6)} | R: ${rmsRight.toFixed(6)}`);
                }

                if (this.onAudioLevel) this.onAudioLevel(Math.min(rms * 10, 1.0));

                // Convert & Interleave
                const pcmLeft = this.float32ToInt16(leftChannel);
                const pcmRight = this.float32ToInt16(rightChannel);
                const interleaved = this.interleaveStereo(pcmLeft, pcmRight);

                if (this.onAudioData) {
                    this.onAudioData(interleaved.buffer);
                }
            };

            // Connect Graph
            sourceNode.connect(this.processorNode);
            this.processorNode.connect(this.audioContext.destination); // Essential for Chrome to run the processor

            console.log('✅ Audio Graph Connected: Source -> Processor -> Destination');
            console.log(`   Source Channels: ${sourceNode.channelCount}`);
            console.log(`   Context State: ${this.audioContext.state}`);

            // Resume context if suspended (common browser policy)
            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
                console.log('▶️ AudioContext Resumed');
            }

        } catch (err) {
            console.error("❌ Start Capture Failed:", err);
            throw err;
        }
    }

    stopCapture() {
        this.isRecording = false;
        if (this.processorNode) { this.processorNode.disconnect(); this.processorNode = null; }
        if (this.sourceNodes) { this.sourceNodes.forEach(s => s.disconnect()); this.sourceNodes = null; }
        if (this.mediaStreams) {
            this.mediaStreams.forEach(s => s.getTracks().forEach(t => t.stop()));
            this.mediaStreams = null;
        }
        console.log('⏹️ Stopped');
    }

    cleanup() {
        this.stopCapture();
        if (this.audioContext) { this.audioContext.close(); this.audioContext = null; }
        console.log('🧹 Cleanup');
    }

    float32ToInt16(float32Array) {
        const int16Array = new Int16Array(float32Array.length);
        for (let i = 0; i < float32Array.length; i++) {
            const s = Math.max(-1, Math.min(1, float32Array[i]));
            int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        return int16Array;
    }

    interleaveStereo(leftChannel, rightChannel) {
        const length = leftChannel.length + rightChannel.length;
        const interleaved = new Int16Array(length);
        for (let i = 0; i < leftChannel.length; i++) {
            interleaved[i * 2] = leftChannel[i];
            interleaved[i * 2 + 1] = rightChannel[i];
        }
        return interleaved;
    }

    calculateRMS(float32Array) {
        let sum = 0;
        for (let i = 0; i < float32Array.length; i++) {
            sum += float32Array[i] * float32Array[i];
        }
        return Math.sqrt(sum / float32Array.length);
    }

    getSampleRate() {
        return this.audioContext ? this.audioContext.sampleRate : null;
    }
}

export default AudioProcessor;
