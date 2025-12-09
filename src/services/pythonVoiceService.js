/**
 * Python Voice Service (Browser-Based Audio)
 * Captures microphone audio and streams PCM to Python relay server
 */

import AudioProcessor from '../utils/audioProcessor';

class PythonVoiceService {
    constructor() {
        this.ws = null;
        this.callbacks = {};
        this.audioProcessor = new AudioProcessor();
        this.isRecording = false;
    }

    async connect(callbacks) {
        this.disconnect(); // Ensure clean slate
        this.callbacks = callbacks || {};
        this.isConnecting = true;

        // Initialize audio processor
        try {
            await this.audioProcessor.initialize();
            console.log('✅ Audio processor initialized');
        } catch (error) {
            console.error('❌ Audio initialization failed:', error);
            if (this.callbacks.onError) {
                this.callbacks.onError(error);
            }
            this.isConnecting = false;
            return;
        }

        // Check if disconnected while initializing
        if (!this.isConnecting) {
            console.log('⚠️ Connection aborted during initialization');
            return;
        }

        // Connect WebSocket
        this.ws = new WebSocket('ws://localhost:3001');

        this.ws.onopen = () => {
            console.log('✅ Connected to Python Voice Bridge');
            const sampleRate = this.audioProcessor.getSampleRate();
            console.log(`🎙️ Audio: ${sampleRate}Hz, Mono (1ch), Int16 PCM`);

            if (this.callbacks.onConnect) this.callbacks.onConnect();
        };

        this.ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                console.log('[Python Bridge] Received:', msg);

                if (msg.type === 'transcript' && this.callbacks.onTranscript) {
                    this.callbacks.onTranscript(msg);
                }

                if (msg.type === 'error' && this.callbacks.onError) {
                    this.callbacks.onError(new Error(msg.message));
                }

                if (msg.type === 'corrections' && this.callbacks.onCorrections) {
                    this.callbacks.onCorrections(msg.data);
                }
            } catch (e) {
                console.error('Failed to parse message:', e);
            }
        };

        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            if (this.callbacks.onError) {
                this.callbacks.onError(new Error('WebSocket connection error'));
            }
        };

        this.ws.onclose = () => {
            console.log('❌ Disconnected from Python Voice Bridge');
            this.stop(); // Stop audio capture
            if (this.callbacks.onDisconnect) this.callbacks.onDisconnect();
        };
    }

    async start() {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            // Send start command
            this.ws.send(JSON.stringify({ command: 'start' }));

            // Start audio capture
            await this.audioProcessor.startCapture({
                onAudioData: (pcmBuffer) => {
                    // Send binary PCM data to Python
                    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                        this.ws.send(pcmBuffer);
                    }
                },
                onAudioLevel: (rms) => {
                    // Send audio level to UI
                    if (this.callbacks.onAudioLevel) {
                        this.callbacks.onAudioLevel(rms);
                    }
                }
            });

            this.isRecording = true;
            console.log('🎙️ Recording started');
        } else {
            console.error('WebSocket not connected');
        }
    }

    stop() {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ command: 'stop' }));
        }

        this.audioProcessor.stopCapture();
        this.isRecording = false;
        console.log('⏹️ Recording stopped');
    }

    updateKeywords(keywords) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                command: 'update_keywords',
                keywords: keywords
            }));
            console.log('📚 Sent keyword update:', keywords.length);
        }
    }

    getCorrections() {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ command: 'get_corrections' }));
        }
    }

    saveCorrections(corrections) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                command: 'save_corrections',
                data: corrections
            }));
        }
    }

    disconnect() {
        this.isConnecting = false;
        this.stop();

        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }

        this.audioProcessor.cleanup();
    }
}

// Export singleton instance
const pythonVoiceService = new PythonVoiceService();
export default pythonVoiceService;
