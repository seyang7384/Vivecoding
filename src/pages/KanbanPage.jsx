import React, { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { patientService } from '../services/patientService';
import { User } from 'lucide-react';

const COLUMNS = [
    { id: '대기중', title: '대기중', color: 'bg-gray-100' },
    { id: '상담중', title: '상담중', color: 'bg-blue-50' },
    { id: '시술중', title: '시술중', color: 'bg-red-50' },
    { id: '수납대기', title: '수납대기', color: 'bg-yellow-50' },
    { id: '귀가', title: '귀가', color: 'bg-green-50' }
];

const KanbanPage = () => {
    const [patients, setPatients] = useState([]);
    const [columns, setColumns] = useState({});

    useEffect(() => {
        loadPatients();
    }, []);

    const loadPatients = async () => {
        const data = await patientService.getPatients();
        setPatients(data);
        distributePatients(data);
    };

    const distributePatients = (patientList) => {
        const newColumns = {};
        COLUMNS.forEach(col => {
            newColumns[col.id] = patientList.filter(p => (p.status || '대기중') === col.id);
        });
        setColumns(newColumns);
    };

    const onDragEnd = async (result) => {
        const { source, destination, draggableId } = result;

        if (!destination) return;
        if (source.droppableId === destination.droppableId) return;

        // Optimistic UI update
        const sourceColumn = columns[source.droppableId];
        const destColumn = columns[destination.droppableId];
        const movedPatient = sourceColumn.find(p => p.id === draggableId);

        const newSourceColumn = sourceColumn.filter(p => p.id !== draggableId);
        const newDestColumn = [...destColumn, { ...movedPatient, status: destination.droppableId }];

        setColumns({
            ...columns,
            [source.droppableId]: newSourceColumn,
            [destination.droppableId]: newDestColumn
        });

        // Update backend
        await patientService.updatePatientStatus(draggableId, destination.droppableId);
    };

    return (
        <div className="h-full flex flex-col">
            <h1 className="text-2xl font-bold mb-6">진료 현황 (Kanban)</h1>

            <DragDropContext onDragEnd={onDragEnd}>
                <div className="flex gap-4 h-full overflow-x-auto pb-4">
                    {COLUMNS.map(col => (
                        <div key={col.id} className={`min-w-[280px] w-1/5 rounded-lg p-4 ${col.color} flex flex-col`}>
                            <h2 className="font-semibold mb-4 flex justify-between items-center">
                                {col.title}
                                <span className="bg-white px-2 py-1 rounded-full text-sm shadow-sm">
                                    {columns[col.id]?.length || 0}
                                </span>
                            </h2>

                            <Droppable droppableId={col.id}>
                                {(provided) => (
                                    <div
                                        {...provided.droppableProps}
                                        ref={provided.innerRef}
                                        className="flex-1 flex flex-col gap-3 overflow-y-auto min-h-[100px]"
                                    >
                                        {columns[col.id]?.map((patient, index) => (
                                            <Draggable key={patient.id} draggableId={patient.id} index={index}>
                                                {(provided) => (
                                                    <div
                                                        ref={provided.innerRef}
                                                        {...provided.draggableProps}
                                                        {...provided.dragHandleProps}
                                                        className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing"
                                                    >
                                                        <div className="flex items-center gap-2 mb-2">
                                                            <User size={16} className="text-gray-500" />
                                                            <span className="font-medium">{patient.name}</span>
                                                            <span className="text-xs text-gray-400 ml-auto">
                                                                {patient.gender}/{new Date().getFullYear() - new Date(patient.dob).getFullYear()}
                                                            </span>
                                                        </div>
                                                        <div className="text-sm text-gray-600 truncate">
                                                            {patient.notes || "특이사항 없음"}
                                                        </div>
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

export default KanbanPage;
