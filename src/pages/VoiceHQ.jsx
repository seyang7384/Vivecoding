import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Settings, LogOut, Monitor, Bell, Activity, Stethoscope, Syringe, UserCog, FlaskConical, Laptop, ArrowDown } from 'lucide-react';
import pythonVoiceService from '../services/pythonVoiceService';
import { geminiService } from '../services/geminiService';
import { voiceLogService } from '../services/voiceLogService';
import { getStationConfig, setStationId, STATION_CONFIG } from '../config/stationConfig';

// Independent Log Column Component
const LogColumn = React.memo(({ roleId, title, icon: Icon, colorClass, bgClass, logs, isRecording, station, vadStatus }) => {
    const [isAutoScroll, setIsAutoScroll] = useState(true);
    const [showScrollBtn, setShowScrollBtn] = useState(false);
    const containerRef = useRef(null);
    const lastLogIdRef = useRef(null);

    // Filter logs for this column
    const columnLogs = logs.filter(l => l.roleId === roleId);
    const lastLog = columnLogs[columnLogs.length - 1];

    // Auto-scroll effect
    useEffect(() => {
        if (isAutoScroll && lastLog && lastLog.id !== lastLogIdRef.current) {
            lastLogIdRef.current = lastLog.id;
            scrollToBottom();
        }
    }, [lastLog, isAutoScroll]);

    const handleScroll = (e) => {
        const { scrollTop, scrollHeight, clientHeight } = e.target;
        // Check if user is near bottom (within 20px)
        const isBottom = Math.abs(scrollHeight - clientHeight - scrollTop) < 20;

        if (isBottom) {
            setIsAutoScroll(true);
            setShowScrollBtn(false);
        } else {
            setIsAutoScroll(false);
            setShowScrollBtn(true);
        }
    };

    const scrollToBottom = () => {
        if (containerRef.current) {
            containerRef.current.scrollTop = containerRef.current.scrollHeight;
            setIsAutoScroll(true);
            setShowScrollBtn(false);
        }
    };

    return (
        <div className={`flex-1 flex flex-col border-r border-gray-700 ${bgClass} relative`}>
            <div className={`p-3 border-b border-gray-700 flex items-center justify-between ${colorClass} bg-opacity-20`}>
                <h2 className="font-bold flex items-center text-sm">
                    <Icon className="w-4 h-4 mr-2" />
                    {title}
                </h2>
                {isRecording && station.roles.left.id === roleId && (
                    <div className={`w-2 h-2 rounded-full ${vadStatus === 'speech_start' ? 'bg-green-500 animate-ping' : 'bg-red-500 animate-pulse'}`} />
                )}
                {isRecording && station.roles.right.id === roleId && (
                    <div className={`w-2 h-2 rounded-full ${vadStatus === 'speech_start' ? 'bg-green-500 animate-ping' : 'bg-red-500 animate-pulse'}`} />
                )}
            </div>

            <div
                className="flex-1 p-3 overflow-y-auto space-y-3 scrollbar-hide"
                onScroll={handleScroll}
                ref={containerRef}
            >
                {columnLogs.map(log => (
                    <div key={log.id} className={`p-3 rounded-lg border ${colorClass} border-opacity-30 bg-opacity-10`}>
                        <p className="text-xs text-gray-400 mb-1">
                            {new Date(log.timestamp).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </p>
                        <p className="text-gray-200 text-sm">{log.text}</p>
                    </div>
                ))}
            </div>

            {/* Scroll Button for this column */}
            {showScrollBtn && (
                <button
                    onClick={scrollToBottom}
                    className="absolute bottom-4 right-4 bg-gray-800 text-white p-2 rounded-full shadow-lg border border-gray-600 hover:bg-gray-700 animate-bounce z-10"
                >
                    <ArrowDown className="w-4 h-4" />
                </button>
            )}
        </div>
    );
});

const VoiceHQ = () => {
    const [station, setStation] = useState(getStationConfig());
    const [isRecording, setIsRecording] = useState(false);
    const [isVadMode, setIsVadMode] = useState(false);
    const [vadStatus, setVadStatus] = useState('idle');
    const [audioLevel, setAudioLevel] = useState(0); // Audio Level (0-100)
    const [logs, setLogs] = useState([]);
    const [summary, setSummary] = useState({ treatment: [], reservation: [], etc: [] });
    const [toast, setToast] = useState(null);
    const [showStationSettings, setShowStationSettings] = useState(false);

    // Subscribe to logs
    useEffect(() => {
        const unsubscribe = voiceLogService.subscribeLogs((newLogs) => {
            setLogs(newLogs);
        });
        return () => unsubscribe();
    }, []);

    // Analyze logs
    useEffect(() => {
        const analyze = async () => {
            if (logs.length === 0) return;
            const recentLogs = logs.slice(-20);
            const newSummary = await geminiService.analyzeLogs(recentLogs);
            if (newSummary) {
                setSummary(newSummary);
            }
        };
        const interval = setInterval(analyze, 10000);
        return () => clearInterval(interval);
    }, [logs]);

    // Connect to Python service on mount
    useEffect(() => {
        pythonVoiceService.connect({
            onConnect: () => {
                console.log('Connected to Python Voice Bridge');
            },
            onTranscript: (msg) => {
                // msg = {type: 'transcript', speaker: 'Doctor'/'Nurse', text: '...'}
                const roleConfig = msg.speaker === 'Doctor' ? station.roles.left : station.roles.right;
                handleTranscript(roleConfig, msg.text);
            },
            onAudioLevel: (level) => {
                // level is 0-1, convert to 0-100
                setAudioLevel(Math.min(100, level * 100));
            },
            onVadStatus: (status) => {
                setVadStatus(status);
            },
            onError: (error) => {
                console.error('Python Service Error:', error);
                showToast('오류 발생: ' + error.message);
                setIsRecording(false);
            },
            onDisconnect: () => {
                console.log('Disconnected from Python Voice Bridge');
                setIsRecording(false);
            }
        });

        return () => {
            pythonVoiceService.disconnect();
        };
    }, [station]);

    const toggleRecording = () => {
        if (isRecording) {
            pythonVoiceService.stop();
            setIsRecording(false);
            setVadStatus('idle');
            setAudioLevel(0);
            showToast('녹음이 종료되었습니다.');
        } else {
            pythonVoiceService.start();
            setIsRecording(true);
            showToast(`🎙️ ${station.name} 녹음 시작`);
        }
    };

    const handleTranscript = (roleConfig, text) => {
        if (!text || text.trim() === '') return;
        debouncedSaveLog(roleConfig, text);
    };

    const saveLogRef = useRef({});
    const debouncedSaveLog = (roleConfig, text) => {
        if (saveLogRef.current[roleConfig.id]) clearTimeout(saveLogRef.current[roleConfig.id]);

        saveLogRef.current[roleConfig.id] = setTimeout(() => {
            voiceLogService.addLog({
                roleId: roleConfig.id,
                roleName: roleConfig.name,
                text: text,
                stationId: station.id
            });
        }, 1000);
    };

    const showToast = (message) => {
        setToast(message);
        setTimeout(() => setToast(null), 3000);
    };

    return (
        <div className="h-screen bg-gray-900 text-white flex flex-col overflow-hidden relative">
            {toast && (
                <div className="absolute top-20 left-1/2 transform -translate-x-1/2 bg-blue-600 text-white px-6 py-3 rounded-full shadow-lg z-50 flex items-center animate-bounce-in">
                    <Bell className="w-5 h-5 mr-2" />
                    {toast}
                </div>
            )}

            {/* Header */}
            <header className="h-14 bg-gray-800 border-b border-gray-700 flex items-center justify-between px-4">
                <div className="flex items-center space-x-4">
                    <h1 className="text-lg font-bold flex items-center">
                        <Activity className="w-5 h-5 mr-2 text-blue-400" />
                        Smart Medical Voice HQ
                    </h1>
                    <button
                        onClick={() => setShowStationSettings(true)}
                        className="px-3 py-1 rounded-full text-xs font-medium bg-gray-700 text-gray-300 border border-gray-600 hover:bg-gray-600 flex items-center"
                    >
                        <Laptop className="w-3 h-3 mr-1" />
                        {station.name}
                    </button>
                </div>
                <div className="flex items-center space-x-4">
                    {/* Audio Level Meter */}
                    <div className={`flex items-center space-x-2 px-3 py-1 rounded-full border transition-all ${isRecording ? 'bg-gray-800 border-gray-700' : 'bg-gray-800/50 border-gray-800 opacity-50'}`}>
                        <div className="text-xs text-gray-400">MIC</div>
                        <div className="w-24 h-2 bg-gray-700 rounded-full overflow-hidden">
                            <div
                                className={`h-full transition-all duration-100 ${audioLevel > 40 ? 'bg-red-500' : 'bg-green-500'}`}
                                style={{ width: `${audioLevel}%` }}
                            />
                        </div>
                    </div>

                    {/* VAD Toggle */}
                    <div className="flex items-center bg-gray-700 rounded-full p-1">
                        <button
                            onClick={() => !isRecording && setIsVadMode(false)}
                            className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${!isVadMode ? 'bg-blue-600 text-white' : 'text-gray-400'}`}
                            disabled={isRecording}
                        >
                            수동
                        </button>
                        <button
                            onClick={() => !isRecording && setIsVadMode(true)}
                            className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${isVadMode ? 'bg-green-600 text-white' : 'text-gray-400'}`}
                            disabled={isRecording}
                        >
                            자동(VAD)
                        </button>
                    </div>

                    <button
                        onClick={() => window.location.reload()}
                        className="p-2 hover:bg-gray-700 rounded-full text-gray-400"
                    >
                        <LogOut className="w-4 h-4" />
                    </button>
                </div>
            </header>

            {/* Main Content */}
            <div className="flex-1 flex overflow-hidden">

                {/* 4-Split View */}
                <div className="flex-1 flex flex-col">
                    <div className="flex-1 flex border-b border-gray-700 overflow-hidden">
                        <LogColumn
                            roleId="Doctor"
                            title="원장님 (PC A-L)"
                            icon={Stethoscope}
                            colorClass="text-blue-400 border-blue-500 bg-blue-900"
                            bgClass="bg-gray-900/50"
                            logs={logs}
                            isRecording={isRecording}
                            station={station}
                            vadStatus={vadStatus}
                        />
                        <LogColumn
                            roleId="Nurse"
                            title="치료실 (PC A-R)"
                            icon={Syringe}
                            colorClass="text-green-400 border-green-500 bg-green-900"
                            bgClass="bg-gray-900/30"
                            logs={logs}
                            isRecording={isRecording}
                            station={station}
                            vadStatus={vadStatus}
                        />
                    </div>
                    <div className="flex-1 flex overflow-hidden">
                        <LogColumn
                            roleId="Manager"
                            title="실장님 (PC B-L)"
                            icon={UserCog}
                            colorClass="text-purple-400 border-purple-500 bg-purple-900"
                            bgClass="bg-gray-900/30"
                            logs={logs}
                            isRecording={isRecording}
                            station={station}
                            vadStatus={vadStatus}
                        />
                        <LogColumn
                            roleId="Pharmacy"
                            title="탕전실 (PC B-R)"
                            icon={FlaskConical}
                            colorClass="text-orange-400 border-orange-500 bg-orange-900"
                            bgClass="bg-gray-900/50"
                            logs={logs}
                            isRecording={isRecording}
                            station={station}
                            vadStatus={vadStatus}
                        />
                    </div>
                </div>

                {/* Summary Panel */}
                <div className="w-72 bg-gray-800 flex flex-col border-l border-gray-700">
                    <div className="p-3 border-b border-gray-700">
                        <h2 className="font-bold text-sm flex items-center">
                            <Monitor className="w-4 h-4 mr-2 text-purple-400" />
                            실시간 분석
                        </h2>
                    </div>
                    <div className="flex-1 p-3 space-y-4 overflow-y-auto">
                        <div className="bg-gray-900 rounded-lg p-3 border border-gray-700">
                            <h3 className="text-blue-400 font-bold mb-2 text-xs uppercase">치료 흐름</h3>
                            <ul className="space-y-1 text-xs">
                                {summary.treatment.map((item, i) => (
                                    <li key={i} className="flex items-start text-gray-300">
                                        <span className="w-1 h-1 bg-blue-500 rounded-full mr-2 mt-1.5"></span>
                                        {item.text}
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <div className="bg-gray-900 rounded-lg p-3 border border-gray-700">
                            <h3 className="text-green-400 font-bold mb-2 text-xs uppercase">오더 / 처방</h3>
                            <ul className="space-y-1 text-xs">
                                {summary.etc.map((item, i) => (
                                    <li key={i} className="flex items-start text-gray-300">
                                        <span className="w-1 h-1 bg-green-500 rounded-full mr-2 mt-1.5"></span>
                                        {item.text}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>

                    {/* Control Bar */}
                    <div className="p-4 border-t border-gray-700 bg-gray-800">
                        <button
                            onClick={toggleRecording}
                            className={`w-full py-3 rounded-lg font-bold text-sm flex items-center justify-center transition-all ${isRecording
                                ? (isVadMode ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700')
                                : 'bg-blue-600 hover:bg-blue-700'
                                } text-white shadow-lg`}
                        >
                            {isRecording ? (
                                <>
                                    {isVadMode ? <Activity className="w-4 h-4 mr-2 animate-pulse" /> : <MicOff className="w-4 h-4 mr-2" />}
                                    {isVadMode ? (vadStatus === 'speech_start' ? '음성 감지됨 (녹음 중)' : '음성 대기 중...') : '녹음 종료'}
                                </>
                            ) : (
                                <>
                                    <Mic className="w-4 h-4 mr-2" />
                                    {station.name} 녹음 시작
                                </>
                            )}
                        </button>
                        <p className="text-[10px] text-gray-500 text-center mt-2">
                            {isVadMode ? '* 자동 모드: 소리가 들릴 때만 녹음합니다.' : '* 수동 모드: 버튼을 눌러 녹음을 제어합니다.'}
                        </p>
                    </div>
                </div>
            </div>

            {/* Station Settings Modal */}
            {showStationSettings && (
                <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
                    <div className="bg-gray-800 rounded-xl p-6 w-96 border border-gray-700 shadow-2xl">
                        <h2 className="text-lg font-bold mb-4 flex items-center">
                            <Laptop className="w-5 h-5 mr-2 text-blue-400" />
                            PC 역할 설정
                        </h2>
                        <p className="text-sm text-gray-400 mb-6">
                            현재 PC가 담당할 역할을 선택해주세요.<br />
                            선택된 역할에 따라 마이크 입력이 태깅됩니다.
                        </p>

                        <div className="space-y-3">
                            {Object.values(STATION_CONFIG).map((config) => (
                                <button
                                    key={config.id}
                                    onClick={() => setStationId(config.id)}
                                    className={`w-full p-4 rounded-lg border flex items-center justify-between transition-all ${station.id === config.id
                                        ? 'bg-blue-600 border-blue-500 text-white'
                                        : 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600'
                                        }`}
                                >
                                    <div className="text-left">
                                        <div className="font-bold">{config.name}</div>
                                        <div className="text-xs opacity-80 mt-1">
                                            L: {config.roles.left.name} / R: {config.roles.right.name}
                                        </div>
                                    </div>
                                    {station.id === config.id && <div className="w-3 h-3 bg-white rounded-full" />}
                                </button>
                            ))}
                        </div>

                        <button
                            onClick={() => setShowStationSettings(false)}
                            className="w-full mt-6 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm"
                        >
                            닫기
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default VoiceHQ;
