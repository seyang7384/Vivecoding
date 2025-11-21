class VoiceService {
    constructor() {
        this.recognition = null;
        this.isListening = false;
        this.onResult = null;
        this.onError = null;
        this.onEnd = null;

        this.initialize();
    }

    initialize() {
        if ('webkitSpeechRecognition' in window) {
            this.recognition = new window.webkitSpeechRecognition();
            this.recognition.continuous = true; // Keep listening
            this.recognition.interimResults = true; // Show partial results
            this.recognition.lang = 'ko-KR'; // Korean

            this.recognition.onresult = (event) => {
                let interimTranscript = '';
                let finalTranscript = '';

                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    if (event.results[i].isFinal) {
                        finalTranscript += event.results[i][0].transcript;
                    } else {
                        interimTranscript += event.results[i][0].transcript;
                    }
                }

                if (this.onResult) {
                    this.onResult({
                        final: finalTranscript,
                        interim: interimTranscript
                    });
                }
            };

            this.recognition.onerror = (event) => {
                console.error('Speech recognition error', event.error);
                if (this.onError) this.onError(event.error);
            };

            this.recognition.onend = () => {
                this.isListening = false;
                if (this.onEnd) this.onEnd();

                // Auto-restart if it was supposed to be listening (unless manually stopped)
                // Note: Browsers might block this if not user-initiated
                // We'll handle auto-restart in the component
            };
        } else {
            console.error('Web Speech API not supported');
        }
    }

    start(onResult, onError, onEnd) {
        if (!this.recognition) return;

        this.onResult = onResult;
        this.onError = onError;
        this.onEnd = onEnd;

        try {
            this.recognition.start();
            this.isListening = true;
        } catch (e) {
            console.error('Failed to start recognition', e);
        }
    }

    stop() {
        if (!this.recognition) return;

        try {
            this.recognition.stop();
            this.isListening = false;
        } catch (e) {
            console.error('Failed to stop recognition', e);
        }
    }
}

export const voiceService = new VoiceService();
