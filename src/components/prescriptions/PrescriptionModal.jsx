import React, { useState, useEffect } from 'react';
import { X, FileText, AlertCircle } from 'lucide-react';
import Button from '../ui/Button';
import { prescriptionService } from '../../services/prescriptionService';
import { visitService } from '../../services/visitService';
import { useNavigate } from 'react-router-dom';

const PrescriptionModal = ({ isOpen, onClose, preSelectedPatient = null, onPrescriptionComplete }) => {
    const navigate = useNavigate();
    const [text, setText] = useState('');
    const [duration, setDuration] = useState(15);
    const [preview, setPreview] = useState(null);
    const [error, setError] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);

    useEffect(() => {
        if (!isOpen) {
            // Reset when modal closes
            setText('');
            setDuration(15);
            setPreview(null);
            setError('');
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleAnalyze = () => {
        setError('');
        setPreview(null);

        // Get all patients
        const patients = JSON.parse(localStorage.getItem('patients') || '[]');

        // Process prescription
        const result = prescriptionService.processPrescription(text, duration, patients);

        if (!result.success) {
            if (result.needsRegistration) {
                const confirmRegister = window.confirm(
                    `환자 정보를 찾을 수 없습니다.\n환자명: ${result.patientName}\n\n신규 등록하시겠습니까?`
                );
                if (confirmRegister) {
                    // Navigate to patients page to register
                    onClose();
                    navigate('/patients');
                }
            } else {
                setError(result.error);
            }
            return;
        }

        // Show preview
        setPreview(result);
    };

    const [price, setPrice] = useState(0);

    const handleConfirm = async () => {
        setIsProcessing(true);

        try {
            // 1. Save prescription (existing logic)
            // In a real app, we would save the prescription object here

            // 2. Add to visit record
            if (preview && preview.prescription) {
                const today = new Date().toISOString().split('T')[0];
                await visitService.addItem(preview.prescription.patientId, today, {
                    type: 'prescription',
                    name: `첩약 (${preview.prescription.duration}일) - ${preview.prescription.prescriptionDetail}`,
                    price: price,
                    category: '첩약'
                });
            }

            // Simulate processing delay
            setTimeout(() => {
                alert('처방이 성공적으로 등록되었습니다!\n\n📅 재상담 일정이 자동으로 추가되었습니다.\n💬 첩약 처방 채팅방에 알림이 전송되었습니다.');
                if (onPrescriptionComplete) onPrescriptionComplete();
                onClose();
                setIsProcessing(false);
            }, 500);
        } catch (error) {
            console.error("Error saving prescription:", error);
            alert("처방 등록 실패: " + error.message);
            setIsProcessing(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="sticky top-0 bg-white p-6 border-b border-gray-200 flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                        <FileText className="w-6 h-6 text-blue-600" />
                        <h3 className="text-lg font-bold text-gray-900">첩약 처방하기</h3>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-4">
                    {/* Instructions */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <p className="text-sm text-blue-800 font-medium mb-2">📝 입력 형식 (4줄)</p>
                        <div className="text-xs text-blue-700 space-y-1 font-mono">
                            <p>1줄: 환자명</p>
                            <p>2줄: 처방 구성</p>
                            <p>3줄: 물 용량</p>
                            <p>4줄: 비고</p>
                        </div>
                    </div>

                    {/* Text Input */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            처방 데이터 붙여넣기
                        </label>
                        <textarea
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            placeholder="송미령님&#10;당귀 10g, 천궁 8g, 백작약 12g&#10;물 1000ml&#10;식후 1시간"
                            rows="6"
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm resize-none"
                        />
                    </div>

                    {/* Duration & Price Selection */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                복용 기간
                            </label>
                            <select
                                value={duration}
                                onChange={(e) => setDuration(Number(e.target.value))}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value={7}>7일</option>
                                <option value={15}>15일</option>
                                <option value={30}>30일</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                처방 가격 (원)
                            </label>
                            <input
                                type="number"
                                value={price}
                                onChange={(e) => setPrice(Number(e.target.value))}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-right"
                                placeholder="0"
                            />
                        </div>
                    </div>

                    {/* Error Display */}
                    {error && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start space-x-3">
                            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                            <div className="text-sm text-red-800 whitespace-pre-line">{error}</div>
                        </div>
                    )}

                    {/* Preview */}
                    {preview && (
                        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                            <p className="text-sm font-medium text-green-900 mb-3">✅ 분석 완료</p>
                            <div className="space-y-2 text-sm">
                                <div className="flex">
                                    <span className="text-gray-600 w-24">성함:</span>
                                    <span className="text-gray-900 font-medium">{preview.prescription.patientName}</span>
                                </div>
                                <div className="flex">
                                    <span className="text-gray-600 w-24">약재:</span>
                                    <span className="text-gray-900">{preview.prescription.prescriptionDetail}</span>
                                </div>
                                <div className="flex">
                                    <span className="text-gray-600 w-24">물량:</span>
                                    <span className="text-gray-900">{preview.prescription.waterVolume}</span>
                                </div>
                                <div className="flex">
                                    <span className="text-gray-600 w-24">비고:</span>
                                    <span className="text-gray-900">{preview.prescription.memo}</span>
                                </div>
                                <div className="flex">
                                    <span className="text-gray-600 w-24">복용 기간:</span>
                                    <span className="text-gray-900">{preview.prescription.duration}일</span>
                                </div>
                                <div className="flex">
                                    <span className="text-gray-600 w-24">가격:</span>
                                    <span className="text-gray-900 font-bold">{price.toLocaleString()}원</span>
                                </div>
                                <div className="flex">
                                    <span className="text-gray-600 w-24">재상담일:</span>
                                    <span className="text-gray-900 font-medium">
                                        {new Date(preview.prescription.followUpDate).toLocaleDateString('ko-KR', {
                                            month: 'long',
                                            day: 'numeric'
                                        })}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex space-x-3 pt-4">
                        {!preview ? (
                            <>
                                <button
                                    onClick={onClose}
                                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
                                >
                                    취소
                                </button>
                                <Button
                                    onClick={handleAnalyze}
                                    disabled={!text.trim()}
                                    className="flex-1"
                                >
                                    분석 및 저장
                                </Button>
                            </>
                        ) : (
                            <>
                                <button
                                    onClick={() => {
                                        setPreview(null);
                                        setError('');
                                    }}
                                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
                                >
                                    다시 입력
                                </button>
                                <Button
                                    onClick={handleConfirm}
                                    disabled={isProcessing}
                                    className="flex-1"
                                >
                                    {isProcessing ? '처리 중...' : '확인 및 등록'}
                                </Button>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PrescriptionModal;
