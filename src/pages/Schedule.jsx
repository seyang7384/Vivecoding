import React, { useState, useEffect, useMemo } from 'react';
import { Plus, ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import Button from '../components/ui/Button';
import ReservationModal from '../components/ReservationModal';
import { appointmentService } from '../services/appointmentService';
import { patientService } from '../services/patientService';

const Schedule = () => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [viewType, setViewType] = useState('daily'); // 'daily', 'weekly', 'monthly'
    const [allEvents, setAllEvents] = useState([]); // Store ALL events
    const [dailyEvents, setDailyEvents] = useState([]); // Store events for the current day (Daily View)
    const calendarRef = React.useRef(null); // Ref for FullCalendar API
    const [draggedEvent, setDraggedEvent] = useState(null);
    const [patients, setPatients] = useState([]);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedSlot, setSelectedSlot] = useState({ date: '', time: '' });

    const TIME_SLOTS = useMemo(() => {
        const slots = [];
        for (let h = 9; h < 21; h++) { // 09:00 ~ 20:xx
            if (h === 13) continue; // Skip 13:00 ~ 13:59 (Lunch)

            slots.push(`${h.toString().padStart(2, '0')}:00`);
            // Last slot is 20:00 (ends 20:30)
            if (h !== 20) {
                slots.push(`${h.toString().padStart(2, '0')}:30`);
            }
        }
        return slots;
    }, []);

    const LEVEL_COLORS = {
        '1단계': '#E0F2FE',
        '2단계': '#7DD3FC',
        '3단계': '#0EA5E9',
        '4단계': '#0369A1',
        '5단계': '#4338ca',
        '6단계': '#78350F',
        'default': '#3b82f6'
    };

    const getEventColor = (event) => {
        if (event.type === 'herbal_reminder') return '#f59e0b';
        if (event.treatmentType && LEVEL_COLORS[event.treatmentType]) {
            return LEVEL_COLORS[event.treatmentType];
        }
        if (event.title && event.title.includes('1단계')) return LEVEL_COLORS['1단계'];
        if (event.title && event.title.includes('2단계')) return LEVEL_COLORS['2단계'];
        if (event.title && event.title.includes('3단계')) return LEVEL_COLORS['3단계'];
        if (event.title && event.title.includes('4단계')) return LEVEL_COLORS['4단계'];
        if (event.title && event.title.includes('5단계')) return LEVEL_COLORS['5단계'];
        if (event.title && event.title.includes('6단계')) return LEVEL_COLORS['6단계'];
        return event.backgroundColor || LEVEL_COLORS['default'];
    };

    const getEventTextColor = (bgColor) => {
        if (['#E0F2FE', '#7DD3FC', '#f59e0b', '#dcfce7'].includes(bgColor)) return '#1e3a8a';
        return '#ffffff';
    };

    // Filter Prescription Events (Herbal Reminders)
    const prescriptionEvents = useMemo(() => {
        return allEvents.filter(e => e.type === 'herbal_reminder');
    }, [allEvents]);

    useEffect(() => {
        loadEvents();
    }, []); // Load all events once on mount (or when needed)

    useEffect(() => {
        // When currentDate or allEvents changes, update dailyEvents
        if (allEvents.length > 0) {
            const targetDateStr = getFormattedDate(currentDate);
            // Filter out herbal_reminder from dailyEvents for the main grid
            const daily = allEvents.filter(e => e.start.split('T')[0] === targetDateStr && e.type !== 'herbal_reminder');
            setDailyEvents(daily);
        }

        // Update FullCalendar date if ref exists
        if (calendarRef.current) {
            const calendarApi = calendarRef.current.getApi();
            calendarApi.gotoDate(currentDate);
            calendarApi.setOption('slotEventOverlap', false);
        }
    }, [currentDate, allEvents]);

    const getFormattedDate = (date) => {
        return date.toISOString().split('T')[0];
    };

    const getWeekDays = (date) => {
        const start = new Date(date);
        const day = start.getDay(); // 0 (Sun) - 6 (Sat)
        // Adjust to Monday start (if today is Sun(0), prev Monday is -6. If Mon(1), is 0)
        // Korea standard: Mon start? Let's assume Mon start for consistency with FullCalendar default
        const diff = start.getDate() - day + (day === 0 ? -6 : 1);

        const monday = new Date(start);
        monday.setDate(diff);

        const days = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date(monday);
            d.setDate(monday.getDate() + i);
            days.push(d);
        }
        return days;
    };

    const handlePrevDay = () => {
        const newDate = new Date(currentDate);
        if (viewType === 'daily') {
            newDate.setDate(currentDate.getDate() - 1);
        } else if (viewType === 'weekly') {
            newDate.setDate(currentDate.getDate() - 7);
        } else if (viewType === 'monthly') {
            newDate.setMonth(currentDate.getMonth() - 1);
        }
        setCurrentDate(newDate);
    };

    const handleNextDay = () => {
        const newDate = new Date(currentDate);
        if (viewType === 'daily') {
            newDate.setDate(currentDate.getDate() + 1);
        } else if (viewType === 'weekly') {
            newDate.setDate(currentDate.getDate() + 7);
        } else if (viewType === 'monthly') {
            newDate.setMonth(currentDate.getMonth() + 1);
        }
        setCurrentDate(newDate);
    };

    const handleToday = () => {
        setCurrentDate(new Date());
    };

    const assignColumns = (rawEvents) => {
        // Group events by date
        const eventsByDate = {};
        rawEvents.forEach(event => {
            const dateStr = event.start.split('T')[0];
            if (!eventsByDate[dateStr]) {
                eventsByDate[dateStr] = [];
            }
            eventsByDate[dateStr].push(event);
        });

        let processedEvents = [];

        // Process each day separately
        Object.keys(eventsByDate).forEach(dateStr => {
            const daysEvents = eventsByDate[dateStr];

            const sorted = [...daysEvents].sort((a, b) => {
                const startDiff = new Date(a.start).getTime() - new Date(b.start).getTime();
                if (startDiff !== 0) return startDiff;

                const getCreatedTime = (e) => {
                    if (!e.createdAt) return 0;
                    if (typeof e.createdAt.toDate === 'function') return e.createdAt.toDate().getTime();
                    if (e.createdAt.seconds) return e.createdAt.seconds * 1000;
                    return new Date(e.createdAt).getTime();
                };
                return getCreatedTime(a) - getCreatedTime(b);
            });

            const columns = Array(8).fill(-1);

            const daysProcessedEvents = sorted.map(event => {
                const start = new Date(event.start).getTime();
                let end = event.end ? new Date(event.end).getTime() : start + 3600000;
                if (end - start < 3600000) {
                    end = start + 3600000;
                }

                let colIndex = -1;

                if (event.fixedColumn !== undefined && event.fixedColumn >= 0 && event.fixedColumn < 8) {
                    if (columns[event.fixedColumn] <= start) {
                        colIndex = event.fixedColumn;
                    }
                }

                if (colIndex === -1) {
                    for (let i = 0; i < 8; i++) {
                        if (columns[i] <= start) {
                            colIndex = i;
                            break;
                        }
                    }
                }

                if (colIndex === -1) colIndex = 7;

                columns[colIndex] = end;

                return {
                    ...event,
                    columnIndex: colIndex
                };
            });

            processedEvents = [...processedEvents, ...daysProcessedEvents];
        });

        return processedEvents;
    };

    const weeklyEvents = useMemo(() => {
        if (viewType !== 'weekly') return [];

        // Group by day
        const eventsByDate = {};
        // Filter out herbal_reminder from weeklyEvents for the main grid
        allEvents.filter(e => e.type !== 'herbal_reminder').forEach(event => {
            const dateStr = event.start.split('T')[0];
            if (!eventsByDate[dateStr]) {
                eventsByDate[dateStr] = [];
            }
            eventsByDate[dateStr].push(event);
        });

        let processed = [];

        Object.keys(eventsByDate).forEach(dateStr => {
            // Sort by existing columnIndex (Priority)
            const sorted = [...eventsByDate[dateStr]].sort((a, b) => {
                return (a.columnIndex || 0) - (b.columnIndex || 0);
            });

            // Packed assignment: Place in first available column
            const columns = Array(8).fill(-1);

            const daysEvents = sorted.map(event => {
                const start = new Date(event.start).getTime();
                let end = event.end ? new Date(event.end).getTime() : start + 3600000;
                if (end - start < 3600000) end = start + 3600000;

                let colIndex = -1;
                // Find first available column
                for (let i = 0; i < 8; i++) {
                    if (columns[i] <= start) {
                        colIndex = i;
                        break;
                    }
                }

                // If all full, overflow to last
                if (colIndex === -1) colIndex = 7;

                columns[colIndex] = end;

                return {
                    ...event,
                    columnIndex: colIndex, // Overwrite columnIndex for Weekly view (Packed)
                    originalColumnIndex: event.columnIndex // Keep original just in case
                };
            });
            processed = [...processed, ...daysEvents];
        });

        return processed;
    }, [allEvents, viewType]);

    const monthlyEvents = useMemo(() => {
        if (viewType !== 'monthly') return [];

        const importantEvents = [];
        const regularEventsByDate = {};

        allEvents.forEach(event => {
            // Check for important events
            if (event.type === 'herbal_reminder' || (event.title && event.title.includes('첩약'))) {
                importantEvents.push(event);
            } else {
                // Regular events: Aggregate by date
                const dateStr = event.start.split('T')[0];
                if (!regularEventsByDate[dateStr]) {
                    regularEventsByDate[dateStr] = 0;
                }
                regularEventsByDate[dateStr]++;
            }
        });

        const summaryEvents = Object.keys(regularEventsByDate).map(dateStr => ({
            id: `summary-${dateStr}`,
            title: `${regularEventsByDate[dateStr]}명`,
            start: dateStr,
            allDay: true,
            display: 'background', // or 'block' depending on preference, but 'background' might be too subtle. Let's use standard event.
            backgroundColor: '#f3f4f6',
            borderColor: '#e5e7eb',
            textColor: '#374151',
            type: 'summary',
            extendedProps: {
                type: 'summary',
                count: regularEventsByDate[dateStr]
            }
        }));

        return [...importantEvents, ...summaryEvents];
    }, [allEvents, viewType]);

    const loadEvents = async () => {
        try {
            const [appointments, patientsData] = await Promise.all([
                appointmentService.getAppointments(),
                patientService.getPatients()
            ]);

            setPatients(patientsData);

            const patientMap = {};
            const patientIdMap = {}; // New map for ID-based lookup
            patientsData.forEach(p => {
                patientMap[p.name] = p;
                if (p.id) patientIdMap[p.id] = p; // Populate ID map
            });

            const appointmentEvents = appointments.map((app, index) => {
                // Determine color and label based on patient data
                let bgColor = LEVEL_COLORS['default'];
                let badgeLabel = ''; // [New] Label to display

                // Priority: Lookup by patientId first, then fallback to name
                const patient = (app.patientId && patientIdMap[app.patientId])
                    ? patientIdMap[app.patientId]
                    : patientMap[app.patientName];

                if (patient) {
                    if (patient.isAutoInsurance) {
                        bgColor = '#dcfce7'; // Light Green for Auto Insurance (Jabo)
                        badgeLabel = '자보';
                    } else {
                        // Default to '1단계' if treatmentLevel is missing or explicitly set
                        const level = patient.treatmentLevel || '1단계';
                        if (LEVEL_COLORS[level]) {
                            bgColor = LEVEL_COLORS[level];
                            badgeLabel = level;
                        }
                    }
                } else {
                    // Fallback for legacy or manual without patient match
                    if (app.treatmentType && LEVEL_COLORS[app.treatmentType]) {
                        bgColor = LEVEL_COLORS[app.treatmentType];
                        badgeLabel = app.treatmentType;
                    } else if (app.title) {
                        if (app.title.includes('1단계')) { bgColor = LEVEL_COLORS['1단계']; badgeLabel = '1단계'; }
                        else if (app.title.includes('2단계')) { bgColor = LEVEL_COLORS['2단계']; badgeLabel = '2단계'; }
                        else if (app.title.includes('3단계')) { bgColor = LEVEL_COLORS['3단계']; badgeLabel = '3단계'; }
                        else if (app.title.includes('4단계')) { bgColor = LEVEL_COLORS['4단계']; badgeLabel = '4단계'; }
                        else if (app.title.includes('5단계')) { bgColor = LEVEL_COLORS['5단계']; badgeLabel = '5단계'; }
                        else if (app.title.includes('6단계')) { bgColor = LEVEL_COLORS['6단계']; badgeLabel = '6단계'; }
                    }
                }

                return {
                    id: app.id,
                    title: app.title || `${app.patientName}`,
                    start: app.start || app.date,
                    end: app.end,
                    backgroundColor: bgColor,
                    borderColor: bgColor,
                    type: 'appointment',
                    patientName: app.patientName,
                    fixedColumn: app.fixedColumn,
                    treatmentType: patient?.treatmentLevel || app.treatmentType,
                    badgeLabel, // [New]
                    ...app
                };
            });

            const herbalEvents = patientsData
                .filter(patient => patient.herbalStartDate)
                .map(patient => {
                    const startDate = new Date(patient.herbalStartDate);
                    const reminderDate = new Date(startDate);
                    reminderDate.setDate(startDate.getDate() + 27);

                    return {
                        id: `herbal-${patient.id}`,
                        title: `🌿 ${patient.name}님 첩약 재처방 상담`,
                        start: reminderDate.toISOString().split('T')[0] + 'T09:00:00',
                        end: reminderDate.toISOString().split('T')[0] + 'T10:00:00',
                        backgroundColor: '#f59e0b',
                        borderColor: '#f59e0b',
                        type: 'herbal_reminder',
                        patientId: patient.id
                    };
                });

            const allEvents = [...herbalEvents, ...appointmentEvents];
            const processedAllEvents = assignColumns(allEvents); // Process ALL events for column assignment
            setAllEvents(processedAllEvents);
            // setDailyEvents will be triggered by useEffect, filtering from this processed list
        } catch (error) {
            console.error("Failed to load events:", error);
        }
    };

    const getEventPosition = (event) => {
        const startTime = new Date(event.start);
        let endTime = event.end ? new Date(event.end) : new Date(startTime.getTime() + 60 * 60 * 1000);
        if (endTime.getTime() - startTime.getTime() < 3600000) {
            endTime = new Date(startTime.getTime() + 3600000);
        }

        const startHour = startTime.getHours();
        const startMin = startTime.getMinutes();

        // Calculate index in TIME_SLOTS
        // TIME_SLOTS: 09:00, 09:30, 10:00, 10:30, 11:00, 11:30, 12:00, 12:30 (0-7)
        // Skip 13:00, 13:30
        // 14:00 (8) ...

        let slotIndex = -1;

        // Simple linear search or calculation
        // Since we skip 13:00-14:00, simple math is tricky. Let's map it.
        const timeStr = `${startHour.toString().padStart(2, '0')}:${startMin >= 30 ? '30' : '00'}`;
        slotIndex = TIME_SLOTS.indexOf(timeStr);

        if (slotIndex === -1) {
            // Handle edge cases or out of bounds (e.g. 13:00 start)
            // If starts at 13:00, maybe map to 14:00 or ignore?
            // For now, ignore if not in slots.
            return { startIndex: -1, span: 0 };
        }

        // Calculate span
        // Duration in minutes
        const durationMs = endTime.getTime() - startTime.getTime();
        const durationMinutes = durationMs / (1000 * 60);
        const slotsCovered = Math.ceil(durationMinutes / 30);

        // We need to check how many *visible* slots it covers
        // e.g. 12:30 (30min) -> 1 slot.
        // 12:30 (90min) -> 12:30-14:00. 
        // 12:30 (visible), 13:00 (hidden), 13:30 (hidden), 14:00 (end).
        // So it covers 12:30 slot. Next visible slot is 14:00.
        // If it ends at 14:00, it covers 1 visible slot.

        let span = 0;
        let currentIdx = slotIndex;
        let minutesCounted = 0;

        // This is an approximation. Ideally we iterate time.
        // Let's iterate slots from start index
        for (let i = 0; i < slotsCovered; i++) {
            // Check if the actual time of this slot is in TIME_SLOTS
            // But we don't know the actual time easily from index + i if we skip.
            // Better: Iterate actual time steps.
            const checkTime = new Date(startTime.getTime() + i * 30 * 60000);
            const h = checkTime.getHours();
            const m = checkTime.getMinutes();
            const checkStr = `${h.toString().padStart(2, '0')}:${m >= 30 ? '30' : '00'}`;

            if (TIME_SLOTS.includes(checkStr)) {
                span++;
            }
        }

        if (span < 1) span = 1; // Minimum 1 slot

        return { startIndex: slotIndex, span };
    };

    const grid = useMemo(() => {
        const newGrid = Array(TIME_SLOTS.length).fill(null).map(() => Array(8).fill(null));

        dailyEvents.forEach(event => {
            const { startIndex, span } = getEventPosition(event);
            const colIndex = event.columnIndex;

            if (startIndex >= 0 && startIndex < newGrid.length && colIndex >= 0 && colIndex < 8) {
                newGrid[startIndex][colIndex] = { type: 'event', data: event, span };

                for (let i = 1; i < span; i++) {
                    if (startIndex + i < newGrid.length) {
                        newGrid[startIndex + i][colIndex] = { type: 'occupied', parent: event };
                    }
                }
            }
        });

        return newGrid;
    }, [dailyEvents, TIME_SLOTS]);

    const handleCellClick = (timeStr, colIndex) => {
        const dateStr = getFormattedDate(currentDate);
        setSelectedSlot({ date: dateStr, time: timeStr, fixedColumn: colIndex });
        setIsModalOpen(true);
    };

    const handleEventClick = async (event) => {
        if (event.type === 'herbal_reminder') {
            if (confirm(`${event.title}\n\n환자 상세 페이지로 이동하시겠습니까?`)) {
                window.location.href = `/patients/${event.patientId}`;
            }
        } else {
            if (confirm(`예약 상세:\n${event.title}\n시간: ${event.start.split('T')[1].substring(0, 5)} ~ ${event.end ? event.end.split('T')[1].substring(0, 5) : ''}\n\n삭제하시겠습니까?`)) {
                try {
                    const deletedCol = event.columnIndex;
                    const deletedStart = new Date(event.start).getTime();
                    const deletedEnd = event.end ? new Date(event.end).getTime() : deletedStart + 3600000;

                    await appointmentService.deleteAppointment(event.id);

                    const overlappingEvents = dailyEvents.filter(e => {
                        if (e.id === event.id) return false;
                        if (e.type === 'herbal_reminder') return false;

                        const eStart = new Date(e.start).getTime();
                        const eEnd = e.end ? new Date(e.end).getTime() : eStart + 3600000;

                        const isOverlapping = (eStart < deletedEnd) && (eEnd > deletedStart);
                        return isOverlapping && e.columnIndex > deletedCol;
                    });

                    const updatePromises = overlappingEvents.map(e => {
                        if (e.fixedColumn !== undefined && e.fixedColumn > deletedCol) {
                            return appointmentService.updateAppointment(e.id, {
                                fixedColumn: e.fixedColumn - 1
                            });
                        }
                        return Promise.resolve();
                    });

                    await Promise.all(updatePromises);
                    loadEvents();
                } catch (error) {
                    alert('삭제 실패: ' + error.message);
                }
            }
        }
    };

    const handleDragStart = (e, event) => {
        setDraggedEvent(event);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDrop = async (e, targetTimeStr, targetColIndex, targetCellData) => {
        e.preventDefault();
        if (!draggedEvent) return;

        const dateStr = getFormattedDate(currentDate);
        const newStartStr = `${dateStr}T${targetTimeStr}:00`;

        const oldStart = new Date(draggedEvent.start);
        const oldEnd = draggedEvent.end ? new Date(draggedEvent.end) : new Date(oldStart.getTime() + 3600000);
        const duration = oldEnd.getTime() - oldStart.getTime();
        const newStart = new Date(newStartStr);
        const newEnd = new Date(newStart.getTime() + duration);

        try {
            if (targetCellData && (targetCellData.type === 'event' || targetCellData.type === 'occupied')) {
                const targetEvent = targetCellData.type === 'event' ? targetCellData.data : targetCellData.parent;

                if (targetEvent.id === draggedEvent.id) return;

                if (confirm(`'${draggedEvent.title}'님과 '${targetEvent.title}'님의 예약을 서로 맞바꾸시겠습니까?`)) {
                    const targetStart = targetEvent.start;
                    const targetEnd = targetEvent.end;

                    const draggedCol = targetColIndex;
                    const targetCol = draggedEvent.columnIndex;

                    await Promise.all([
                        appointmentService.updateAppointment(draggedEvent.id, {
                            start: targetStart,
                            end: targetEnd,
                            fixedColumn: draggedCol
                        }),
                        appointmentService.updateAppointment(targetEvent.id, {
                            start: draggedEvent.start,
                            end: draggedEvent.end,
                            fixedColumn: targetCol
                        })
                    ]);
                }
            }
            else {
                await appointmentService.updateAppointment(draggedEvent.id, {
                    start: newStart.toISOString(),
                    end: newEnd.toISOString(),
                    fixedColumn: targetColIndex
                });
            }

            loadEvents();
        } catch (error) {
            alert('이동 실패: ' + error.message);
        } finally {
            setDraggedEvent(null);
        }
    };

    const getButtonLabel = () => {
        switch (viewType) {
            case 'daily': return '오늘';
            case 'weekly': return '이번주';
            case 'monthly': return '이번달';
            default: return '오늘';
        }
    };

    return (
        <div className="h-full flex flex-col bg-gray-50">
            <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shadow-sm">
                <div className="flex items-center space-x-4">
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center">
                        <CalendarIcon className="w-6 h-6 mr-2 text-blue-600" />
                        예약 관리
                    </h1>
                    <div className="flex items-center bg-gray-100 rounded-lg p-1">
                        <button onClick={handlePrevDay} className="p-1 hover:bg-white rounded-md transition-colors">
                            <ChevronLeft className="w-5 h-5 text-gray-600" />
                        </button>
                        <button onClick={handleToday} className="px-3 py-1 text-sm font-medium text-gray-700 hover:bg-white rounded-md transition-colors">
                            {getButtonLabel()}
                        </button>
                        <button onClick={handleNextDay} className="p-1 hover:bg-white rounded-md transition-colors">
                            <ChevronRight className="w-5 h-5 text-gray-600" />
                        </button>
                    </div>
                    <span className="text-lg font-medium text-gray-700">
                        {viewType === 'weekly'
                            ? `${getWeekDays(currentDate)[0].toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })} - ${getWeekDays(currentDate)[6].toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })}`
                            : viewType === 'monthly'
                                ? currentDate.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long' })
                                : currentDate.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })
                        }
                    </span>
                </div>

                <div className="flex items-center space-x-2">
                    <div className="flex bg-gray-100 p-1 rounded-lg mr-4">
                        <button
                            onClick={() => setViewType('daily')}
                            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${viewType === 'daily'
                                ? 'bg-white text-blue-600 shadow-sm'
                                : 'text-gray-600 hover:text-gray-900'
                                }`}
                        >
                            일간
                        </button>
                        <button
                            onClick={() => setViewType('weekly')}
                            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${viewType === 'weekly'
                                ? 'bg-white text-blue-600 shadow-sm'
                                : 'text-gray-600 hover:text-gray-900'
                                }`}
                        >
                            주간
                        </button>
                        <button
                            onClick={() => setViewType('monthly')}
                            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${viewType === 'monthly'
                                ? 'bg-white text-blue-600 shadow-sm'
                                : 'text-gray-600 hover:text-gray-900'
                                }`}
                        >
                            월간
                        </button>
                    </div>

                    <Button className="w-auto flex items-center" onClick={() => handleCellClick("09:00", 0)}>
                        <Plus className="w-5 h-5 mr-2" />
                        예약 추가
                    </Button>
                </div>
            </div>

            <div className="flex-1 overflow-hidden p-4">
                {viewType === 'daily' ? (
                    <div className="bg-white rounded-lg shadow border border-gray-200 h-full">
                        <table className="w-full h-full border-collapse table-fixed">
                            <thead className="bg-gray-50 sticky top-0 z-10">
                                <tr>
                                    <th className="w-20 border-r border-b border-gray-200 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider h-10">
                                        시간
                                    </th>
                                    {[...Array(8)].map((_, i) => (
                                        <th key={i} className="border-r border-b border-gray-200 text-center text-sm font-medium text-gray-700 h-10">
                                            {i + 1}순위
                                        </th>
                                    ))}
                                </tr>
                                {/* Prescription Row moved to thead */}
                                <tr className="bg-orange-50 h-12">
                                    <th className="border-r border-b border-gray-200 text-center text-xs font-bold text-orange-700 h-full py-2">
                                        처방
                                    </th>
                                    <th colSpan={8} className="border-b border-gray-200 p-0 align-top h-full">
                                        <div className="flex flex-wrap gap-1 h-full w-full overflow-hidden">
                                            {prescriptionEvents.filter(e => e.start.split('T')[0] === getFormattedDate(currentDate)).map(event => (
                                                <div
                                                    key={event.id}
                                                    className="px-2 py-1 rounded text-xs font-medium cursor-pointer hover:opacity-80 transition-opacity border border-orange-200 text-orange-800 bg-orange-100 h-full w-full flex items-center justify-center"
                                                    onClick={() => handleEventClick(event)}
                                                >
                                                    {event.title}
                                                </div>
                                            ))}
                                        </div>
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {TIME_SLOTS.map((time, rowIndex) => (
                                    <tr key={time} className="hover:bg-gray-50">
                                        <td className="border-r border-gray-200 text-center text-xs text-gray-500 font-medium h-7">
                                            {time}
                                        </td>

                                        {[...Array(8).keys()].map(colIndex => {
                                            const cellData = grid[rowIndex][colIndex];

                                            if (cellData && cellData.type === 'occupied') {
                                                return null;
                                            }

                                            if (cellData && cellData.type === 'event') {
                                                const event = cellData.data;
                                                const textColor = getEventTextColor(event.backgroundColor);
                                                return (
                                                    <td
                                                        key={colIndex}
                                                        rowSpan={cellData.span}
                                                        className="border-r border-gray-200 relative align-top p-0 h-7"
                                                        onDragOver={handleDragOver}
                                                        onDrop={(e) => handleDrop(e, time, colIndex, cellData)}
                                                    >
                                                        <div
                                                            draggable="true"
                                                            onDragStart={(e) => handleDragStart(e, event)}
                                                            className="absolute inset-x-1 top-[1px] bottom-[1px] rounded px-2 py-1 text-xs shadow-sm cursor-pointer hover:opacity-90 transition-opacity overflow-hidden flex flex-col justify-center"
                                                            style={{ backgroundColor: event.backgroundColor, color: textColor, opacity: draggedEvent?.id === event.id ? 0.5 : 1 }}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleEventClick(event);
                                                            }}
                                                        >
                                                            <div className="font-bold truncate text-sm">{event.patientName}</div>
                                                            {event.badgeLabel && (
                                                                <div className="text-xs opacity-90 truncate font-medium">
                                                                    {event.badgeLabel}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>
                                                );
                                            }

                                            return (
                                                <td
                                                    key={colIndex}
                                                    className="border-r border-gray-200 cursor-pointer hover:bg-blue-50 transition-colors h-7"
                                                    onClick={() => handleCellClick(time, colIndex)}
                                                    onDragOver={handleDragOver}
                                                    onDrop={(e) => handleDrop(e, time, colIndex, null)}
                                                >
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : viewType === 'weekly' ? (
                    <div className="bg-white rounded-lg shadow border border-gray-200 h-full">
                        <table className="w-full h-full border-collapse table-fixed">
                            <thead className="bg-gray-50 sticky top-0 z-10">
                                <tr>
                                    <th className="w-20 border-r border-b border-gray-200 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider h-10">
                                        시간
                                    </th>
                                    {getWeekDays(currentDate).map((day, i) => (
                                        <th key={i} className="border-r border-b border-gray-200 text-center text-sm font-medium text-gray-700 h-10">
                                            {day.toLocaleDateString('ko-KR', { weekday: 'short', day: 'numeric' })}
                                        </th>
                                    ))}
                                </tr>
                                {/* Prescription Row moved to thead */}
                                <tr className="bg-orange-50 h-12">
                                    <th className="border-r border-b border-gray-200 text-center text-xs font-bold text-orange-700 h-full py-2">
                                        처방
                                    </th>
                                    {getWeekDays(currentDate).map((day, i) => {
                                        const dateStr = getFormattedDate(day);
                                        const daysPrescriptions = prescriptionEvents.filter(e => e.start.split('T')[0] === dateStr);
                                        return (
                                            <th key={i} className="border-r border-b border-gray-200 p-0 align-top h-full">
                                                <div className="flex flex-col gap-1 h-full w-full overflow-hidden">
                                                    {daysPrescriptions.map(event => (
                                                        <div
                                                            key={event.id}
                                                            className="px-1 py-0.5 rounded text-[10px] font-medium cursor-pointer hover:opacity-80 transition-opacity border border-orange-200 text-orange-800 bg-orange-100 truncate h-full w-full flex items-center justify-center"
                                                            onClick={() => handleEventClick(event)}
                                                            title={event.title}
                                                        >
                                                            {event.title.replace('🌿 ', '').replace('님 첩약 재처방 상담', '')}
                                                        </div>
                                                    ))}
                                                </div>
                                            </th>
                                        );
                                    })}
                                </tr>
                            </thead>
                            <tbody className="bg-white relative">
                                {TIME_SLOTS.map((time, rowIndex) => (
                                    <tr key={time} className="hover:bg-gray-50" style={{ height: `calc(100% / ${TIME_SLOTS.length})` }}>
                                        <td className="border-r border-b border-gray-200 text-center text-xs text-gray-500 font-medium">
                                            {time}
                                        </td>
                                        {[...Array(7)].map((_, dayIndex) => (
                                            <td key={dayIndex} className="border-r border-b border-gray-200 relative p-0">
                                                {/* Background Grid Cell */}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                                {/* Event Overlay Layer */}
                                {weeklyEvents.map(event => {
                                    // Calculate Position
                                    const eventDate = new Date(event.start);
                                    const weekDays = getWeekDays(currentDate);
                                    const dayIndex = weekDays.findIndex(d => d.getDate() === eventDate.getDate());

                                    if (dayIndex === -1) return null; // Event not in this week

                                    const { startIndex, span } = getEventPosition(event);
                                    if (startIndex === -1) return null;

                                    // Calculate Dimensions using Percentages to match dynamic row height
                                    const totalSlots = TIME_SLOTS.length;

                                    return (
                                        <div
                                            key={event.id}
                                            className="absolute rounded-sm shadow-sm cursor-pointer hover:opacity-90 transition-opacity"
                                            style={{
                                                top: `calc((100% / ${totalSlots} * ${startIndex}) + 1px)`,
                                                height: `calc((100% / ${totalSlots} * ${span}) - 2px)`,
                                                left: `calc(5rem + ((100% - 5rem) / 7 * ${dayIndex}) + ((100% - 5rem) / 7 / 8 * ${event.columnIndex}))`,
                                                width: `calc((100% - 5rem) / 7 / 8 - 1px)`, // -1px for gap
                                                backgroundColor: event.backgroundColor,
                                                zIndex: 10
                                            }}
                                            title={`${event.title} (${event.start.split('T')[1].substring(0, 5)})`}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleEventClick(event);
                                            }}
                                        />
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="bg-white rounded-lg shadow border border-gray-200 h-full p-4 overflow-auto">
                        <FullCalendar
                            ref={calendarRef}
                            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                            initialView="dayGridMonth"
                            key={viewType}
                            headerToolbar={false}
                            initialDate={currentDate}
                            events={monthlyEvents}
                            dateClick={(info) => {
                                handleCellClick(info.dateStr.split('T')[1]?.substring(0, 5) || "09:00", 0);
                            }}
                            eventClick={(info) => {
                                const event = allEvents.find(e => e.id === info.event.id);
                                if (event) handleEventClick(event);
                            }}
                            height="100%"
                            editable={true}
                            selectable={true}
                            selectMirror={true}
                            dayMaxEvents={false}
                            locale="ko"
                            eventContent={(arg) => {
                                const { type } = arg.event.extendedProps;
                                if (type === 'summary') {
                                    return (
                                        <div className="flex justify-center items-center w-full py-0.5">
                                            <div className="text-xs font-bold text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">
                                                {arg.event.title}
                                            </div>
                                        </div>
                                    );
                                }
                                return (
                                    <div className="flex items-center overflow-hidden w-full px-1 text-[10px] leading-tight bg-orange-100 text-orange-800 rounded-sm border border-orange-200">
                                        <div className="font-medium truncate">{arg.event.title}</div>
                                    </div>
                                );
                            }}
                        />
                    </div>
                )}
            </div>

            <ReservationModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                selectedDate={selectedSlot.date}
                selectedTime={selectedSlot.time}
                selectedColumn={selectedSlot.fixedColumn}
                onSave={loadEvents}
                patients={patients}
            />
        </div>
    );
};

export default Schedule;
