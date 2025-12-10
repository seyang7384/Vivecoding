import React, { useState, useEffect } from 'react';
import { Phone, Clock, MessageSquare, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { defenseService } from '../services/defenseService';
import { appointmentService } from '../services/appointmentService';
import { visitService } from '../services/visitService';

const NoShowManager = () => {
    const [noShows, setNoShows] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        loadNoShows();
    }, []);

    const loadNoShows = async () => {
        setLoading(true);
        try {
            // In a real app, we'd fetch today's appointments and visits
            // For demo, we'll mock some data or use services if available
            // const appointments = await appointmentService.getAppointments();
            // const visits = await visitService.getVisitsByDate(new Date().toISOString().split('T')[0]);
            // const list = await defenseService.getPotentialNoShows(appointments, visits);

            // Mock Data for Demo
            const mockList = [
                { id: 1, patientName: '김철수', start: new Date(Date.now() - 15 * 60000).toISOString(), phone: '010-1234-5678', status: 'LATE' },
                { id: 2, patientName: '이영희', start: new Date(Date.now() - 70 * 60000).toISOString(), phone: '010-9876-5432', status: 'SILENCE' } // > 1 hour
            ];
            setNoShows(mockList);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleCall = (id) => {
        alert("전화 발신 기록이 저장되었습니다.");
        // Update status to 'CALLED'
    };

    const handleSilenceStart = (id) => {
        alert("부재중 확인. 1시간 침묵 타이머가 시작되었습니다.");
        setNoShows(prev => prev.map(item => item.id === id ? { ...item, status: 'SILENCE_TIMER' } : item));
    };

    const handleSendText = (id, type) => {
        const msg = type === 'A'
            ? "내일 오전/오후 중 편하신 시간에 답장 주시면 예약을 잡아두겠습니다."
            : "네이버 예약 링크: https://booking.naver.com/...";

        alert(`[문자 발송] ${msg}`);
        // Log action and remove from list or mark done
        setNoShows(prev => prev.filter(item => item.id !== id));
    };

    return (
        <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
                <AlertTriangle className="w-6 h-6 mr-2 text-red-500" />
                당일 노쇼 관리 (Part 2)
            </h2>

            {loading ? (
                <div>Loading...</div>
            ) : (
                <div className="space-y-4">
                    {noShows.length === 0 ? (
                        <div className="text-gray-500 text-center py-8">현재 노쇼 의심 환자가 없습니다.</div>
                    ) : (
                        noShows.map(item => {
                            const isOverOneHour = (new Date() - new Date(item.start)) / (1000 * 60) > 60;

                            return (
                                <div key={item.id} className="border border-gray-200 rounded-lg p-4 flex justify-between items-center bg-red-50">
                                    <div>
                                        <div className="flex items-center space-x-2">
                                            <span className="font-bold text-lg">{item.patientName}</span>
                                            <span className="text-sm text-gray-500">{item.phone}</span>
                                        </div>
                                        <div className="text-red-600 font-medium mt-1">
                                            예약 시간: {new Date(item.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            <span className="ml-2 text-sm bg-red-100 px-2 py-0.5 rounded">
                                                {Math.floor((new Date() - new Date(item.start)) / 60000)}분 지각
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex space-x-2">
                                        {/* Step 1: Call */}
                                        <button
                                            onClick={() => handleCall(item.id)}
                                            className="px-3 py-2 bg-white border border-gray-300 rounded hover:bg-gray-50 flex items-center text-sm"
                                        >
                                            <Phone className="w-4 h-4 mr-1" />
                                            전화 확인
                                        </button>

                                        {/* Step 2: Silence Timer */}
                                        <button
                                            onClick={() => handleSilenceStart(item.id)}
                                            className="px-3 py-2 bg-white border border-gray-300 rounded hover:bg-gray-50 flex items-center text-sm"
                                        >
                                            <Clock className="w-4 h-4 mr-1" />
                                            부재 (1시간 대기)
                                        </button>

                                        {/* Step 3: Send Text (Only if > 1 hour or manually triggered) */}
                                        <div className="flex flex-col space-y-1">
                                            <button
                                                onClick={() => handleSendText(item.id, 'A')}
                                                className={`px-3 py-1 rounded text-xs font-bold text-white flex items-center ${isOverOneHour ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-400 cursor-not-allowed'}`}
                                                disabled={!isOverOneHour}
                                            >
                                                <MessageSquare className="w-3 h-3 mr-1" />
                                                문자 A (답장유도)
                                            </button>
                                            <button
                                                onClick={() => handleSendText(item.id, 'B')}
                                                className={`px-3 py-1 rounded text-xs font-bold text-white flex items-center ${isOverOneHour ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-400 cursor-not-allowed'}`}
                                                disabled={!isOverOneHour}
                                            >
                                                <MessageSquare className="w-3 h-3 mr-1" />
                                                문자 B (링크)
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            )}
        </div>
    );
};

export default NoShowManager;
