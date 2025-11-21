import React, { useState, useEffect, useRef } from 'react';
import RoleSelector from '../components/voice/RoleSelector';
import { Mic, MicOff, Settings, LogOut, Monitor, Bell, Loader, Activity } from 'lucide-react';
import { whisperService } from '../services/whisperService';
import { geminiService } from '../services/geminiService';
import { vadService } from '../services/vadService';

const VoiceHQ = () => {
    const [selectedRole, setSelectedRole] = useState(null);
    const [isRecording, setIsRecording] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [processingStage, setProcessingStage] = useState('');
    const [logs, setLogs] = useState([]);
    const [processingText, setProcessingText] = useState('');
    const [summary, setSummary] = useState({ treatment: [], reservation: [], etc: [] });
    const [toast, setToast] = useState(null);
    const logsEndRef = useRef(null);

    // Always-on VAD states
    const [isListening, setIsListening] = useState(false);
    const [currentVolume, setCurrentVolume] = useState(-100);
    const [vadEnabled, setVadEnabled] = useState(true);
    const [showSettings, setShowSettings] = useState(false);
    const [volumeThreshold, setVolumeThreshold] = useState(-20);
    const [silenceDuration, setSilenceDuration] = useState(2000);

    // Refs to avoid closure issues in VAD callbacks
    const isRecordingRef = useRef(false);
    const isProcessingRef = useRef(false);

    // Load logs and poll for updates
    useEffect(() => {
        const loadLogs = () => {
            const storedLogs = JSON.parse(localStorage.getItem('voice_logs') || '[]');
            setLogs(storedLogs);
        };

        loadLogs();
        const interval = setInterval(loadLogs, 1000);
        return () => clearInterval(interval);
    }, []);

    // Analyze logs
    useEffect(() => {
        const analyze = async () => {
            if (logs.length === 0) return;

            const newSummary = await geminiService.analyzeLogs(logs);
            if (newSummary) {
                const prevTotal = summary.treatment.length + summary.reservation.length + summary.etc.length;
                const newTotal = newSummary.treatment.length + newSummary.reservation.length + newSummary.etc.length;

                if (newTotal !== prevTotal) {
                    setSummary(newSummary);
                    showToast('상황판이 업데이트되었습니다.');
                } else {
                    setSummary(newSummary);
                }
            }
        };

        const interval = setInterval(analyze, 5000);
        return () => clearInterval(interval);
    }, [logs]);

    // Auto-scroll to bottom
    useEffect(() => {
        logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [logs, processingText]);

    // Initialize always-on VAD when role is selected
    useEffect(() => {
        if (!selectedRole || !vadEnabled) return;

        const initializeVAD = async () => {
            try {
                console.log('🎙️ Initializing always-on voice detection...');

                const stream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        echoCancellation: true,
                        noiseSuppression: true,
                        sampleRate: 44100
                    }
                });

                await vadService.startMonitoring(stream);

                // Apply user settings
                vadService.setVolumeThreshold(volumeThreshold);
                vadService.setSilenceThreshold(silenceDuration);

                setIsListening(true);

                vadService.setCallbacks({
                    onVoiceStart: () => handleVoiceStart(),
                    onVoiceEnd: () => handleVoiceEnd(),
                    onVolumeChange: (volume) => setCurrentVolume(volume)
                });

                showToast('🎙️ 음성 감지 활성화 - 말씀하시면 자동 녹음됩니다');

            } catch (error) {
                console.error('❌ Failed to initialize VAD:', error);
                showToast('마이크 권한이 필요합니다');
            }
        };

        initializeVAD();

        return () => {
            vadService.stopMonitoring();
            setIsListening(false);
        };
    }, [selectedRole, vadEnabled]);

    const handleVoiceStart = async () => {
        if (isRecordingRef.current || isProcessingRef.current) {
            console.log('⚠️ Already recording or processing, ignoring voice start');
            return;
        }

        console.log('🎤 Voice started - beginning recording...');
        try {
            await whisperService.startRecording();
            setIsRecording(true);
            isRecordingRef.current = true;
        } catch (error) {
            console.error('Failed to start recording:', error);
        }
    };

    const handleVoiceEnd = async () => {
        console.log('🔔 handleVoiceEnd called. isRecording:', isRecordingRef.current);
        if (!isRecordingRef.current) {
            console.log('⚠️ Not recording, ignoring voice end');
            return;
        }

        console.log('⏹️ Voice ended - processing recording...');
        await processRecording();
    };

    const processRecording = async () => {
        try {
            setIsRecording(false);
            isRecordingRef.current = false;
            setIsProcessing(true);
            isProcessingRef.current = true;
            setProcessingStage('whisper');
            setProcessingText('');

            const audioBlob = await whisperService.stopRecording();
            const rawText = await whisperService.transcribe(audioBlob);

            if (!rawText || rawText.trim() === '') {
                throw new Error('음성이 인식되지 않았습니다.');
            }

            setProcessingText(rawText);
            setProcessingStage('gemini');

            let finalText = rawText;
            try {
                const correctedText = await geminiService.correctText(rawText);
                if (correctedText && correctedText.trim()) {
                    finalText = correctedText;
                }
            } catch (error) {
                console.warn('⚠️ GPT-4 correction failed:', error.message);
            }

            addLog(finalText);

            setProcessingStage('complete');
            setProcessingText('');

        } catch (error) {
            console.error('Recording/Processing error:', error);
            showToast('오류: ' + error.message);
            whisperService.cancelRecording();
        } finally {
            setIsProcessing(false);
            isProcessingRef.current = false;
            setProcessingStage('');
        }
    };

    const showToast = (message) => {
        setToast(message);
        setTimeout(() => setToast(null), 3000);
    };

    const addLog = (text) => {
        const newLog = {
            id: Date.now(),
            roleId: selectedRole.id,
            roleName: selectedRole.name,
            text: text,
            timestamp: Date.now()
        };

        const existingLogs = JSON.parse(localStorage.getItem('voice_logs') || '[]');
        const updatedLogs = [...existingLogs, newLog];
        if (updatedLogs.length > 50) updatedLogs.shift();

        localStorage.setItem('voice_logs', JSON.stringify(updatedLogs));
        setLogs(updatedLogs);
    };

    const handleRoleSelect = (role) => {
        setSelectedRole(role);
    };

    const handleLogout = () => {
        vadService.stopMonitoring();
        if (isRecording) {
            whisperService.cancelRecording();
        }
        setSelectedRole(null);
        setIsRecording(false);
        setIsListening(false);
    };

    const formatTime = (timestamp) => {
        return new Date(timestamp).toLocaleTimeString('ko-KR', {
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const renderBoldText = (text) => {
        const parts = text.split(/(\*\*[^*]+\*\*)/g);
        return parts.map((part, index) => {
            if (part.startsWith('**') && part.endsWith('**')) {
                return <strong key={index}>{part.slice(2, -2)}</strong>;
            }
            return <span key={index}>{part}</span>;
        });
    };

    if (!selectedRole) {
        return <RoleSelector onSelectRole={handleRoleSelect} />;
    }

    return (
        <div className="h-screen bg-gray-900 text-white flex flex-col overflow-hidden relative">
            {toast && (
                <div className="absolute top-20 left-1/2 transform -translate-x-1/2 bg-blue-600 text-white px-6 py-3 rounded-full shadow-lg z-50 flex items-center animate-bounce-in transition-all duration-300">
                    <Bell className="w-5 h-5 mr-2" />
                    {toast}
                </div>
            )}

            <header className="h-16 bg-gray-800 border-b border-gray-700 flex items-center justify-between px-6">
                <div className="flex items-center space-x-4">
                    <h1 className="text-xl font-bold">Smart Medical Voice HQ</h1>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${selectedRole.id === 'D' ? 'bg-orange-900 text-orange-100' : 'bg-blue-900 text-blue-100'
                        }`}>
                        {selectedRole.name}
                    </span>
                </div>
                <div className="flex items-center space-x-4">
                    <button onClick={handleLogout} className="p-2 hover:bg-gray-700 rounded-full text-gray-400 hover:text-white">
                        <LogOut className="w-5 h-5" />
                    </button>
                </div>
            </header>

            <div className="flex-1 flex overflow-hidden">
                <div className="flex-1 flex flex-col border-r border-gray-700">
                    <div className="flex-1 p-6 overflow-y-auto space-y-4">
                        {logs.length === 0 && !processingText && (
                            <div className="text-center text-gray-500 mt-20">
                                <p>대화 내용이 없습니다.</p>
                                <p className="text-sm">말씀하시면 자동으로 녹음됩니다.</p>
                            </div>
                        )}

                        {logs.map((log) => (
                            <div key={log.id} className="flex items-start space-x-3 animate-fade-in">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${log.roleId === 'A' ? 'bg-blue-600' :
                                    log.roleId === 'B' ? 'bg-green-600' :
                                        log.roleId === 'C' ? 'bg-purple-600' : 'bg-orange-600'
                                    }`}>
                                    {log.roleId}
                                </div>
                                <div>
                                    <p className="text-sm text-gray-400 mb-1">{log.roleName} ({formatTime(log.timestamp)})</p>
                                    <p className="bg-gray-800 p-3 rounded-lg rounded-tl-none text-lg leading-relaxed">
                                        {renderBoldText(log.text)}
                                    </p>
                                </div>
                            </div>
                        ))}

                        {isProcessing && (
                            <div className="flex items-start space-x-3">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${selectedRole.id === 'A' ? 'bg-blue-600' :
                                    selectedRole.id === 'B' ? 'bg-green-600' :
                                        selectedRole.id === 'C' ? 'bg-purple-600' : 'bg-orange-600'
                                    }`}>
                                    {selectedRole.id}
                                </div>
                                <div>
                                    <p className="text-sm text-gray-400 mb-1 flex items-center">
                                        <Loader className="w-4 h-4 mr-1 animate-spin" />
                                        {processingStage === 'whisper' && 'AI가 음성을 인식하는 중'}
                                        {processingStage === 'gemini' && 'AI가 기록을 정리하는 중'}
                                        <span className="animate-pulse">...</span>
                                    </p>
                                    {processingText && (
                                        <p className="bg-gray-800 p-3 rounded-lg rounded-tl-none text-lg text-gray-400 italic border border-dashed border-gray-600">
                                            {processingText}
                                        </p>
                                    )}
                                </div>
                            </div>
                        )}
                        <div ref={logsEndRef} />
                    </div>

                    <div className="h-24 bg-gray-800 border-t border-gray-700 flex items-center justify-center p-4">
                        <div className="flex items-center space-x-6 w-full max-w-2xl">
                            <div className={`flex items-center space-x-3 flex-1 ${isRecording ? 'text-red-400' :
                                isProcessing ? 'text-yellow-400' :
                                    isListening ? 'text-green-400' : 'text-gray-500'
                                }`}>
                                <div className="relative">
                                    {isRecording ? (
                                        <Mic className="w-8 h-8 animate-pulse" />
                                    ) : isProcessing ? (
                                        <Loader className="w-8 h-8 animate-spin" />
                                    ) : isListening ? (
                                        <Activity className="w-8 h-8" />
                                    ) : (
                                        <MicOff className="w-8 h-8" />
                                    )}
                                </div>

                                <div className="flex-1">
                                    <p className="text-sm font-medium">
                                        {isRecording ? '🎙️ 녹음 중...' :
                                            isProcessing ? '⚡ AI 처리 중...' :
                                                isListening ? '👂 음성 감지 대기 중' :
                                                    '❌ 비활성화'}
                                    </p>
                                    <p className="text-xs text-gray-400">
                                        {isListening && !isRecording && !isProcessing &&
                                            '말씀하시면 자동으로 녹음이 시작됩니다'}
                                    </p>
                                </div>
                            </div>

                            {isListening && (
                                <div className="flex items-center space-x-2">
                                    <span className="text-xs text-gray-400">음량:</span>
                                    <div className="w-32 h-2 bg-gray-700 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full transition-all duration-100 ${currentVolume > -40 ? 'bg-green-500' :
                                                currentVolume > -60 ? 'bg-yellow-500' :
                                                    'bg-gray-600'
                                                }`}
                                            style={{
                                                width: `${Math.max(0, Math.min(100, ((currentVolume + 100) / 100) * 100))}%`
                                            }}
                                        />
                                    </div>
                                    <span className="text-xs text-gray-400 w-12">
                                        {currentVolume.toFixed(0)}dB
                                    </span>
                                </div>
                            )}

                            <button
                                onClick={() => setShowSettings(true)}
                                className="p-2 hover:bg-gray-700 rounded-full text-gray-400 hover:text-white"
                                title="VAD 설정"
                            >
                                <Settings className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                </div>

                <div className="w-96 bg-gray-800 flex flex-col border-l border-gray-700">
                    <div className="p-4 border-b border-gray-700">
                        <h2 className="font-bold text-lg flex items-center">
                            <Monitor className="w-5 h-5 mr-2 text-blue-400" />
                            현재 상황 요약판
                        </h2>
                    </div>
                    <div className="flex-1 p-4 space-y-6 overflow-y-auto">
                        <div className="bg-gray-900 rounded-xl p-4 border border-gray-700">
                            <h3 className="text-blue-400 font-bold mb-3 text-sm uppercase tracking-wider">치료 흐름</h3>
                            <ul className="space-y-2">
                                {summary.treatment.length === 0 ? (
                                    <li className="text-gray-500 text-sm">데이터 없음</li>
                                ) : (
                                    summary.treatment.map(item => (
                                        <li key={item.id} className="flex items-center text-gray-300 animate-fade-in">
                                            <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                                            {item.text}
                                        </li>
                                    ))
                                )}
                            </ul>
                        </div>

                        <div className="bg-gray-900 rounded-xl p-4 border border-gray-700">
                            <h3 className="text-green-400 font-bold mb-3 text-sm uppercase tracking-wider">예약 / 수납</h3>
                            <ul className="space-y-2">
                                {summary.reservation.length === 0 ? (
                                    <li className="text-gray-500 text-sm">데이터 없음</li>
                                ) : (
                                    summary.reservation.map(item => (
                                        <li key={item.id} className="flex items-center text-gray-300 animate-fade-in">
                                            <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
                                            {item.text}
                                        </li>
                                    ))
                                )}
                            </ul>
                        </div>

                        <div className="bg-gray-900 rounded-xl p-4 border border-gray-700">
                            <h3 className="text-purple-400 font-bold mb-3 text-sm uppercase tracking-wider">기타 / 오더</h3>
                            <ul className="space-y-2">
                                {summary.etc.length === 0 ? (
                                    <li className="text-gray-500 text-sm">데이터 없음</li>
                                ) : (
                                    summary.etc.map(item => (
                                        <li key={item.id} className="flex items-center text-gray-300 animate-fade-in">
                                            <span className="w-2 h-2 bg-orange-500 rounded-full mr-2"></span>
                                            {item.text}
                                        </li>
                                    ))
                                )}
                            </ul>
                        </div>
                    </div>
                </div>
            </div>

            {/* Settings Modal */}
            {showSettings && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-gray-800 rounded-xl p-6 w-96 border border-gray-700">
                        <h2 className="text-xl font-bold mb-6">VAD 설정</h2>

                        <div className="space-y-6">
                            <div>
                                <label className="block text-sm font-medium mb-2">
                                    음성 감지 임계값: {volumeThreshold}dB
                                </label>
                                <input
                                    type="range"
                                    min="-60"
                                    max="-10"
                                    value={volumeThreshold}
                                    onChange={(e) => setVolumeThreshold(Number(e.target.value))}
                                    className="w-full"
                                />
                                <p className="text-xs text-gray-400 mt-1">
                                    현재 음량: {currentVolume.toFixed(0)}dB
                                    {currentVolume > volumeThreshold ? ' (감지됨 🔴)' : ' (미감지 ⚪)'}
                                </p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-2">
                                    침묵 대기 시간: {(silenceDuration / 1000).toFixed(1)}초
                                </label>
                                <input
                                    type="range"
                                    min="1000"
                                    max="5000"
                                    step="500"
                                    value={silenceDuration}
                                    onChange={(e) => setSilenceDuration(Number(e.target.value))}
                                    className="w-full"
                                />
                                <p className="text-xs text-gray-400 mt-1">
                                    말을 멈춘 후 녹음 종료까지 대기 시간
                                </p>
                            </div>
                        </div>

                        <div className="flex space-x-3 mt-6">
                            <button
                                onClick={() => {
                                    vadService.setVolumeThreshold(volumeThreshold);
                                    vadService.setSilenceThreshold(silenceDuration);
                                    setShowSettings(false);
                                    showToast(`설정 적용: ${volumeThreshold}dB, ${silenceDuration / 1000}초`);
                                }}
                                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-medium"
                            >
                                적용
                            </button>
                            <button
                                onClick={() => setShowSettings(false)}
                                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 rounded-lg font-medium"
                            >
                                취소
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default VoiceHQ;
