import React, { useState, useEffect } from 'react';
import { X, Calendar, Clock, User, FileText, Save } from 'lucide-react';
import { appointmentService } from '../services/appointmentService';

const ReservationModal = ({ isOpen, onClose, selectedDate, selectedTime, onSave, patients }) => {
    const [formData, setFormData] = useState({
        patientName: '',
        time: '09:00',
        memo: ''
    });
    const [saving, setSaving] = useState(false);
    const [suggestions, setSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [activeIndex, setActiveIndex] = useState(-1);
    const [selectedPatient, setSelectedPatient] = useState(null);

    useEffect(() => {
        if (isOpen) {
            setFormData({
                patientName: '',
                time: selectedTime || '09:00',
                memo: ''
            });
            setSuggestions([]);
            setShowSuggestions(false);
            setActiveIndex(-1);
            setSelectedPatient(null);
        }
    }, [isOpen, selectedTime]);

    const handleNameChange = (e) => {
        const value = e.target.value;
        setFormData({ ...formData, patientName: value });
        setActiveIndex(-1);
        setSelectedPatient(null);

        if (value.trim() && patients) {
            const filtered = patients.filter(p => p.name.includes(value)).slice(0, 5);
            setSuggestions(filtered);
            setShowSuggestions(true);
        } else {
            setSuggestions([]);
            setShowSuggestions(false);
        }
    };

    const handleKeyDown = (e) => {
        if (!showSuggestions || suggestions.length === 0) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActiveIndex(prev => (prev < suggestions.length - 1 ? prev + 1 : prev));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActiveIndex(prev => (prev > 0 ? prev - 1 : -1));
        } else if (e.key === 'Enter') {
            if (activeIndex >= 0) {
                e.preventDefault();
                selectPatient(suggestions[activeIndex]);
            }
        }
    };

    const selectPatient = (patient) => {
        setFormData({ ...formData, patientName: patient.name });
        setSelectedPatient(patient);
        setShowSuggestions(false);
        setActiveIndex(-1);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.patientName) {
            alert('환자 이름을 입력해주세요.');
            return;
        }

        setSaving(true);
        try {
            const startDateTime = `${selectedDate}T${formData.time}:00`;
            const endDate = new Date(new Date(startDateTime).getTime() + 60 * 60000); // 1 hour default
            const endDateTime = endDate.toISOString().split('.')[0];

            const newAppointment = {
                title: formData.patientName,
                patientName: formData.patientName,
                patientId: selectedPatient ? selectedPatient.id : null,
                start: startDateTime,
                end: endDateTime,
                allDay: false,
                type: 'manual',
                memo: formData.memo,
            };

            await appointmentService.addAppointment(newAppointment);
            alert('예약이 저장되었습니다.');
            if (onSave) onSave();
            onClose();
        } catch (error) {
            console.error("Failed to save reservation:", error);
            alert('예약 저장 실패: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10000]">
            <div className="bg-white rounded-lg shadow-xl w-96 max-w-full mx-4">
                <div className="flex justify-between items-center p-4 border-b border-gray-200">
                    <h3 className="text-lg font-bold text-gray-800 flex items-center">
                        <Calendar className="w-5 h-5 mr-2 text-blue-600" />
                        예약 추가
                    </h3>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-4 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">날짜</label>
                        <div className="text-gray-900 font-bold">{selectedDate}</div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">시간</label>
                        <div className="relative">
                            <Clock className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                            <input
                                type="time"
                                value={formData.time}
                                onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                                className="w-full pl-10 border border-gray-300 rounded-md py-2 focus:ring-blue-500 focus:border-blue-500"
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">환자 이름</label>
                        <div className="relative">
                            <User className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                value={formData.patientName}
                                onChange={handleNameChange}
                                onKeyDown={handleKeyDown}
                                className="w-full pl-10 border border-gray-300 rounded-md py-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="이름 입력"
                                required
                                autoFocus
                                autoComplete="off"
                            />
                            {showSuggestions && suggestions.length > 0 && (
                                <ul className="absolute z-10 w-full bg-white border border-gray-300 rounded-md mt-1 shadow-lg max-h-48 overflow-y-auto">
                                    {suggestions.map((patient, index) => (
                                        <li
                                            key={patient.id}
                                            onClick={() => selectPatient(patient)}
                                            className={`px-4 py-2 cursor-pointer text-sm border-b last:border-b-0 flex justify-start items-center gap-2 ${index === activeIndex ? 'bg-blue-100' : 'hover:bg-blue-50'
                                                }`}
                                        >
                                            <span className="font-medium text-gray-900">{patient.name}</span>
                                            <span className="text-gray-500 text-xs">({patient.birthDate})</span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>

                    {/* Patient Info Display */}
                    {formData.patientName && (selectedPatient || patients) && (
                        <div className="mb-4 p-3 bg-gray-50 rounded-md border border-gray-200">
                            {(() => {
                                const patient = selectedPatient || (patients ? patients.find(p => p.name === formData.patientName) : null);

                                if (patient) {
                                    return (
                                        <div className="flex flex-col space-y-1 text-sm">
                                            <div className="flex items-center justify-between">
                                                <span className="font-bold text-gray-700">환자 정보:</span>
                                                <span className="text-gray-500 text-xs">{patient.birthdate}</span>
                                            </div>
                                            <div className="flex items-center space-x-2">
                                                {patient.isAutoInsurance ? (
                                                    <span className="px-2 py-0.5 rounded bg-green-100 text-green-800 font-medium">자보 (자동차보험)</span>
                                                ) : (
                                                    <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-medium">
                                                        {patient.treatmentLevel || '1단계'}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                }
                                return <div className="text-sm text-gray-500">등록되지 않은 환자입니다. (기본 설정 적용)</div>;
                            })()}
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">메모</label>
                        <div className="relative">
                            <FileText className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                value={formData.memo}
                                onChange={(e) => setFormData({ ...formData, memo: e.target.value })}
                                className="w-full pl-10 border border-gray-300 rounded-md py-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="특이사항 (선택)"
                            />
                        </div>
                    </div>

                    <div className="pt-2">
                        <button
                            type="submit"
                            disabled={saving}
                            className="w-full flex justify-center items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 font-bold"
                        >
                            <Save className="w-4 h-4 mr-2" />
                            {saving ? '저장 중...' : '예약 저장'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ReservationModal;
