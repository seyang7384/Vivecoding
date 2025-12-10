import React, { useState, useEffect } from 'react';
import { Phone, MessageSquare, RefreshCw, Sparkles } from 'lucide-react';
import { defenseService } from '../services/defenseService';
import { geminiService } from '../services/geminiService';

const RecallManager = () => {
    const [recallList, setRecallList] = useState([]);
    const [loading, setLoading] = useState(false);
    const [generatingId, setGeneratingId] = useState(null);

    useEffect(() => {
        loadRecallList();
    }, []);

    const loadRecallList = async () => {
        setLoading(true);
        try {
            // Fetch D+3 patients
            // const list = await defenseService.getRecallQueue(new Date().toISOString().split('T')[0]);

            // Mock Data
            const mockList = [
                {
                    id: 'r1',
                    patientName: '박지민',
                    patientId: 'p1',
                    reason: 'Defense 3 Fail',
                    targetDate: new Date().toISOString().split('T')[0],
                    status: 'PENDING'
                }
            ];
            setRecallList(mockList);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleCall = (id) => {
        alert("안부 전화 기록이 저장되었습니다. (예약 권유 X, 상태 체크 O)");
        // Update status
    };

    const handleGenerateAiMessage = async (item) => {
        setGeneratingId(item.id);
        try {
            // Mock transcript
            const mockTranscript = "원장님: 박지민님 지난번에 발목 삐끗하신 건 좀 어때요? 환자: 아직 걸을 때 시큰거려요.";
            const msg = await geminiService.generatePersonalizedMessage(mockTranscript, item.patientName, 'RECALL');

            // Update item with generated message
            setRecallList(prev => prev.map(i => i.id === item.id ? { ...i, generatedMessage: msg } : i));
        } catch (e) {
            console.error(e);
            alert("메시지 생성 실패");
        } finally {
            setGeneratingId(null);
        }
    };

    const handleSendMessage = (id, message) => {
        alert(`[문자 발송] ${message}`);
        setRecallList(prev => prev.filter(i => i.id !== id));
    };

    return (
        <div className="bg-white rounded-lg shadow p-6 mt-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
                <RefreshCw className="w-6 h-6 mr-2 text-green-600" />
                리콜 관리 (Part 3: D+3일)
            </h2>

            {loading ? (
                <div>Loading...</div>
            ) : (
                <div className="space-y-4">
                    {recallList.length === 0 ? (
                        <div className="text-gray-500 text-center py-8">리콜 대상 환자가 없습니다.</div>
                    ) : (
                        recallList.map(item => (
                            <div key={item.id} className="border border-gray-200 rounded-lg p-4 bg-green-50">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <div className="flex items-center space-x-2">
                                            <span className="font-bold text-lg">{item.patientName}</span>
                                            <span className="text-xs bg-gray-200 px-2 py-0.5 rounded text-gray-600">{item.reason}</span>
                                        </div>
                                        <div className="text-sm text-gray-500 mt-1">
                                            목표일: {item.targetDate}
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleCall(item.id)}
                                        className="px-3 py-2 bg-white border border-gray-300 rounded hover:bg-gray-50 flex items-center text-sm"
                                    >
                                        <Phone className="w-4 h-4 mr-1" />
                                        안부 전화
                                    </button>
                                </div>

                                {/* AI Message Section */}
                                <div className="bg-white p-3 rounded border border-green-200">
                                    {!item.generatedMessage ? (
                                        <button
                                            onClick={() => handleGenerateAiMessage(item)}
                                            disabled={generatingId === item.id}
                                            className="w-full py-2 bg-green-100 text-green-700 rounded font-bold hover:bg-green-200 flex justify-center items-center text-sm"
                                        >
                                            {generatingId === item.id ? (
                                                <>
                                                    <Sparkles className="w-4 h-4 mr-2 animate-spin" />
                                                    AI 메시지 생성 중...
                                                </>
                                            ) : (
                                                <>
                                                    <Sparkles className="w-4 h-4 mr-2" />
                                                    AI 개인화 문자 생성
                                                </>
                                            )}
                                        </button>
                                    ) : (
                                        <div className="space-y-2">
                                            <textarea
                                                className="w-full text-sm border-gray-200 rounded p-2 bg-gray-50"
                                                rows={3}
                                                defaultValue={item.generatedMessage}
                                            />
                                            <button
                                                onClick={() => handleSendMessage(item.id, item.generatedMessage)}
                                                className="w-full py-2 bg-green-600 text-white rounded font-bold hover:bg-green-700 flex justify-center items-center text-sm"
                                            >
                                                <MessageSquare className="w-4 h-4 mr-2" />
                                                발송 완료
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
};

export default RecallManager;
