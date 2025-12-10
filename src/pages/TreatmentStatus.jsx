import React, { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { User, Clock, CheckCircle, Activity, Calendar, AlertCircle } from 'lucide-react';
import { appointmentService } from '../services/appointmentService';
import { patientService } from '../services/patientService';

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
    }, []);

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

    if (loading) return <div className="p-8 text-center">Loading...</div>;

    return (
        <div className="h-full flex flex-col">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900">진료 현황</h1>
                <p className="text-gray-500">실시간 환자 이동 현황 및 패키지 연장 대상자 확인</p>
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
        </div>
    );
};

export default TreatmentStatus;
