import React, { useState, useEffect } from 'react';
import { Search, Plus, User, MoreVertical, Car } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import AddPatientModal from '../components/patients/AddPatientModal';

import { patientService } from '../services/patientService';

// Mock data removed - using Firestore

const Patients = () => {
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [patients, setPatients] = useState([]);

    // Load patients from Firestore on mount
    useEffect(() => {
        const loadPatients = async () => {
            try {
                const data = await patientService.getPatients();
                setPatients(data);
            } catch (error) {
                console.error("환자 로딩 실패:", error);
            }
        };
        loadPatients();
    }, []);

    const handleAddPatient = async (newPatient) => {
        try {
            await patientService.addPatient(newPatient);
            // 저장 후 목록 다시 로딩
            const data = await patientService.getPatients();
            setPatients(data);
            setIsModalOpen(false);
        } catch (error) {
            alert("저장 실패: " + error.message);
        }
    };

    const filteredPatients = patients.filter(patient =>
        patient.name.includes(searchTerm) ||
        patient.phone.includes(searchTerm)
    );

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h1 className="text-2xl font-bold text-gray-900">환자 관리</h1>
                <Button onClick={() => setIsModalOpen(true)} className="w-auto">
                    <Plus className="w-4 h-4 mr-2" />
                    신규 환자 등록
                </Button>
            </div>

            {/* Search Bar */}
            <div className="bg-white p-4 rounded-xl shadow-sm">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                        type="text"
                        placeholder="이름 또는 전화번호로 검색..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
            </div>

            {/* Patient List */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">환자명</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">생년월일/성별</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">연락처</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">최근 내원일</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">메모</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">관리</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {filteredPatients.length > 0 ? (
                                filteredPatients.map((patient) => (
                                    <tr
                                        key={patient.id}
                                        className="hover:bg-gray-50 cursor-pointer transition-colors"
                                        onClick={() => navigate(`/patients/${patient.id}`)}
                                    >
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center">
                                                <div className="flex-shrink-0 h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
                                                    <User className="h-5 w-5 text-blue-600" />
                                                </div>
                                                <div className="ml-4">
                                                    <div className="flex items-center space-x-2">
                                                        <div className="text-sm font-medium text-gray-900">{patient.name}</div>
                                                        {patient.isAutoInsurance && (
                                                            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded border border-blue-200 font-medium">
                                                                자보
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm text-gray-900">{patient.birthDate}</div>
                                            <div className="text-xs text-gray-500">
                                                {patient.gender === 'male' ? '남성' : '여성'}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm text-gray-900">{patient.phone}</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm text-gray-900">{patient.lastVisit}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-sm text-gray-500 truncate max-w-xs">
                                                {patient.memo || '-'}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <button className="text-gray-400 hover:text-gray-600">
                                                <MoreVertical className="w-5 h-5" />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="6" className="px-6 py-10 text-center text-gray-500">
                                        검색 결과가 없습니다.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <AddPatientModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={handleAddPatient}
            />
        </div>
    );
};

export default Patients;
