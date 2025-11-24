import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { patientService } from '../services/patientService';

const AppointmentModal = ({ isOpen, onClose, onSubmit, initialDate }) => {
    const [patients, setPatients] = useState([]);
    const [formData, setFormData] = useState({
        patientId: '',
        patientName: '',
        start: '',
        end: '',
        type: '진료',
        notes: ''
    });

    useEffect(() => {
        if (isOpen) {
            fetchPatients();
            if (initialDate) {
                // Set default time to 09:00 of the selected date using local time
                const year = initialDate.getFullYear();
                const month = String(initialDate.getMonth() + 1).padStart(2, '0');
                const day = String(initialDate.getDate()).padStart(2, '0');
                const dateStr = `${year}-${month}-${day}`;

                setFormData(prev => ({
                    ...prev,
                    start: `${dateStr}T09:00`,
                    end: `${dateStr}T10:00`
                }));
            }
        }
    }, [isOpen, initialDate]);

    const fetchPatients = async () => {
        const data = await patientService.getPatients();
        setPatients(data);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        const selectedPatient = patients.find(p => p.id === formData.patientId);

        onSubmit({
            ...formData,
            patientName: selectedPatient ? selectedPatient.name : 'Unknown'
        });

        setFormData({
            patientId: '',
            patientName: '',
            start: '',
            end: '',
            type: '진료',
            notes: ''
        });
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
                <div className="flex items-center justify-between p-4 border-b border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-900">새 예약 등록</h3>
                    <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full">
                        <X size={20} className="text-gray-500" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-4 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">환자 선택</label>
                        <select
                            required
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                            value={formData.patientId}
                            onChange={(e) => setFormData({ ...formData, patientId: e.target.value })}
                        >
                            <option value="">환자를 선택하세요</option>
                            {patients.map(p => (
                                <option key={p.id} value={p.id}>{p.name} ({p.dob})</option>
                            ))}
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">시작 시간</label>
                            <input
                                type="datetime-local"
                                required
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                value={formData.start}
                                onChange={(e) => setFormData({ ...formData, start: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">종료 시간</label>
                            <input
                                type="datetime-local"
                                required
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                value={formData.end}
                                onChange={(e) => setFormData({ ...formData, end: e.target.value })}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">진료 항목</label>
                        <select
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                            value={formData.type}
                            onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                        >
                            <option value="진료">일반 진료</option>
                            <option value="검진">정기 검진</option>
                            <option value="수술">수술</option>
                            <option value="상담">상담</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">메모</label>
                        <textarea
                            rows="3"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
                            value={formData.notes}
                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        />
                    </div>

                    <div className="pt-4 flex justify-end space-x-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                        >
                            취소
                        </button>
                        <button
                            type="submit"
                            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                        >
                            예약하기
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AppointmentModal;
