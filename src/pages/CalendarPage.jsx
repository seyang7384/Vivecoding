import React, { useState, useEffect } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { appointmentService } from '../services/appointmentService';
import AppointmentModal from '../components/AppointmentModal';

const CalendarPage = () => {
    const [events, setEvents] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedDate, setSelectedDate] = useState(null);

    useEffect(() => {
        fetchAppointments();
    }, []);

    const fetchAppointments = async () => {
        const data = await appointmentService.getAppointments();
        const formattedEvents = data.map(apt => ({
            id: apt.id,
            title: `${apt.patientName} - ${apt.type}`,
            start: apt.start && apt.start.toDate ? apt.start.toDate() : apt.start,
            end: apt.end && apt.end.toDate ? apt.end.toDate() : apt.end,
            backgroundColor: getEventColor(apt.type),
            borderColor: getEventColor(apt.type)
        }));
        setEvents(formattedEvents);
    };

    const getEventColor = (type) => {
        switch (type) {
            case '수술': return '#EF4444'; // Red
            case '검진': return '#10B981'; // Green
            case '상담': return '#F59E0B'; // Yellow
            default: return '#3B82F6'; // Blue
        }
    };

    const handleDateClick = (arg) => {
        setSelectedDate(arg.date);
        setIsModalOpen(true);
    };

    const handleAddAppointment = async (aptData) => {
        try {
            await appointmentService.addAppointment(aptData);
            await fetchAppointments();
            setIsModalOpen(false);
        } catch (error) {
            alert("예약 등록 중 오류가 발생했습니다.");
        }
    };

    return (
        <div className="h-[calc(100vh-140px)]">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-gray-800">일정 관리</h2>
                <button
                    onClick={() => {
                        const now = new Date();
                        // Strip time to avoid timezone issues when passing to modal
                        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                        setSelectedDate(today);
                        setIsModalOpen(true);
                    }}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                    예약 추가
                </button>
            </div>

            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 h-full">
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
                    height="100%"
                    locale="ko"
                />
            </div>

            <AppointmentModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSubmit={handleAddAppointment}
                initialDate={selectedDate}
            />
        </div>
    );
};

export default CalendarPage;
