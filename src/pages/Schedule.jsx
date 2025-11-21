import React, { useState, useEffect } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { Plus } from 'lucide-react';
import Button from '../components/ui/Button';

const Schedule = () => {
    const [events, setEvents] = useState([]);

    useEffect(() => {
        // Load patients from localStorage
        const storedPatients = JSON.parse(localStorage.getItem('patients') || '[]');

        // Generate herbal reminder events
        const herbalEvents = storedPatients
            .filter(patient => patient.herbalStartDate)
            .map(patient => {
                const startDate = new Date(patient.herbalStartDate);
                const reminderDate = new Date(startDate);
                reminderDate.setDate(startDate.getDate() + 27);

                return {
                    id: `herbal-${patient.id}`,
                    title: `🌿 ${patient.name}님 첩약 재처방 상담`,
                    start: reminderDate.toISOString().split('T')[0],
                    allDay: true,
                    backgroundColor: '#f59e0b',
                    borderColor: '#f59e0b',
                    extendedProps: {
                        type: 'herbal_reminder',
                        patientId: patient.id
                    }
                };
            });

        // Load prescription follow-up events from localStorage
        const prescriptionEvents = JSON.parse(localStorage.getItem('schedule_events') || '[]');

        // Mock appointment events
        const mockAppointments = [
            {
                title: '김철수 - 진료',
                start: '2025-11-20T14:00:00',
                end: '2025-11-20T14:30:00',
                backgroundColor: '#3b82f6',
                extendedProps: { type: 'appointment' }
            },
            {
                title: '이영희 - 상담',
                start: '2025-11-21T10:00:00',
                end: '2025-11-21T11:00:00',
                backgroundColor: '#10b981',
                extendedProps: { type: 'consultation' }
            }
        ];

        // Combine all events
        setEvents([...herbalEvents, ...prescriptionEvents, ...mockAppointments]);
    }, []);

    const handleDateClick = (arg) => {
        const title = prompt('예약 환자명과 내용을 입력하세요:');
        if (title) {
            setEvents([
                ...events,
                {
                    title,
                    start: arg.dateStr,
                    allDay: arg.allDay,
                    backgroundColor: '#6366f1',
                    extendedProps: { type: 'manual' }
                }
            ]);
        }
    };

    const handleEventClick = (info) => {
        const { event } = info;
        if (event.extendedProps.type === 'herbal_reminder') {
            const patientId = event.extendedProps.patientId;
            if (confirm(`${event.title}\n\n환자 상세 페이지로 이동하시겠습니까?`)) {
                window.location.href = `/patients/${patientId}`;
            }
        }
    };

    return (
        <div className="space-y-6 h-full flex flex-col">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">예약 관리</h1>
                    <p className="text-gray-500">진료 및 상담 일정을 관리합니다.</p>
                </div>
                <Button className="w-auto flex items-center">
                    <Plus className="w-5 h-5 mr-2" />
                    예약 추가
                </Button>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm flex-1">
                <FullCalendar
                    plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                    initialView="dayGridMonth"
                    headerToolbar={{
                        left: 'prev,next today',
                        center: 'title',
                        right: 'dayGridMonth,timeGridWeek,timeGridDay'
                    }}
                    events={events}
                    dateClick={handleDateClick}
                    eventClick={handleEventClick}
                    height="100%"
                    editable={true}
                    selectable={true}
                    locale="ko"
                    eventTimeFormat={{
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: false
                    }}
                />
            </div>
        </div>
    );
};

export default Schedule;
