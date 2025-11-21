class WhisperService {
    constructor() {
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.isRecording = false;

        // Medical terminology hints for better accuracy
        this.medicalHints = "백하수오, 자감초, 당귀, 탕전실, 발침, 약침, 추나, 예진, 송미령, 황기, 인삼, 천궁, 백출, 백복령, 진피, 반하, 감초, 생강, 대조";
    }

    async startRecording() {
        try {
            // Check if mediaDevices is supported
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error('이 브라우저는 오디오 녹음을 지원하지 않습니다. Chrome이나 Edge를 사용해주세요.');
            }

            console.log('🎤 Requesting microphone access...');
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    sampleRate: 44100
                }
            });

            console.log('✅ Microphone access granted');

            // Use audio/webm for better browser compatibility
            const mimeType = MediaRecorder.isTypeSupported('audio/webm')
                ? 'audio/webm'
                : 'audio/mp4';

            console.log('📼 Recording format:', mimeType);

            this.mediaRecorder = new MediaRecorder(stream, { mimeType });
            this.audioChunks = [];

            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.audioChunks.push(event.data);
                    console.log('📦 Audio chunk received:', event.data.size, 'bytes');
                }
            };

            this.mediaRecorder.start();
            this.isRecording = true;

            console.log('🔴 Recording started');
            return true;
        } catch (error) {
            console.error('❌ Failed to start recording:', error);

            if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
                throw new Error('마이크 권한이 거부되었습니다. 브라우저 설정에서 마이크 권한을 허용해주세요.');
            } else if (error.name === 'NotFoundError') {
                throw new Error('마이크를 찾을 수 없습니다. 마이크가 연결되어 있는지 확인해주세요.');
            }

            throw new Error('마이크 접근 권한이 필요합니다: ' + error.message);
        }
    }

    async stopRecording() {
        return new Promise((resolve, reject) => {
            if (!this.mediaRecorder || !this.isRecording) {
                reject(new Error('녹음이 시작되지 않았습니다.'));
                return;
            }

            console.log('⏹️ Stopping recording...');

            this.mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(this.audioChunks, { type: this.mediaRecorder.mimeType });

                console.log('✅ Recording stopped. Audio size:', audioBlob.size, 'bytes');

                // Stop all tracks
                this.mediaRecorder.stream.getTracks().forEach(track => {
                    track.stop();
                    console.log('🛑 Track stopped:', track.kind);
                });

                this.isRecording = false;
                resolve(audioBlob);
            };

            this.mediaRecorder.stop();
        });
    }

    async transcribe(audioBlob) {
        const apiKey = import.meta.env.VITE_OPENAI_API_KEY;

        console.log('🤖 Starting transcription...');
        console.log('🔑 API Key configured:', apiKey ? 'Yes' : 'No (using mock)');

        if (!apiKey || apiKey === 'your_openai_api_key_here') {
            // Development fallback - return mock transcription
            console.warn('⚠️ OpenAI API key not configured. Using mock transcription.');
            await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API delay
            const mockText = '송미령님 침 치료 끝났습니다.';
            console.log('✅ Mock transcription:', mockText);
            return mockText;
        }

        try {
            const formData = new FormData();

            // Convert blob to file with proper extension
            const audioFile = new File([audioBlob], 'audio.webm', {
                type: audioBlob.type
            });

            console.log('📤 Sending to Whisper API...');
            console.log('📁 File size:', audioFile.size, 'bytes');
            console.log('💬 Medical hints:', this.medicalHints.substring(0, 50) + '...');

            formData.append('file', audioFile);
            formData.append('model', 'whisper-1');
            formData.append('language', 'ko'); // Korean
            formData.append('prompt', this.medicalHints); // Medical terminology hints

            const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`
                },
                body: formData
            });

            if (!response.ok) {
                const error = await response.json();
                console.error('❌ Whisper API error:', error);
                throw new Error(error.error?.message || 'Whisper API 오류');
            }

            const data = await response.json();
            console.log('✅ Whisper transcription:', data.text);
            return data.text;
        } catch (error) {
            console.error('❌ Whisper transcription error:', error);
            throw new Error('음성 인식에 실패했습니다: ' + error.message);
        }
    }

    cancelRecording() {
        if (this.mediaRecorder && this.isRecording) {
            this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
            this.isRecording = false;
            this.audioChunks = [];
            console.log('🚫 Recording cancelled');
        }
    }
}

export const whisperService = new WhisperService();
