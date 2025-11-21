import React, { useState } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { User, Clock, CheckCircle, Activity, Home } from 'lucide-react';

const COLUMNS = {
    waiting: { id: 'waiting', title: '대기중', icon: Clock, color: 'bg-gray-100 text-gray-600' },
    consulting: { id: 'consulting', title: '상담중', icon: User, color: 'bg-blue-100 text-blue-600' },
    treating: { id: 'treating', title: '시술중', icon: Activity, color: 'bg-red-100 text-red-600' },
    payment: { id: 'payment', title: '수납대기', icon: CheckCircle, color: 'bg-yellow-100 text-yellow-600' },
    done: { id: 'done', title: '귀가', icon: Home, color: 'bg-green-100 text-green-600' },
};

const INITIAL_DATA = {
    waiting: [
        { id: 'p1', name: '김철수', time: '14:00', type: '초진' },
        { id: 'p2', name: '이영희', time: '14:15', type: '재진' },
    ],
    consulting: [
        { id: 'p3', name: '박민수', time: '13:50', type: '상담' },
    ],
    treating: [],
    payment: [],
    done: [],
};

const TreatmentStatus = () => {
    const [columns, setColumns] = useState(INITIAL_DATA);

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

    return (
        <div className="h-full flex flex-col">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900">진료 현황</h1>
                <p className="text-gray-500">실시간 환자 이동 현황을 관리합니다.</p>
            </div>

            <DragDropContext onDragEnd={onDragEnd}>
                <div className="flex-1 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 overflow-x-auto pb-4">
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
                                                        <div className="text-sm text-gray-600">
                                                            {patient.type}
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

export default TreatmentStatus;
