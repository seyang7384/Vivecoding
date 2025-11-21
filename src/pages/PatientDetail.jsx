import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, FileText, User, Car, Pill } from 'lucide-react';
import Button from '../components/ui/Button';
import AddPatientModal from '../components/patients/AddPatientModal';
import PrescriptionModal from '../components/prescriptions/PrescriptionModal';
import { autoInsuranceService } from '../services/autoInsuranceService';

const PatientDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [patient, setPatient] = useState(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isPrescriptionModalOpen, setIsPrescriptionModalOpen] = useState(false);

    useEffect(() => {
        // Fetch patient from localStorage
        const storedPatients = JSON.parse(localStorage.getItem('patients') || '[]');
        const foundPatient = storedPatients.find(p => p.id.toString() === id);

        if (foundPatient) {
            // Add mock history/appointments if not present
            setPatient({
                ...foundPatient,
                history: foundPatient.history || [
                    { date: '2023-10-15', diagnosis: '감기', treatment: '약물 처방' },
                    { date: '2023-09-01', diagnosis: '정기 검진', treatment: '혈압 측정' },
                ],
                appointments: foundPatient.appointments || [
                    { date: '2023-11-20', time: '14:00', type: '진료' },
                ]
            });
        } else {
            console.error('Patient not found');
        }
    }, [id]);

    const handleUpdatePatient = (updatedData) => {
        const storedPatients = JSON.parse(localStorage.getItem('patients') || '[]');
        const updatedPatients = storedPatients.map(p =>
            p.id.toString() === id ? { ...p, ...updatedData } : p
        );

        localStorage.setItem('patients', JSON.stringify(updatedPatients));

        setPatient(prev => ({
            ...prev,
            ...updatedData
        }));

        setIsEditModalOpen(false);
    };

    if (!patient) return <div>Loading...</div>;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center">
                    <button
                        onClick={() => navigate('/patients')}
                        className="mr-4 p-2 hover:bg-gray-100 rounded-full transition-colors"
                    >
                        <ArrowLeft className="w-6 h-6 text-gray-600" />
                    </button>
                    <h1 className="text-2xl font-bold text-gray-900">환자 상세 정보</h1>
                </div>
                <div className="flex items-center space-x-2">
                    <Button onClick={() => setIsPrescriptionModalOpen(true)} className="w-auto">
                        <Pill className="w-4 h-4 mr-2" />
                        첩약 처방하기
                    </Button>
                    <Button onClick={() => setIsEditModalOpen(true)} className="w-auto">
                        정보 수정
                    </Button>
                </div>
            </div>

            {/* Patient Info Card */}
            <div className="bg-white rounded-xl shadow-sm p-6">
                <div className="flex items-start">
                    <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mr-6">
                        <User className="w-10 h-10 text-blue-600" />
                    </div>
                    <div className="flex-1">
                        <div>
                            <h2 className="text-xl font-bold text-gray-900">{patient.name}</h2>
                            <p className="text-gray-500">
                                {patient.gender === 'male' ? '남성' : '여성'} / {patient.birthDate}
                            </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-500">연락처</label>
                                <p className="text-gray-900">{patient.phone}</p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-500">첩약 처방일</label>
                                <p className="text-gray-900">{patient.herbalStartDate || '-'}</p>
                            </div>

                            {/* Auto Insurance Info */}
                            {patient.isAutoInsurance && (
                                <>
                                    <div className="col-span-2 border-t pt-4 mt-2">
                                        <div className="flex items-center space-x-2 mb-3">
                                            <Car className="w-5 h-5 text-blue-600" />
                                            <span className="font-medium text-gray-900">자보 (자동차보험) 환자</span>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-500">수상일</label>
                                        <p className="text-gray-900">
                                            {patient.injuryDate ? new Date(patient.injuryDate).toLocaleDateString('ko-KR') : '-'}
                                        </p>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-500">수상 후 경과 일수</label>
                                        <p className="text-gray-900">
                                            {patient.injuryDate ? `${autoInsuranceService.calculateDaysSinceInjury(patient.injuryDate)}일` : '-'}
                                        </p>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-500">첫 내원일</label>
                                        <p className="text-gray-900">
                                            {patient.firstVisitDate ? new Date(patient.firstVisitDate).toLocaleDateString('ko-KR') : '-'}
                                        </p>
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-sm font-medium text-gray-500 mb-2">현재 내원 기준</label>
                                        {(() => {
                                            const badge = autoInsuranceService.getPeriodBadge(patient.injuryDate);
                                            return (
                                                <div className="flex items-center space-x-3">
                                                    <span className={badge.className}>
                                                        {badge.text}
                                                    </span>
                                                    <span className="text-gray-700 font-medium">
                                                        {badge.description}
                                                    </span>
                                                </div>
                                            );
                                        })()}
                                    </div>

                                    {/* Herbal Medicine Warnings */}
                                    <div className="col-span-2 border-t pt-4 mt-2">
                                        <label className="block text-sm font-medium text-gray-700 mb-2">첩약 처방 상태</label>
                                        {(() => {
                                            const warnings = autoInsuranceService.getHerbalWarnings(patient);
                                            const remaining = autoInsuranceService.getRemainingPrescriptions(patient.herbalPrescriptions);

                                            if (warnings.length === 0) {
                                                return (
                                                    <div className="flex items-center space-x-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                                                        <span className="text-lg">🟢</span>
                                                        <span className="text-sm text-green-700 font-medium">
                                                            첩약 처방 가능 ({remaining}/3회 남음)
                                                        </span>
                                                    </div>
                                                );
                                            }

                                            return (
                                                <div className="space-y-2">
                                                    {warnings.map((warning, idx) => (
                                                        <div key={idx} className={`flex items-center space-x-2 p-3 rounded-lg border ${warning.type === 'error' ? 'bg-red-50 border-red-200' :
                                                                warning.type === 'warning' ? 'bg-yellow-50 border-yellow-200' :
                                                                    'bg-blue-50 border-blue-200'
                                                            }`}>
                                                            <span className="text-lg">{warning.icon}</span>
                                                            <span className={`text-sm font-medium ${warning.type === 'error' ? 'text-red-700' :
                                                                    warning.type === 'warning' ? 'text-yellow-700' :
                                                                        'text-blue-700'
                                                                }`}>
                                                                {warning.message}
                                                            </span>
                                                        </div>
                                                    ))}
                                                    <div className="text-xs text-gray-500 mt-2">
                                                        현재 첩약 처방: {3 - remaining}/3회 소진
                                                    </div>
                                                </div>
                                            );
                                        })()}
                                    </div>
                                </>
                            )}

                            <div className="col-span-2">
                                <label className="block text-sm font-medium text-gray-500">특이사항</label>
                                <p className="text-gray-900">{patient.memo || '-'}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Medical History */}
                <div className="bg-white rounded-xl shadow-sm p-6">
                    <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                        <FileText className="w-5 h-5 mr-2 text-blue-600" />
                        진료 기록
                    </h3>
                    <div className="space-y-4">
                        {patient.history.map((record, index) => (
                            <div key={index} className="border-l-4 border-blue-500 pl-4 py-1">
                                <p className="text-sm text-gray-500">{record.date}</p>
                                <p className="font-medium text-gray-900">{record.diagnosis}</p>
                                <p className="text-sm text-gray-600">{record.treatment}</p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Appointments */}
                <div className="bg-white rounded-xl shadow-sm p-6">
                    <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                        <Calendar className="w-5 h-5 mr-2 text-green-600" />
                        예약 내역
                    </h3>
                    <div className="space-y-3">
                        {patient.appointments.map((appt, index) => (
                            <div key={index} className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
                                <div>
                                    <p className="font-medium text-gray-900">{appt.date} {appt.time}</p>
                                    <p className="text-sm text-gray-500">{appt.type}</p>
                                </div>
                                <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">
                                    예정
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Modals */}
            <AddPatientModal
                isOpen={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                onSave={handleUpdatePatient}
                initialData={patient}
            />

            <PrescriptionModal
                isOpen={isPrescriptionModalOpen}
                onClose={() => setIsPrescriptionModalOpen(false)}
                preSelectedPatient={patient}
            />
        </div>
    );
};

export default PatientDetail;
