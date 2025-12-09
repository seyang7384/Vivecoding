import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Settings, LogOut, Monitor, Bell, Activity, Stethoscope, Laptop, ArrowDown, X, Plus, Trash2 } from 'lucide-react';
import pythonVoiceService from '../services/pythonVoiceService';
import { geminiService } from '../services/geminiService';
import { voiceLogService } from '../services/voiceLogService';

const VoiceHQ = () => {
    const [isRecording, setIsRecording] = useState(false);
    const [audioLevel, setAudioLevel] = useState(0);
    const [logs, setLogs] = useState([]);
    const [summary, setSummary] = useState({ treatment: [], reservation: [], etc: [] });
    const [toast, setToast] = useState(null);
    const [isAutoScroll, setIsAutoScroll] = useState(true);
    const [showScrollBtn, setShowScrollBtn] = useState(false);

    // Correction Settings State
    const [showSettings, setShowSettings] = useState(false);
    const [corrections, setCorrections] = useState({});
    const [newWrong, setNewWrong] = useState('');
    const [newCorrect, setNewCorrect] = useState('');

    const containerRef = useRef(null);
    const lastLogIdRef = useRef(null);

    // Subscribe to logs
    useEffect(() => {
        const unsubscribe = voiceLogService.subscribeLogs((newLogs) => {
            setLogs(newLogs);
        });
        return () => unsubscribe();
    }, []);

    // Auto-scroll effect
    useEffect(() => {
        const lastLog = logs[logs.length - 1];
        if (isAutoScroll && lastLog && lastLog.id !== lastLogIdRef.current) {
            lastLogIdRef.current = lastLog.id;
            scrollToBottom();
        }
    }, [logs, isAutoScroll]);

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
                pythonVoiceService.getCorrections(); // Fetch initial corrections
            },
            onTranscript: (msg) => {
                // msg = {type: 'transcript', speaker: 'Director', text: '...'}
                handleTranscript(msg.text);
            },
            onCorrections: (data) => {
                setCorrections(data);
            },
            onAudioLevel: (level) => {
                setAudioLevel(Math.min(100, level * 100));
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
    }, []);

    const handleAddCorrection = () => {
        if (!newWrong.trim() || !newCorrect.trim()) return;
        const updated = { ...corrections, [newWrong.trim()]: newCorrect.trim() };
        pythonVoiceService.saveCorrections(updated);
        setNewWrong('');
        setNewCorrect('');
        showToast('교정 단어가 추가되었습니다.');
    };

    const handleDeleteCorrection = (key) => {
        const updated = { ...corrections };
        delete updated[key];
        pythonVoiceService.saveCorrections(updated);
        showToast('교정 단어가 삭제되었습니다.');
    };

    const toggleRecording = () => {
        if (isRecording) {
            pythonVoiceService.stop();
            setIsRecording(false);
            setAudioLevel(0);
            showToast('녹음이 종료되었습니다.');
        } else {
            pythonVoiceService.start();
            setIsRecording(true);
            showToast(`🎙️ 녹음 시작`);
        }
    };

    const handleTranscript = (text) => {
        if (!text || text.trim() === '') return;

        voiceLogService.addLog({
            roleId: 'Director',
            roleName: '원장님',
            text: text,
            stationId: 'main'
        });
    };

    const showToast = (message) => {
        setToast(message);
        setTimeout(() => setToast(null), 3000);
    };

    const handleScroll = (e) => {
        const { scrollTop, scrollHeight, clientHeight } = e.target;
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
                        Smart Medical Voice HQ (Mono)
                    </h1>
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

                    <button
                        onClick={() => setShowSettings(true)}
                        className="p-2 hover:bg-gray-700 rounded-full text-gray-400 transition-colors"
                        title="교정 사전 설정"
                    >
                        <Settings className="w-5 h-5" />
                    </button>

                    <button
                        onClick={() => window.location.reload()}
                        className="p-2 hover:bg-gray-700 rounded-full text-gray-400"
                    >
                        <LogOut className="w-4 h-4" />
                    </button>
                </div>
            </header>

            {/* Settings Modal */}
            {showSettings && (
                <div className="absolute inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg border border-gray-700 flex flex-col max-h-[80vh]">
                        <div className="p-6 border-b border-gray-700 flex justify-between items-center">
                            <h2 className="text-xl font-bold text-white flex items-center">
                                <Settings className="w-6 h-6 mr-2 text-blue-400" />
                                교정 사전 설정
                            </h2>
                            <button onClick={() => setShowSettings(false)} className="text-gray-400 hover:text-white">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="p-6 flex-1 overflow-y-auto">
                            <div className="mb-6 bg-gray-900/50 p-4 rounded-xl border border-gray-700">
                                <h3 className="text-sm font-bold text-gray-400 mb-3 uppercase tracking-wider">새 단어 추가</h3>
                                <div className="flex space-x-2">
                                    <input
                                        type="text"
                                        placeholder="잘못된 단어 (예: 준아)"
                                        className="flex-1 bg-gray-800 border border-gray-600 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                                        value={newWrong}
                                        onChange={(e) => setNewWrong(e.target.value)}
                                    />
                                    <ArrowDown className="w-6 h-6 text-gray-500 self-center transform -rotate-90" />
                                    <input
                                        type="text"
                                        placeholder="바꿀 단어 (예: 추나)"
                                        className="flex-1 bg-gray-800 border border-gray-600 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-green-500"
                                        value={newCorrect}
                                        onChange={(e) => setNewCorrect(e.target.value)}
                                        onKeyPress={(e) => e.key === 'Enter' && handleAddCorrection()}
                                    />
                                    <button
                                        onClick={handleAddCorrection}
                                        className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-lg transition-colors"
                                    >
                                        <Plus className="w-6 h-6" />
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <h3 className="text-sm font-bold text-gray-400 mb-3 uppercase tracking-wider">등록된 단어 ({Object.keys(corrections).length})</h3>
                                {Object.keys(corrections).length === 0 ? (
                                    <div className="text-center py-8 text-gray-500">
                                        등록된 교정 단어가 없습니다.
                                    </div>
                                ) : (
                                    Object.entries(corrections).map(([wrong, correct]) => (
                                        <div key={wrong} className="flex items-center justify-between bg-gray-700/30 p-3 rounded-lg border border-gray-700 hover:border-gray-600 transition-colors">
                                            <div className="flex items-center space-x-3">
                                                <span className="text-red-400 font-medium">{wrong}</span>
                                                <ArrowDown className="w-4 h-4 text-gray-500 transform -rotate-90" />
                                                <span className="text-green-400 font-bold">{correct}</span>
                                            </div>
                                            <button
                                                onClick={() => handleDeleteCorrection(wrong)}
                                                className="text-gray-500 hover:text-red-400 p-1 rounded transition-colors"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Main Content */}
            <div className="flex-1 flex overflow-hidden">

                {/* Main Log View (Single Column) */}
                <div className="flex-1 flex flex-col bg-gray-900 relative">
                    <div className="p-4 border-b border-gray-700 flex items-center justify-between bg-blue-900/20">
                        <h2 className="font-bold flex items-center text-lg text-blue-400">
                            <Stethoscope className="w-5 h-5 mr-2" />
                            실시간 진료 기록 (원장님)
                        </h2>
                        {isRecording && (
                            <div className="flex items-center text-xs text-green-400 animate-pulse">
                                <div className="w-2 h-2 bg-green-500 rounded-full mr-2" />
                                Recording...
                            </div>
                        )}
                    </div>

                    <div
                        className="flex-1 p-6 overflow-y-auto space-y-4 scrollbar-hide"
                        onScroll={handleScroll}
                        ref={containerRef}
                    >
                        {logs.map(log => (
                            <div key={log.id} className="p-4 rounded-xl border border-blue-500/30 bg-blue-900/10 hover:bg-blue-900/20 transition-colors">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs text-blue-300 font-bold px-2 py-1 rounded bg-blue-900/50">
                                        {log.roleName}
                                    </span>
                                    <span className="text-xs text-gray-500">
                                        {new Date(log.timestamp).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                    </span>
                                </div>
                                <p className="text-gray-100 text-lg leading-relaxed">{log.text}</p>
                            </div>
                        ))}
                    </div>

                    {/* Scroll Button */}
                    {showScrollBtn && (
                        <button
                            onClick={scrollToBottom}
                            className="absolute bottom-6 right-6 bg-blue-600 text-white p-3 rounded-full shadow-lg hover:bg-blue-500 animate-bounce z-10"
                        >
                            <ArrowDown className="w-6 h-6" />
                        </button>
                    )}
                </div>

                {/* Summary Panel */}
                <div className="w-80 bg-gray-800 flex flex-col border-l border-gray-700">
                    <div className="p-4 border-b border-gray-700">
                        <h2 className="font-bold text-sm flex items-center">
                            <Monitor className="w-4 h-4 mr-2 text-purple-400" />
                            실시간 분석
                        </h2>
                    </div>
                    <div className="flex-1 p-4 space-y-6 overflow-y-auto">
                        <div className="bg-gray-900 rounded-xl p-4 border border-gray-700">
                            <h3 className="text-blue-400 font-bold mb-3 text-xs uppercase tracking-wider">치료 흐름</h3>
                            <ul className="space-y-2 text-sm">
                                {summary.treatment.map((item, i) => (
                                    <li key={i} className="flex items-start text-gray-300">
                                        <span className="w-1.5 h-1.5 bg-blue-500 rounded-full mr-2.5 mt-1.5 flex-shrink-0"></span>
                                        {item.text}
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <div className="bg-gray-900 rounded-xl p-4 border border-gray-700">
                            <h3 className="text-green-400 font-bold mb-3 text-xs uppercase tracking-wider">오더 / 처방</h3>
                            <ul className="space-y-2 text-sm">
                                {summary.etc.map((item, i) => (
                                    <li key={i} className="flex items-start text-gray-300">
                                        <span className="w-1.5 h-1.5 bg-green-500 rounded-full mr-2.5 mt-1.5 flex-shrink-0"></span>
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
                            className={`w-full py-4 rounded-xl font-bold text-base flex items-center justify-center transition-all transform active:scale-95 ${isRecording
                                ? 'bg-red-600 hover:bg-red-700 shadow-red-900/50'
                                : 'bg-blue-600 hover:bg-blue-700 shadow-blue-900/50'
                                } text-white shadow-lg`}
                        >
                            {isRecording ? (
                                <>
                                    <MicOff className="w-5 h-5 mr-2 animate-pulse" />
                                    녹음 종료
                                </>
                            ) : (
                                <>
                                    <Mic className="w-5 h-5 mr-2" />
                                    녹음 시작
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default VoiceHQ;
