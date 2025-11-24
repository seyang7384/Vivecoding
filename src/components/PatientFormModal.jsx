import React, { useState, useRef } from 'react';
import { X } from 'lucide-react';

const PatientFormModal = ({ isOpen, onClose, onSubmit }) => {
    const [formData, setFormData] = useState({
        name: '',
        dob: '',
        gender: 'M',
        contact: '',
        notes: '',
        herbalMedicineStartDate: ''
    });

    // Refs for DOB fields
    const dobYearRef = useRef(null);
    const dobMonthRef = useRef(null);
    const dobDayRef = useRef(null);

    // DOB state
    const [dobYear, setDobYear] = useState('');
    const [dobMonth, setDobMonth] = useState('');
    const [dobDay, setDobDay] = useState('');

    if (!isOpen) return null;

    const handleSubmit = (e) => {
        e.preventDefault();
        // Combine DOB parts
        const fullDob = `${dobYear}-${dobMonth.padStart(2, '0')}-${dobDay.padStart(2, '0')}`;
        onSubmit({ ...formData, dob: fullDob });

        // Reset
        setFormData({ name: '', dob: '', gender: 'M', contact: '', notes: '', herbalMedicineStartDate: '' });
        setDobYear('');
        setDobMonth('');
        setDobDay('');
    };

    // Handle DOB year input
    const handleYearChange = (e) => {
        const value = e.target.value.replace(/\D/g, '').slice(0, 4);
        setDobYear(value);
        if (value.length === 4) {
            dobMonthRef.current?.focus();
        }
    };

    // Handle DOB month input
    const handleMonthChange = (e) => {
        const value = e.target.value.replace(/\D/g, '').slice(0, 2);
        setDobMonth(value);
        if (value.length === 2) {
            dobDayRef.current?.focus();
        }
    };

    // Handle DOB day input
    const handleDayChange = (e) => {
        const value = e.target.value.replace(/\D/g, '').slice(0, 2);
        setDobDay(value);
    };

    // Handle phone number formatting
    const handleContactChange = (e) => {
        const value = e.target.value.replace(/\D/g, ''); // Remove non-digits
        let formatted = value;

        if (value.length <= 3) {
            formatted = value;
        } else if (value.length <= 7) {
            formatted = `${value.slice(0, 3)}-${value.slice(3)}`;
        } else if (value.length <= 11) {
            formatted = `${value.slice(0, 3)}-${value.slice(3, 7)}-${value.slice(7)}`;
        } else {
            formatted = `${value.slice(0, 3)}-${value.slice(3, 7)}-${value.slice(7, 11)}`;
        }

        setFormData({ ...formData, contact: formatted });
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
                <div className="flex items-center justify-between p-4 border-b border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-900">신규 환자 등록</h3>
                    <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full">
                        <X size={20} className="text-gray-500" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-4 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">이름</label>
                        <input
                            type="text"
                            required
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">생년월일</label>
                        <div className="grid grid-cols-3 gap-2">
                            <input
                                ref={dobYearRef}
                                type="text"
                                required
                                placeholder="YYYY"
                                maxLength="4"
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-center"
                                value={dobYear}
                                onChange={handleYearChange}
                            />
                            <input
                                ref={dobMonthRef}
                                type="text"
                                required
                                placeholder="MM"
                                maxLength="2"
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-center"
                                value={dobMonth}
                                onChange={handleMonthChange}
                            />
                            <input
                                ref={dobDayRef}
                                type="text"
                                required
                                placeholder="DD"
                                maxLength="2"
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-center"
                                value={dobDay}
                                onChange={handleDayChange}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">성별</label>
                        <select
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                            value={formData.gender}
                            onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                        >
                            <option value="M">남성</option>
                            <option value="F">여성</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">연락처</label>
                        <input
                            type="text"
                            required
                            placeholder="010-0000-0000"
                            maxLength="13"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                            value={formData.contact}
                            onChange={handleContactChange}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">첩약 복용 시작일 (선택)</label>
                        <input
                            type="date"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                            value={formData.herbalMedicineStartDate}
                            onChange={(e) => setFormData({ ...formData, herbalMedicineStartDate: e.target.value })}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">특이사항 (메모)</label>
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
                            등록하기
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default PatientFormModal;
