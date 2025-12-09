import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import Input from '../ui/Input';
import Button from '../ui/Button';

const AddPatientModal = ({ isOpen, onClose, onSave, initialData = null }) => {
    const [formData, setFormData] = useState({
        name: '',
        birthYear: '',
        birthMonth: '',
        birthDay: '',
        phone: '',
        gender: 'male',
        memo: '',
        herbalStartDate: '',
        isAutoInsurance: false,
        injuryDate: '',
        firstVisitDate: '',
        herbalPrescriptions: [],
        treatmentLevel: '1단계'
    });

    // Refs for auto-focus
    const yearRef = React.useRef(null);
    const monthRef = React.useRef(null);
    const dayRef = React.useRef(null);

    useEffect(() => {
        if (isOpen && initialData) {
            // Parse birthDate (YYYY-MM-DD)
            const [year, month, day] = (initialData.birthDate || '--').split('-');

            setFormData({
                name: initialData.name || '',
                birthYear: year || '',
                birthMonth: month || '',
                birthDay: day || '',
                phone: initialData.phone || '',
                gender: initialData.gender || 'male',
                memo: initialData.memo || '',
                herbalStartDate: initialData.herbalStartDate || '',
                isAutoInsurance: initialData.isAutoInsurance || false,
                injuryDate: initialData.injuryDate || '',
                firstVisitDate: initialData.firstVisitDate || '',
                herbalPrescriptions: initialData.herbalPrescriptions || [],
                treatmentLevel: initialData.treatmentLevel || '1단계'
            });
        } else if (isOpen && !initialData) {
            // Reset for new patient
            setFormData({
                name: '',
                birthYear: '',
                birthMonth: '',
                birthDay: '',
                phone: '',
                gender: 'male',
                memo: '',
                herbalStartDate: '',
                isAutoInsurance: false,
                injuryDate: '',
                firstVisitDate: '',
                herbalPrescriptions: [],
                treatmentLevel: '1단계'
            });
        }
    }, [isOpen, initialData]);

    if (!isOpen) return null;

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    // Handle Date Input Auto-focus
    const handleDateChange = (e, type) => {
        const { value } = e.target;
        // Only allow numbers
        if (!/^\d*$/.test(value)) return;

        if (type === 'year') {
            if (value.length <= 4) {
                setFormData(prev => ({ ...prev, birthYear: value }));
                if (value.length === 4) monthRef.current?.focus();
            }
        } else if (type === 'month') {
            if (value.length <= 2) {
                setFormData(prev => ({ ...prev, birthMonth: value }));
                if (value.length === 2) dayRef.current?.focus();
            }
        } else if (type === 'day') {
            if (value.length <= 2) {
                setFormData(prev => ({ ...prev, birthDay: value }));
            }
        }
    };

    // Handle Phone Number Formatting
    const handlePhoneChange = (e) => {
        const value = e.target.value.replace(/[^0-9]/g, '');
        let formattedPhone = '';

        if (value.length <= 3) {
            formattedPhone = value;
        } else if (value.length <= 7) {
            formattedPhone = `${value.slice(0, 3)}-${value.slice(3)}`;
        } else {
            formattedPhone = `${value.slice(0, 3)}-${value.slice(3, 7)}-${value.slice(7, 11)}`;
        }

        setFormData(prev => ({ ...prev, phone: formattedPhone }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        // Combine date parts into YYYY-MM-DD
        const fullDate = `${formData.birthYear}-${formData.birthMonth.padStart(2, '0')}-${formData.birthDay.padStart(2, '0')}`;

        onSave({
            ...formData,
            birthDate: fullDate
        });

        // Reset form
        setFormData({
            name: '',
            birthYear: '',
            birthMonth: '',
            birthDay: '',
            phone: '',
            gender: 'male',
            memo: '',
            herbalStartDate: '',
            isAutoInsurance: false,
            injuryDate: '',
            firstVisitDate: '',
            herbalPrescriptions: [],
            treatmentLevel: '1단계'
        });
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
                <div className="flex justify-between items-center p-6 border-b border-gray-200">
                    <h3 className="text-lg font-bold text-gray-900">
                        {initialData ? '환자 정보 수정' : '신규 환자 등록'}
                    </h3>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <Input
                        label="이름"
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        required
                    />

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">생년월일</label>
                            <div className="flex space-x-2">
                                <input
                                    ref={yearRef}
                                    type="text"
                                    placeholder="YYYY"
                                    value={formData.birthYear}
                                    onChange={(e) => handleDateChange(e, 'year')}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-center"
                                    maxLength={4}
                                    required
                                />
                                <input
                                    ref={monthRef}
                                    type="text"
                                    placeholder="MM"
                                    value={formData.birthMonth}
                                    onChange={(e) => handleDateChange(e, 'month')}
                                    className="w-16 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-center"
                                    maxLength={2}
                                    required
                                />
                                <input
                                    ref={dayRef}
                                    type="text"
                                    placeholder="DD"
                                    value={formData.birthDay}
                                    onChange={(e) => handleDateChange(e, 'day')}
                                    className="w-16 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-center"
                                    maxLength={2}
                                    required
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">성별</label>
                            <select
                                name="gender"
                                value={formData.gender}
                                onChange={handleChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="male">남성</option>
                                <option value="female">여성</option>
                            </select>
                        </div>
                    </div>

                    <Input
                        label="연락처"
                        name="phone"
                        type="tel"
                        placeholder="010-0000-0000"
                        value={formData.phone}
                        onChange={handlePhoneChange}
                        maxLength={13}
                        required
                    />

                    {/* Auto Insurance Section */}
                    <div className="border-t pt-4 mt-4">
                        <div className="flex items-center space-x-2 mb-3">
                            <input
                                type="checkbox"
                                id="isAutoInsurance"
                                checked={formData.isAutoInsurance}
                                onChange={(e) => {
                                    const isChecked = e.target.checked;
                                    setFormData({
                                        ...formData,
                                        isAutoInsurance: isChecked,
                                        firstVisitDate: isChecked ? new Date().toISOString().split('T')[0] : ''
                                    });
                                }}
                                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                            />
                            <label htmlFor="isAutoInsurance" className="text-sm font-medium text-gray-700 cursor-pointer">
                                자보 (자동차보험) 환자
                            </label>
                        </div>

                        {formData.isAutoInsurance && (
                            <>
                                <Input
                                    label="수상일"
                                    name="injuryDate"
                                    type="date"
                                    value={formData.injuryDate || ''}
                                    onChange={handleChange}
                                    required={formData.isAutoInsurance}
                                />
                                <Input
                                    label="첫 내원일"
                                    name="firstVisitDate"
                                    type="date"
                                    value={formData.firstVisitDate || ''}
                                    onChange={handleChange}
                                />
                            </>
                        )}
                    </div>

                    {/* Treatment Level Section */}
                    <div className="border-t pt-4 mt-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">진료 단계 (로딩 강도)</label>
                        <select
                            name="treatmentLevel"
                            value={formData.treatmentLevel || '1단계'}
                            onChange={handleChange}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="1단계">1단계 - 일반 침치료 (가장 적음)</option>
                            <option value="2단계">2단계 - 일반+약침</option>
                            <option value="3단계">3단계 - 일반+약침+추나</option>
                            <option value="4단계">4단계 - 일반+약침+추나+특수</option>
                            <option value="5단계">5단계 - 피부 시술</option>
                            <option value="6단계">6단계 - 첩약 상담</option>
                        </select>
                    </div>

                    <div className="border-t pt-4 mt-4">
                        <Input
                            label="첩약 처방일"
                            name="herbalStartDate"
                            type="date"
                            value={formData.herbalStartDate || ''}
                            onChange={handleChange}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">특이사항 (메모)</label>
                        <textarea
                            name="memo"
                            rows="3"
                            value={formData.memo}
                            onChange={handleChange}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                        ></textarea>
                    </div>

                    <div className="pt-4 flex space-x-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
                        >
                            취소
                        </button>
                        <Button type="submit" className="flex-1">
                            {initialData ? '수정하기' : '등록하기'}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AddPatientModal;
