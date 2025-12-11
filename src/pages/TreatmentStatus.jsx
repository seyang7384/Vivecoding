import React, { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { User, Clock, CheckCircle, Activity, Calendar, AlertCircle, FileText, Loader2, X, Eye } from 'lucide-react';
import { appointmentService } from '../services/appointmentService';
import { patientService } from '../services/patientService';
import pythonVoiceService from '../services/pythonVoiceService';
import { voiceLogService } from '../services/voiceLogService';
import { visitService } from '../services/visitService';
import { conversationService } from '../services/conversationService';

const COLUMNS = {
    reservation: { id: 'reservation', title: '예약', icon: Calendar, color: 'bg-indigo-100 text-indigo-600' },
    waiting: { id: 'waiting', title: '대기', icon: Clock, color: 'bg-gray-100 text-gray-600' },
    treating: { id: 'treating', title: '진료', icon: Activity, color: 'bg-red-100 text-red-600' },
    payment_done: { id: 'payment_done', title: '수납 완료', icon: CheckCircle, color: 'bg-green-100 text-green-600' },
};

const TreatmentStatus = () => {
    const [columns, setColumns] = useState({
        reservation: [],
        waiting: [],
        treating: [],
        payment_done: []
    });
    const [loading, setLoading] = useState(true);
    const [generatingPlan, setGeneratingPlan] = useState(null); // ID of patient being generated
    const [selectedModel, setSelectedModel] = useState('openai'); // 'openai', 'gemini', 'claude'
    // Modal State for viewing treatment plan
    const [planModal, setPlanModal] = useState({ isOpen: false, plan: null, patientName: '', provider: '' });
    // Edit Modal State (NEW: for editing before save)
    const [editModal, setEditModal] = useState({
        isOpen: false,
        plan: '',
        transcript: '',
        patientId: null,
        patientName: '',
        provider: ''
    });

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                // 1. Get Today's Appointments
                const appointments = await appointmentService.getAppointments();
                const today = new Date().toISOString().split('T')[0];

                const todaysAppointments = appointments.filter(app => {
                    let appDate = '';
                    if (app.date) appDate = app.date;
                    else if (app.start) appDate = app.start.split('T')[0];
                    return appDate === today;
                });

                // 2. Process each appointment to check package status
                const processedAppointments = await Promise.all(todaysAppointments.map(async (app) => {
                    let needsRenewal = false;
                    let renewalPackageName = '';

                    if (app.patientId) {
                        try {
                            const patient = await patientService.getPatientById(app.patientId);
                            if (patient && patient.packages) {
                                // Check for packages with exactly 2 remaining sessions
                                const targetPkg = patient.packages.find(pkg => {
                                    const remaining = pkg.totalCounts - pkg.usedCounts;
                                    return remaining === 2;
                                });
                                if (targetPkg) {
                                    needsRenewal = true;
                                    renewalPackageName = targetPkg.name;
                                }
                            }
                        } catch (err) {
                            console.error(`Failed to fetch patient ${app.patientId}`, err);
                        }
                    }

                    return {
                        id: app.id,
                        patientId: app.patientId, // Ensure patientId is passed
                        name: app.patientName || app.title,
                        time: app.start ? app.start.split('T')[1].substring(0, 5) : (app.time || '00:00'),
                        type: app.type || '진료',
                        needsRenewal,
                        renewalPackageName
                    };
                }));

                // Sort by time
                processedAppointments.sort((a, b) => a.time.localeCompare(b.time));

                setColumns(prev => ({
                    ...prev,
                    reservation: processedAppointments,
                    // Keep other columns empty for now or load from a persistent status service if exists
                    // For this demo, we assume fresh start or only reservation is auto-filled
                }));

            } catch (error) {
                console.error("Failed to load treatment status data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();

        // Subscribe to Python Service for Treatment Plan
        pythonVoiceService.connect({
            onTreatmentPlan: async (plan, provider) => {
                console.log("✅ Treatment Plan Received:", plan);
                // We need to know WHICH patient this is for. 
                // Since we don't pass ID to python, we rely on local state 'generatingPlan'
                // This is a bit risky if multiple requests are flight, but for now we assume one at a time.

                // In a real app, we should pass a request ID to Python and get it back.
                // For now, we will use a ref or just the state if we block UI.
            }
        });

        // We need a way to handle the callback with the current state.
        // Since the callback is defined on connect, it might not see the latest state if not careful.
        // Better approach: Use a ref for the current generating patient ID.

    }, []);

    // Ref for the patient currently being processed
    const generatingPatientRef = React.useRef(null);

    useEffect(() => {
        // Re-connect with updated callback to access the ref
        pythonVoiceService.connect({
            onConnect: () => console.log("Connected for Treatment Plan"),
            onTreatmentPlan: async (plan, provider) => {
                const patientId = generatingPatientRef.current;
                if (!patientId) return;

                console.log(`Plan received for patient ${patientId} using ${provider}`);

                // Find the patient object to get real patientId and name
                let targetPatient = null;
                Object.values(columns).forEach(col => {
                    const found = col.find(p => p.id === patientId);
                    if (found) targetPatient = found;
                });

                // Get transcript for later save
                const logs = voiceLogService.getLocalLogs();
                const recentLogs = logs.slice(-50).map(l => `${l.roleName}: ${l.text}`).join('\n');

                // Open Edit Modal instead of auto-saving
                setEditModal({
                    isOpen: true,
                    plan: plan,
                    transcript: recentLogs,
                    patientId: targetPatient?.patientId || null,
                    patientName: targetPatient?.name || '환자',
                    provider: provider
                });

                setGeneratingPlan(null);
                generatingPatientRef.current = null;
            },
            onError: (err) => {
                console.error(err);
                setGeneratingPlan(null);
                generatingPatientRef.current = null;
                alert("오류: " + err.message);
            }
        });
    }, [columns]); // Re-bind when columns change


    const handleCompleteTreatment = async (patientId) => {
        if (generatingPlan) return; // Prevent double click

        setGeneratingPlan(patientId);
        generatingPatientRef.current = patientId;

        // Get transcript
        const logs = voiceLogService.getLocalLogs();
        const recentLogs = logs.slice(-50).map(l => `${l.roleName}: ${l.text}`).join('\n');

        if (!recentLogs) {
            alert("녹음된 진료 기록이 없습니다.");
            setGeneratingPlan(null);
            generatingPatientRef.current = null;
            return;
        }

        // Request Generation
        pythonVoiceService.generateTreatmentPlan(recentLogs, selectedModel);
    };

    const onDragEnd = (result) => {
        const { source, destination } = result;

        // Dropped outside the list
        if (!destination) return;

        // Dropped in the same place
        if (
            source.droppableId === destination.droppableId &&
            source.index === destination.index
        ) {
            return;
        }

        // Move logic
        const sourceCol = columns[source.droppableId];
        const destCol = columns[destination.droppableId];
        const sourceItems = [...sourceCol];
        const destItems = source.droppableId === destination.droppableId ? sourceItems : [...destCol];

        const [removed] = sourceItems.splice(source.index, 1);
        destItems.splice(destination.index, 0, removed);

        setColumns({
            ...columns,
            [source.droppableId]: sourceItems,
            [destination.droppableId]: source.droppableId === destination.droppableId ? sourceItems : destItems,
        });
    };

    const handleViewPlan = async (patient) => {
        if (!patient.patientId) {
            alert('환자 정보가 없습니다.');
            return;
        }
        const today = new Date().toISOString().split('T')[0];
        const visit = await visitService.getVisit(patient.patientId, today);
        if (visit && visit.treatmentPlan) {
            setPlanModal({
                isOpen: true,
                plan: visit.treatmentPlan,
                patientName: patient.name,
                provider: visit.planProvider || 'unknown'
            });
        } else {
            alert('생성된 치료 계획서가 없습니다.');
        }
    };

    // Save edited treatment plan
    const handleSavePlan = async () => {
        if (!editModal.patientId) {
            alert('환자 정보를 찾을 수 없습니다.');
            return;
        }

        try {
            const today = new Date().toISOString().split('T')[0];

            // 1. Save to visits collection
            await visitService.saveVisit(editModal.patientId, today, {
                transcript: editModal.transcript,
                treatmentPlan: editModal.plan,
                planProvider: editModal.provider
            });

            // 2. Create draft message in conversations collection (for desk staff)
            await conversationService.createMessage({
                patientId: editModal.patientId,
                patientName: editModal.patientName,
                content: editModal.plan,          // 치료 계획서 내용
                type: 'kakao',                    // 카카오톡 기본
                direction: 'outbound',            // 발신
                status: 'draft'                   // 작성 중 (발송 대기)
            });

            alert("치료 계획서가 저장되고 메신저 발송 대기 목록에 추가되었습니다!");
            setEditModal({ isOpen: false, plan: '', transcript: '', patientId: null, patientName: '', provider: '' });
        } catch (error) {
            console.error("Failed to save treatment plan:", error);
            alert("저장 중 오류가 발생했습니다.");
        }
    };


    if (loading) return <div className="p-8 text-center">Loading...</div>;

    return (
        <div className="h-full flex flex-col">
            <div className="mb-6 flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">진료 현황</h1>
                    <p className="text-gray-500">실시간 환자 이동 현황 및 패키지 연장 대상자 확인</p>
                </div>
                <div className="flex items-center space-x-2 bg-white p-2 rounded-lg shadow-sm border border-gray-200">
                    <span className="text-sm font-bold text-gray-600">AI 모델:</span>
                    <select
                        value={selectedModel}
                        onChange={(e) => setSelectedModel(e.target.value)}
                        className="text-sm border-none focus:ring-0 text-gray-700 font-medium bg-transparent cursor-pointer"
                    >
                        <option value="openai">GPT-4o (OpenAI)</option>
                        <option value="gemini">Gemini 1.5 (Google)</option>
                        <option value="claude">Claude 3.5 (Anthropic)</option>
                    </select>
                </div>
            </div>

            <DragDropContext onDragEnd={onDragEnd}>
                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 overflow-x-auto pb-4">
                    {Object.values(COLUMNS).map((col) => (
                        <div key={col.id} className="flex flex-col h-full min-w-[250px] bg-gray-50 rounded-xl p-4">
                            <div className={`flex items-center justify-between mb-4 p-2 rounded-lg ${col.color}`}>
                                <div className="flex items-center font-bold">
                                    <col.icon className="w-5 h-5 mr-2" />
                                    {col.title}
                                </div>
                                <span className="bg-white bg-opacity-50 px-2 py-0.5 rounded-full text-sm">
                                    {columns[col.id].length}
                                </span>
                            </div>

                            <Droppable droppableId={col.id}>
                                {(provided, snapshot) => (
                                    <div
                                        {...provided.droppableProps}
                                        ref={provided.innerRef}
                                        className={`flex-1 space-y-3 transition-colors ${snapshot.isDraggingOver ? 'bg-gray-100 rounded-lg' : ''
                                            }`}
                                    >
                                        {columns[col.id].map((patient, index) => (
                                            <Draggable key={patient.id} draggableId={patient.id} index={index}>
                                                {(provided, snapshot) => (
                                                    <div
                                                        ref={provided.innerRef}
                                                        {...provided.draggableProps}
                                                        {...provided.dragHandleProps}
                                                        className={`bg-white p-4 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow ${snapshot.isDragging ? 'shadow-lg ring-2 ring-blue-500 ring-opacity-50' : ''
                                                            }`}
                                                    >
                                                        <div className="flex justify-between items-start mb-2">
                                                            <span className="font-bold text-gray-900">{patient.name}</span>
                                                            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                                                                {patient.time}
                                                            </span>
                                                        </div>
                                                        <div className="text-sm text-gray-600 mb-2">
                                                            {patient.type}
                                                        </div>

                                                        {/* Renewal Badge */}
                                                        {patient.needsRenewal && (
                                                            <div className="mt-2 flex items-center bg-red-50 text-red-700 px-2 py-1 rounded text-xs font-bold border border-red-100 animate-pulse">
                                                                <AlertCircle className="w-3 h-3 mr-1" />
                                                                연장 상담 필요 ({patient.renewalPackageName})
                                                            </div>
                                                        )}

                                                        {/* Treatment Complete Button (Only in Treating Column) */}
                                                        {col.id === 'treating' && (
                                                            <button
                                                                onClick={() => handleCompleteTreatment(patient.id)}
                                                                disabled={generatingPlan === patient.id}
                                                                className={`mt-3 w-full flex items-center justify-center py-2 rounded-lg text-sm font-bold transition-all ${generatingPlan === patient.id
                                                                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                                                    : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                                                                    }`}
                                                            >
                                                                {generatingPlan === patient.id ? (
                                                                    <>
                                                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                                        생성 중...
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <FileText className="w-4 h-4 mr-2" />
                                                                        진료 완료 & 계획서 생성
                                                                    </>
                                                                )}
                                                            </button>
                                                        )}

                                                        {/* View Plan Button (Only in Payment Done Column) */}
                                                        {col.id === 'payment_done' && (
                                                            <button
                                                                onClick={() => handleViewPlan(patient)}
                                                                className="mt-3 w-full flex items-center justify-center py-2 rounded-lg text-sm font-bold bg-purple-50 text-purple-600 hover:bg-purple-100 transition-all"
                                                            >
                                                                <Eye className="w-4 h-4 mr-2" />
                                                                치료 계획서 보기
                                                            </button>
                                                        )}
                                                    </div>
                                                )}
                                            </Draggable>
                                        ))}
                                        {provided.placeholder}
                                    </div>
                                )}
                            </Droppable>
                        </div>
                    ))}
                </div>
            </DragDropContext>

            {/* Treatment Plan Modal */}
            {planModal.isOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col">
                        <div className="flex justify-between items-center p-4 border-b">
                            <h2 className="text-lg font-bold text-gray-900 flex items-center">
                                <FileText className="w-5 h-5 mr-2 text-purple-600" />
                                {planModal.patientName}님 치료 계획서
                                <span className="ml-2 text-xs font-normal text-gray-400">
                                    ({planModal.provider === 'gemini' ? 'Gemini' : planModal.provider === 'claude' ? 'Claude' : 'GPT-4o'})
                                </span>
                            </h2>
                            <button
                                onClick={() => setPlanModal({ isOpen: false, plan: null, patientName: '', provider: '' })}
                                className="p-2 hover:bg-gray-100 rounded-full"
                            >
                                <X className="w-5 h-5 text-gray-500" />
                            </button>
                        </div>
                        <div className="p-6 overflow-y-auto flex-1">
                            <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap bg-gray-50 p-4 rounded-lg">
                                {planModal.plan}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Modal (NEW: for editing before save) */}
            {editModal.isOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] flex flex-col">
                        <div className="flex justify-between items-center p-4 border-b bg-blue-50">
                            <h2 className="text-lg font-bold text-gray-900 flex items-center">
                                <FileText className="w-5 h-5 mr-2 text-blue-600" />
                                {editModal.patientName}님 치료 계획서 검토
                                <span className="ml-2 text-xs font-normal text-gray-500">
                                    ({editModal.provider === 'gemini' ? 'Gemini' : editModal.provider === 'claude' ? 'Claude' : 'GPT-4o'} 생성)
                                </span>
                            </h2>
                            <button
                                onClick={() => setEditModal({ isOpen: false, plan: '', transcript: '', patientId: null, patientName: '', provider: '' })}
                                className="p-2 hover:bg-gray-100 rounded-full"
                            >
                                <X className="w-5 h-5 text-gray-500" />
                            </button>
                        </div>
                        <div className="p-6 overflow-y-auto flex-1">
                            <p className="text-sm text-gray-500 mb-3">
                                AI가 생성한 내용을 검토 및 수정한 후 저장하세요.
                            </p>
                            <textarea
                                value={editModal.plan}
                                onChange={(e) => setEditModal(prev => ({ ...prev, plan: e.target.value }))}
                                className="w-full h-96 p-4 border border-gray-300 rounded-lg text-sm text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                                placeholder="치료 계획서 내용..."
                            />
                        </div>
                        <div className="flex justify-end space-x-3 p-4 border-t bg-gray-50">
                            <button
                                onClick={() => setEditModal({ isOpen: false, plan: '', transcript: '', patientId: null, patientName: '', provider: '' })}
                                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                            >
                                취소
                            </button>
                            <button
                                onClick={handleSavePlan}
                                className="px-4 py-2 text-sm font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700"
                            >
                                저장하기
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TreatmentStatus;
