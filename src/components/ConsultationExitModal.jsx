import React, { useState, useEffect } from 'react';
import { X, Calendar, Shield, AlertCircle, Clock, MessageSquare, Sparkles } from 'lucide-react';
import { defenseService } from '../services/defenseService';
import { geminiService } from '../services/geminiService';
import ReservationModal from './ReservationModal';

const ConsultationExitModal = ({ isOpen, onClose, patient, onReservationSuccess }) => {
    const [step, setStep] = useState(1); // 1: Proposal, 2: Defense 1, 3: Priority, 4: Defense 2, 5: Defense 3
    const [showReservationModal, setShowReservationModal] = useState(false);
    const [aiMessage, setAiMessage] = useState('');
    const [isGeneratingAi, setIsGeneratingAi] = useState(false);

    // Reset state on open
    useEffect(() => {
        if (isOpen) {
            setStep(1);
            setAiMessage('');
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleNextStep = (nextStep) => {
        setStep(nextStep);
    };

    const handleReservationClick = () => {
        setShowReservationModal(true);
    };

    const handlePriorityAssign = async () => {
        // Log priority assignment
        await defenseService.logDefenseAction(patient.id, 'PRIORITY_ASSIGN', 'UNCERTAIN', { deadline: '18:00' });

        // Generate AI Message for Priority
        setIsGeneratingAi(true);
        try {
            // Mock transcript for now - in real app, fetch from voiceService or context
            const mockTranscript = "원장님: 홍길동님 허리는 좀 어떠세요? 환자: 아직 좀 뻐근해요. 원장님: 내일 3시에 오시죠. 환자: 아 내일은 회사 야근 때문에 힘들 것 같아요.";
            const msg = await geminiService.generatePersonalizedMessage(mockTranscript, patient.name, 'PRIORITY');
            setAiMessage(msg);
        } catch (e) {
            console.error(e);
            setAiMessage("메시지 생성 실패");
        } finally {
            setIsGeneratingAi(false);
        }
    };

    const handleRecallRegister = async () => {
        // Log final refusal and add to recall queue
        await defenseService.logDefenseAction(patient.id, 'DEFENSE_3', 'FAIL');

        // Add to Recall Queue (D+3)
        const targetDate = new Date();
        targetDate.setDate(targetDate.getDate() + 3);
        const dateStr = targetDate.toISOString().split('T')[0];

        await defenseService.addToRecallQueue(patient.id, patient.name, 'Defense 3 Fail', dateStr);

        alert(`${patient.name}님이 D+3일 리콜 큐에 등록되었습니다.`);
        onClose();
    };

    const handleSendPriorityMessage = () => {
        alert(`[전송 완료] ${patient.name}님께 우선 배정 안내 문자가 발송되었습니다.\n\n내용: ${aiMessage}`);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]">
            <div className="bg-white rounded-lg shadow-xl w-[600px] max-w-full mx-4 overflow-hidden">
                {/* Header */}
                <div className="bg-blue-600 px-6 py-4 flex justify-between items-center text-white">
                    <h3 className="text-lg font-bold flex items-center">
                        <Shield className="w-5 h-5 mr-2" />
                        예약 방어 시스템 (Part 1)
                    </h3>
                    <button onClick={onClose} className="text-white hover:text-blue-200">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6">
                    <div className="mb-6 text-center">
                        <h2 className="text-2xl font-bold text-gray-800 mb-2">{patient?.name}님 퇴실 상담</h2>
                        <p className="text-gray-500">현재 단계: {step} / 5</p>
                    </div>

                    {/* Step 1: Proposal */}
                    {step === 1 && (
                        <div className="space-y-6">
                            <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                                <h4 className="font-bold text-blue-800 mb-2">Step 1. 제안 (Proposal)</h4>
                                <p className="text-lg font-medium text-gray-800">
                                    "내일 오후 3시에 예약해드릴게요."
                                </p>
                                <p className="text-sm text-gray-500 mt-2">* 결정형 멘트로 제안하세요.</p>
                            </div>
                            <div className="flex space-x-4">
                                <button
                                    onClick={handleReservationClick}
                                    className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700"
                                >
                                    예약 확정 (YES)
                                </button>
                                <button
                                    onClick={() => handleNextStep(2)}
                                    className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg font-bold hover:bg-gray-300"
                                >
                                    거절 (NO)
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Step 2: Defense 1 (Authority) */}
                    {step === 2 && (
                        <div className="space-y-6">
                            <div className="bg-red-50 p-4 rounded-lg border border-red-100">
                                <h4 className="font-bold text-red-800 mb-2">Step 2. 방어 1단계 (권위)</h4>
                                <p className="text-lg font-medium text-gray-800">
                                    "원장님이 신신당부하셨어요. 염증이 걱정된다고 꼭 잡으라고 하셔서 제 마음대로 못 뺍니다."
                                </p>
                            </div>
                            <div className="flex space-x-4">
                                <button
                                    onClick={handleReservationClick}
                                    className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700"
                                >
                                    동의 (YES)
                                </button>
                                <button
                                    onClick={() => handleNextStep(3)}
                                    className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg font-bold hover:bg-gray-300"
                                >
                                    거절/불확실 (NO)
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Step 3: Priority Assignment */}
                    {step === 3 && (
                        <div className="space-y-6">
                            <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-100">
                                <h4 className="font-bold text-yellow-800 mb-2">Step 3. 우선 배정 (Priority)</h4>
                                <p className="text-lg font-medium text-gray-800 mb-4">
                                    "스케줄이 불확실하신가요? 그럼 우선 배정해 둘 테니 18:00까지 확정 문자 주세요."
                                </p>
                                <div className="bg-white p-3 rounded border border-yellow-200 text-sm">
                                    <p className="font-bold text-gray-700 mb-1">[System Action]</p>
                                    <p>18:30까지 연락 없으면 "예약 유지" 자동 문자 발송 예정</p>
                                </div>
                            </div>

                            {/* AI Message Generation Area */}
                            {!aiMessage ? (
                                <div className="flex space-x-4">
                                    <button
                                        onClick={handlePriorityAssign}
                                        className="flex-1 bg-yellow-500 text-white py-3 rounded-lg font-bold hover:bg-yellow-600 flex justify-center items-center"
                                        disabled={isGeneratingAi}
                                    >
                                        {isGeneratingAi ? (
                                            <>
                                                <Sparkles className="w-4 h-4 mr-2 animate-spin" />
                                                AI 메시지 생성 중...
                                            </>
                                        ) : (
                                            <>
                                                <Sparkles className="w-4 h-4 mr-2" />
                                                우선 배정 (AI 문자 생성)
                                            </>
                                        )}
                                    </button>
                                    <button
                                        onClick={() => handleNextStep(4)}
                                        className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg font-bold hover:bg-gray-300"
                                    >
                                        단순 거절 (Next)
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="bg-gray-100 p-3 rounded-lg">
                                        <label className="text-xs font-bold text-gray-500 block mb-1">발송 예정 문자 (AI 생성됨)</label>
                                        <textarea
                                            className="w-full bg-transparent border-none p-0 text-sm text-gray-800 focus:ring-0"
                                            rows={4}
                                            value={aiMessage}
                                            onChange={(e) => setAiMessage(e.target.value)}
                                        />
                                    </div>
                                    <button
                                        onClick={handleSendPriorityMessage}
                                        className="w-full bg-green-600 text-white py-3 rounded-lg font-bold hover:bg-green-700 flex justify-center items-center"
                                    >
                                        <MessageSquare className="w-4 h-4 mr-2" />
                                        문자 발송 및 종료
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Step 4: Defense 2 (Negotiation) */}
                    {step === 4 && (
                        <div className="space-y-6">
                            <div className="bg-purple-50 p-4 rounded-lg border border-purple-100">
                                <h4 className="font-bold text-purple-800 mb-2">Step 4. 방어 2단계 (협상)</h4>
                                <p className="text-lg font-medium text-gray-800">
                                    "그럼 이번 주는 2회만 오세요. 야간 진료도 열려있습니다."
                                </p>
                            </div>
                            <div className="flex space-x-4">
                                <button
                                    onClick={handleReservationClick}
                                    className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700"
                                >
                                    동의 (YES)
                                </button>
                                <button
                                    onClick={() => handleNextStep(5)}
                                    className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg font-bold hover:bg-gray-300"
                                >
                                    거절 (NO)
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Step 5: Defense 3 (Trigger) */}
                    {step === 5 && (
                        <div className="space-y-6">
                            <div className="bg-gray-100 p-4 rounded-lg border border-gray-200">
                                <h4 className="font-bold text-gray-800 mb-2">Step 5. 방어 3단계 (트리거 설정)</h4>
                                <p className="text-lg font-medium text-gray-800 mb-4">
                                    "알겠습니다. 그럼 3일 뒤에 연락드릴게요. 그때 아프시면 꼭 오세요."
                                </p>
                                <div className="bg-white p-3 rounded border border-gray-300 text-sm text-red-600 font-bold">
                                    * D+3일 리콜 큐에 자동 등록됩니다.
                                </div>
                            </div>
                            <button
                                onClick={handleRecallRegister}
                                className="w-full bg-gray-800 text-white py-3 rounded-lg font-bold hover:bg-gray-900"
                            >
                                확인 및 종료
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Nested Reservation Modal */}
            <ReservationModal
                isOpen={showReservationModal}
                onClose={() => setShowReservationModal(false)}
                selectedDate={new Date().toISOString().split('T')[0]}
                onSave={() => {
                    setShowReservationModal(false);
                    onReservationSuccess();
                    onClose();
                }}
                patients={[patient]} // Pass current patient for autocomplete convenience
            />
        </div>
    );
};

export default ConsultationExitModal;
