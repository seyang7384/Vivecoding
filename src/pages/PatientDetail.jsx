import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, FileText, User, Car, Pill, Activity, Trash2 } from 'lucide-react';
import Button from '../components/ui/Button';
import AddPatientModal from '../components/patients/AddPatientModal';
import PrescriptionModal from '../components/prescriptions/PrescriptionModal';
import PackageTimeline from '../components/patients/PackageTimeline';
import PackageSelectionModal from '../components/patients/PackageSelectionModal';
import { autoInsuranceService } from '../services/autoInsuranceService';
import { patientService } from '../services/patientService';
import { visitService } from '../services/visitService';
import { productService } from '../services/productService';

import PackageRenewalModal from '../components/patients/PackageRenewalModal'; // Added Import

const PatientDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [patient, setPatient] = useState(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isPrescriptionModalOpen, setIsPrescriptionModalOpen] = useState(false);
    const [isPackageModalOpen, setIsPackageModalOpen] = useState(false);

    // Renewal Modal State
    const [isRenewalModalOpen, setIsRenewalModalOpen] = useState(false);
    const [renewalPackageInfo, setRenewalPackageInfo] = useState(null);

    const [treatments, setTreatments] = useState([]);
    const [packages, setPackages] = useState([]); // Available package definitions
    const [visitItems, setVisitItems] = useState([]);
    const [visitTotal, setVisitTotal] = useState(0);
    const [selectedTreatmentId, setSelectedTreatmentId] = useState('');

    useEffect(() => {
        const fetchPatient = async () => {
            try {
                const foundPatient = await patientService.getPatientById(id);
                if (foundPatient) {
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
                }
            } catch (error) {
                console.error('Patient not found:', error);
            }
        };
        fetchPatient();
    }, [id]);

    useEffect(() => {
        const loadData = async () => {
            // Load treatments and packages
            const treatmentData = await productService.getTreatments();
            setTreatments(treatmentData.sort((a, b) => (a.order || 999) - (b.order || 999)));

            const packageData = await productService.getPackages();
            setPackages(packageData);

            // Load today's visit
            if (id) {
                const today = new Date().toISOString().split('T')[0];
                const visit = await visitService.getVisit(id, today);
                if (visit) {
                    setVisitItems(visit.items || []);
                    setVisitTotal(visit.totalCost || 0);
                }
            }
        };
        loadData();
    }, [id]);

    const handleUpdatePatient = async (updatedData) => {
        try {
            await patientService.updatePatient(id, updatedData);
            setPatient(prev => ({
                ...prev,
                ...updatedData
            }));
            setIsEditModalOpen(false);
        } catch (error) {
            console.error("Failed to update patient:", error);
            alert("환자 정보 수정 실패: " + error.message);
        }
    };

    const handleAddTreatment = async () => {
        if (!selectedTreatmentId) return;
        const treatment = treatments.find(t => t.id === selectedTreatmentId);
        if (!treatment) return;

        const today = new Date().toISOString().split('T')[0];
        try {
            const updatedItems = await visitService.addItem(id, today, {
                type: 'treatment',
                name: treatment.name,
                price: treatment.price,
                category: treatment.category
            });
            setVisitItems(updatedItems);
            setVisitTotal(updatedItems.reduce((sum, i) => sum + (Number(i.price) || 0), 0));
            setSelectedTreatmentId('');
        } catch (error) {
            console.error("Failed to add treatment:", error);
            alert("치료 추가 실패");
        }
    };

    const handleRemoveItem = async (itemId) => {
        if (!confirm('삭제하시겠습니까?')) return;
        const today = new Date().toISOString().split('T')[0];
        try {
            // Check if the item is a package use record
            const itemToRemove = visitItems.find(i => i.id === itemId);

            if (itemToRemove && itemToRemove.type === 'package_use' && itemToRemove.packageId) {
                if (confirm('이 항목은 패키지 사용 기록입니다. 패키지 진행률도 되돌리시겠습니까?')) {
                    const revertedPkg = await patientService.revertPackageSession(id, itemToRemove.packageId);
                    setPatient(prev => ({
                        ...prev,
                        packages: prev.packages.map(p => p.id === itemToRemove.packageId ? revertedPkg : p)
                    }));
                }
            }

            const updatedItems = await visitService.removeItem(id, today, itemId);
            setVisitItems(updatedItems);
            setVisitTotal(updatedItems.reduce((sum, i) => sum + (Number(i.price) || 0), 0));
        } catch (error) {
            console.error("Failed to remove item:", error);
            alert("삭제 실패");
        }
    };

    // --- Package Handlers ---
    const handleStartPackage = () => {
        setIsPackageModalOpen(true);
    };

    const handlePackageSelect = async (selectedPkg) => {
        try {
            // Calculate total counts based on items
            let totalCounts = 0;

            if (selectedPkg.category === '첩약') {
                // Herbal logic: 1 month = 2 units (15 days each), 0.5 month = 1 unit
                totalCounts = selectedPkg.items.reduce((sum, item) => {
                    if (item.name.includes('1개월')) return sum + (item.count * 2);
                    if (item.name.includes('0.5개월')) return sum + (item.count * 1);
                    return sum + (item.count || 1);
                }, 0);
            } else {
                // Standard logic: Sum of counts
                totalCounts = selectedPkg.items.reduce((sum, item) => sum + (item.count || 1), 0);
            }

            const newPkg = await patientService.addPatientPackage(id, {
                name: selectedPkg.name,
                type: selectedPkg.category === '첩약' ? 'herbal' : 'lifting',
                totalCounts: totalCounts,
                usedCounts: 0,
                items: selectedPkg.items
            });

            setPatient(prev => ({
                ...prev,
                packages: [...(prev.packages || []), newPkg]
            }));

            // Auto-charge: Add package price to today's visit
            if (confirm(`패키지 비용 (${Number(selectedPkg.price).toLocaleString()}원)을 금일 수납 내역에 추가하시겠습니까?`)) {
                const today = new Date().toISOString().split('T')[0];
                const updatedItems = await visitService.addItem(id, today, {
                    type: 'package_start',
                    name: selectedPkg.name,
                    price: selectedPkg.price,
                    category: '패키지결제',
                    packageId: newPkg.id
                });
                setVisitItems(updatedItems);
                setVisitTotal(updatedItems.reduce((sum, i) => sum + (Number(i.price) || 0), 0));
            }

        } catch (error) {
            console.error("Failed to start package:", error);
            alert("패키지 시작 실패");
        }
    };

    const handleDeletePackage = async (pkgId) => {
        if (!confirm("정말 이 패키지를 삭제하시겠습니까? 삭제 후에는 복구할 수 없습니다.")) return;
        try {
            await patientService.deletePatientPackage(id, pkgId);
            setPatient(prev => ({
                ...prev,
                packages: prev.packages.filter(p => p.id !== pkgId)
            }));
        } catch (error) {
            console.error("Failed to delete package:", error);
            alert("삭제 실패");
        }
    };

    const handleRecordSession = async (pkg) => {
        if (!confirm(`${pkg.name}의 1회 사용을 기록하시겠습니까?`)) return;

        try {
            // Determine next step name
            let nextStep = '치료';
            if (pkg.type === 'herbal') {
                // For herbal, just show "Herbal Dispensing" or similar
                nextStep = '첩약 발송';
            } else {
                nextStep = pkg.items[pkg.usedCounts % pkg.items.length].name;
            }

            const today = new Date().toISOString().split('T')[0];

            const updatedPkg = await patientService.updatePatientPackage(id, pkg.id, {
                usedCounts: pkg.usedCounts + 1,
                history: [
                    ...(pkg.history || []),
                    {
                        date: today,
                        treatment: nextStep,
                        note: `${pkg.usedCounts + 1}회차 완료`
                    }
                ],
                status: (pkg.usedCounts + 1) >= pkg.totalCounts ? 'completed' : 'active'
            });

            setPatient(prev => ({
                ...prev,
                packages: prev.packages.map(p => p.id === pkg.id ? updatedPkg : p)
            }));

            // Optionally add to today's visit
            if (confirm("금일 치료 내역에도 추가하시겠습니까?")) {
                await visitService.addItem(id, today, {
                    type: 'package_use',
                    name: `${pkg.name} (${pkg.usedCounts + 1}회차)`,
                    price: 0, // Package use usually has 0 price on the day of use if prepaid
                    category: '패키지사용',
                    packageId: pkg.id // Link to package for revert logic
                });
                // Refresh visit items
                const visit = await visitService.getVisit(id, today);
                if (visit) {
                    setVisitItems(visit.items || []);
                    setVisitTotal(visit.totalCost || 0);
                }
            }

            // --- Check for Renewal Alert ---
            const remaining = pkg.totalCounts - (pkg.usedCounts + 1);
            if (remaining === 1) {
                setRenewalPackageInfo(pkg);
                setIsRenewalModalOpen(true);
            }

        } catch (error) {
            console.error("Failed to record session:", error);
            alert("기록 실패");
        }
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

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column: Patient Info & Visit Management */}
                <div className="lg:col-span-2 space-y-6">
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

                    {/* Package Timeline Section */}
                    <PackageTimeline
                        packages={patient.packages || []}
                        onRecordSession={handleRecordSession}
                        onStartPackage={handleStartPackage}
                        onDeletePackage={handleDeletePackage}
                    />

                    {/* Today's Visit Section */}
                    <div className="bg-white rounded-xl shadow-sm p-6 border-2 border-blue-100">
                        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                            <Activity className="w-5 h-5 mr-2 text-blue-600" />
                            금일 치료 내역 ({new Date().toLocaleDateString()})
                        </h3>

                        <div className="flex space-x-2 mb-4">
                            <select
                                className="flex-1 border border-gray-300 rounded-lg px-3 py-2"
                                value={selectedTreatmentId}
                                onChange={(e) => setSelectedTreatmentId(e.target.value)}
                            >
                                <option value="">치료 선택...</option>
                                {treatments.map(t => (
                                    <option key={t.id} value={t.id}>
                                        {t.name} ({Number(t.price).toLocaleString()}원)
                                    </option>
                                ))}
                            </select>
                            <Button onClick={handleAddTreatment} disabled={!selectedTreatmentId}>
                                추가
                            </Button>
                        </div>

                        <div className="space-y-2 mb-4">
                            {visitItems.length === 0 ? (
                                <p className="text-gray-500 text-center py-4">등록된 치료 내역이 없습니다.</p>
                            ) : (
                                visitItems.map((item, idx) => (
                                    <div key={item.id || idx} className="flex justify-between items-center bg-gray-50 p-3 rounded-lg">
                                        <div>
                                            <span className="font-medium text-gray-900">{item.name}</span>
                                            <span className="text-xs text-gray-500 ml-2">
                                                {item.type === 'prescription' ? '첩약' : item.category}
                                            </span>
                                        </div>
                                        <div className="flex items-center space-x-3">
                                            <span className="font-bold text-gray-900">
                                                {Number(item.price).toLocaleString()}원
                                            </span>
                                            <button
                                                onClick={() => handleRemoveItem(item.id)}
                                                className="text-gray-400 hover:text-red-500"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="border-t pt-4 flex justify-between items-center">
                            <span className="font-bold text-gray-700">총 진료비</span>
                            <span className="text-xl font-bold text-blue-600">
                                {visitTotal.toLocaleString()}원
                            </span>
                        </div>
                    </div>
                </div>

                {/* Right Column: History & Appointments */}
                <div className="space-y-6">
                    {/* Medical History */}
                    <div className="bg-white rounded-xl shadow-sm p-6">
                        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                            <FileText className="w-5 h-5 mr-2 text-blue-600" />
                            과거 진료 기록
                        </h3>
                        <div className="space-y-4 max-h-60 overflow-y-auto">
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
                onPrescriptionComplete={() => {
                    // Refresh visit data
                    const today = new Date().toISOString().split('T')[0];
                    visitService.getVisit(id, today).then(visit => {
                        if (visit) {
                            setVisitItems(visit.items || []);
                            setVisitTotal(visit.totalCost || 0);
                        }
                    });
                }}
            />

            <PackageSelectionModal
                isOpen={isPackageModalOpen}
                onClose={() => setIsPackageModalOpen(false)}
                onSelect={handlePackageSelect}
                packages={packages}
            />

            {/* Package Renewal Modal */}
            <PackageRenewalModal
                isOpen={isRenewalModalOpen}
                onClose={() => setIsRenewalModalOpen(false)}
                packageInfo={renewalPackageInfo}
                onConfirm={() => {
                    alert("상담 기록이 저장되었습니다. (데모)");
                    setIsRenewalModalOpen(false);
                }}
            />
        </div>
    );
};

export default PatientDetail;
