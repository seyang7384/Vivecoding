import React from 'react';
import { X, AlertCircle, Calendar, MessageCircle } from 'lucide-react';
import Button from '../ui/Button';

const PackageRenewalModal = ({ isOpen, onClose, packageInfo, onConfirm }) => {
    if (!isOpen || !packageInfo) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 overflow-hidden animate-fade-in-up">
                {/* Header */}
                <div className="bg-blue-600 px-6 py-4 flex justify-between items-center">
                    <h3 className="text-lg font-bold text-white flex items-center">
                        <AlertCircle className="w-5 h-5 mr-2" />
                        패키지 연장 알림
                    </h3>
                    <button onClick={onClose} className="text-white hover:text-blue-200 transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                        <p className="text-blue-800 font-medium text-lg mb-1">
                            {packageInfo.name}
                        </p>
                        <p className="text-blue-600">
                            금일 치료 후 <span className="font-bold text-red-600 text-xl">1회</span> 남습니다.
                        </p>
                    </div>

                    <p className="text-gray-600 mb-6 leading-relaxed">
                        환자분께 패키지 연장 상담을 진행하시겠습니까?<br />
                        <span className="text-sm text-gray-500">지금 상담을 진행하면 연속적인 치료 계획을 수립할 수 있습니다.</span>
                    </p>

                    {/* Actions */}
                    <div className="flex space-x-3">
                        <Button
                            variant="secondary"
                            onClick={onClose}
                            className="flex-1"
                        >
                            나중에 하기
                        </Button>
                        <Button
                            onClick={onConfirm}
                            className="flex-1 bg-blue-600 hover:bg-blue-700"
                        >
                            <MessageCircle className="w-4 h-4 mr-2" />
                            상담 진행 (기록)
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PackageRenewalModal;
