import React, { useState, useEffect, useRef } from 'react';
import { Send, Users, User, Bell } from 'lucide-react';
import Button from '../components/ui/Button';
import { prescriptionService } from '../services/prescriptionService';
import { prescriptionParserService } from '../services/prescriptionParserService';

const Chat = () => {
    const [rooms, setRooms] = useState([]);
    const [selectedRoom, setSelectedRoom] = useState(null);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const messagesEndRef = useRef(null);

    // Initialize mock rooms
    useEffect(() => {
        const mockRooms = [
            { id: 'general', name: '전체 공지', type: 'announcement' },
            { id: 'prescription', name: '첩약 처방', type: 'prescription' },
            { id: 'staff-김철수', name: '김철수', type: '1:1' },
            { id: 'staff-이영희', name: '이영희', type: '1:1' }
        ];
        setRooms(mockRooms);
        setSelectedRoom(mockRooms[0]);
    }, []);

    // Load messages when room changes
    useEffect(() => {
        if (!selectedRoom) return;

        const storageKey = `chat_messages_${selectedRoom.id}`;
        const stored = JSON.parse(localStorage.getItem(storageKey) || '[]');
        setMessages(stored);

        // Poll for changes every second
        const interval = setInterval(() => {
            const updated = JSON.parse(localStorage.getItem(storageKey) || '[]');
            if (JSON.stringify(updated) !== JSON.stringify(stored)) {
                setMessages(updated);
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [selectedRoom]);

    // Auto-scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSendMessage = (e) => {
        e.preventDefault();
        if (!newMessage.trim() || !selectedRoom) return;

        // Check if message is prescription format (4 lines)
        const lines = newMessage.split('\n').filter(line => line.trim());

        // Auto-detect prescription in "첩약 처방" room
        if (selectedRoom.id === 'prescription' && lines.length >= 4) {
            // Try to parse as prescription
            const parseResult = prescriptionParserService.parseText(newMessage);

            if (parseResult.success) {
                // Get all patients
                const patients = JSON.parse(localStorage.getItem('patients') || '[]');

                // Process prescription
                const result = prescriptionService.processPrescription(
                    newMessage,
                    parseResult.data.duration,
                    patients
                );

                if (result.success) {
                    // Prescription created successfully - system message already sent
                    setNewMessage('');

                    // Show success notification
                    alert(`첩약 처방이 자동으로 등록되었습니다!

환자: ${result.prescription.patientName}
복용 기간: ${result.prescription.duration}일
재상담일: ${new Date(result.prescription.followUpDate).toLocaleDateString('ko-KR')}

일정에 자동으로 추가되었습니다.`);

                    // Reload messages to show system message
                    const storageKey = `chat_messages_${selectedRoom.id}`;
                    const updated = JSON.parse(localStorage.getItem(storageKey) || '[]');
                    setMessages(updated);
                    return;
                } else if (result.needsRegistration) {
                    // Patient not found
                    const confirmRegister = confirm(
                        `환자 정보를 찾을 수 없습니다.
환자명: ${result.patientName}

신규 등록하시겠습니까?`
                    );
                    if (confirmRegister) {
                        window.location.href = '/patients';
                    }
                    return;
                }
            }
        }

        // Send as normal message
        const mockMessage = {
            id: Date.now().toString(),
            text: newMessage,
            userId: 'current-user',
            userName: '관리자',
            timestamp: Date.now(),
            read: false
        };

        const storageKey = `chat_messages_${selectedRoom.id}`;
        const existing = JSON.parse(localStorage.getItem(storageKey) || '[]');
        const updated = [...existing, mockMessage];
        localStorage.setItem(storageKey, JSON.stringify(updated));

        setMessages(updated);
        setNewMessage('');
    };

    const handleKeyDown = (e) => {
        // Enter only: send message
        // Shift+Enter: new line
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage(e);
        }
    };

    const formatTime = (timestamp) => {
        const date = new Date(timestamp);
        return date.toLocaleTimeString('ko-KR', {
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <div className="h-full flex flex-col">
            <div className="mb-4">
                <h1 className="text-2xl font-bold text-gray-900">메신저</h1>
                <p className="text-gray-500">실시간 소통 및 공지사항 (localStorage 기반)</p>
            </div>

            <div className="flex-1 bg-white rounded-xl shadow-sm overflow-hidden flex" style={{ height: 'calc(100vh - 200px)' }}>
                {/* Room List */}
                <div className="w-64 border-r border-gray-200 flex flex-col">
                    <div className="p-4 border-b border-gray-200">
                        <h2 className="font-bold text-gray-900">대화방</h2>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                        {rooms.map((room) => (
                            <button
                                key={room.id}
                                onClick={() => setSelectedRoom(room)}
                                className={`w-full p-4 flex items-center space-x-3 hover:bg-gray-50 transition-colors ${selectedRoom?.id === room.id ? 'bg-blue-50 border-l-4 border-blue-600' : ''
                                    }`}
                            >
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${room.type === 'announcement' ? 'bg-orange-100' : 'bg-blue-100'
                                    }`}>
                                    {room.type === 'announcement' ? (
                                        <Bell className="w-5 h-5 text-orange-600" />
                                    ) : (
                                        <User className="w-5 h-5 text-blue-600" />
                                    )}
                                </div>
                                <div className="flex-1 text-left">
                                    <p className="font-medium text-gray-900 text-sm">{room.name}</p>
                                    <p className="text-xs text-gray-500">
                                        {(() => {
                                            const storageKey = `chat_messages_${room.id}`;
                                            const msgs = JSON.parse(localStorage.getItem(storageKey) || '[]');
                                            const lastMsg = msgs[msgs.length - 1];
                                            return lastMsg ? lastMsg.text.substring(0, 15) + '...' : '대화를 시작해보세요';
                                        })()}
                                    </p>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Chat Area */}
                <div className="flex-1 flex flex-col">
                    {selectedRoom ? (
                        <>
                            {/* Chat Header */}
                            <div className="p-4 border-b border-gray-200 bg-gray-50">
                                <h3 className="font-bold text-gray-900">{selectedRoom.name}</h3>
                                <p className="text-xs text-gray-500">
                                    {selectedRoom.type === 'announcement' ? '전체 공지방' : '1:1 채팅'}
                                </p>
                            </div>

                            {/* Messages */}
                            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                                {messages.length === 0 ? (
                                    <div className="text-center text-gray-400 mt-10">
                                        <p>아직 메시지가 없습니다.</p>
                                        <p className="text-sm">첫 메시지를 보내보세요!</p>
                                    </div>
                                ) : (
                                    messages.map((message) => (
                                        <div
                                            key={message.id}
                                            className={`flex ${message.userId === 'current-user' ? 'justify-end' : 'justify-start'
                                                }`}
                                        >
                                            <div
                                                className={`max-w-xs px-4 py-2 rounded-lg whitespace-pre-wrap ${message.userId === 'current-user'
                                                    ? 'bg-blue-600 text-white'
                                                    : message.isSystemMessage
                                                        ? 'bg-gray-800 text-white'
                                                        : 'bg-gray-100 text-gray-900'
                                                    }`}
                                            >
                                                {message.userId !== 'current-user' && (
                                                    <p className="text-xs font-medium mb-1 opacity-75">
                                                        {message.userName}
                                                    </p>
                                                )}
                                                <p className="text-sm">{message.text}</p>
                                                <p className={`text-xs mt-1 ${message.userId === 'current-user' ? 'text-blue-100' : 'text-gray-500'
                                                    }`}>
                                                    {formatTime(message.timestamp)}
                                                </p>
                                            </div>
                                        </div>
                                    ))
                                )}
                                <div ref={messagesEndRef} />
                            </div>

                            {/* Message Input */}
                            <form onSubmit={handleSendMessage} className="p-3 border-t border-gray-200 bg-gray-50">
                                <div className="flex space-x-1 items-end">
                                    <textarea
                                        value={newMessage}
                                        onChange={(e) => setNewMessage(e.target.value)}
                                        onKeyDown={handleKeyDown}
                                        placeholder="메시지를 입력하세요... (Shift+Enter로 줄바꿈)"
                                        rows="6"
                                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                                    />
                                    <button
                                        type="submit"
                                        className="px-3 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center"
                                    >
                                        <Send className="w-4 h-4" />
                                    </button>
                                </div>
                            </form>
                        </>
                    ) : (
                        <div className="flex-1 flex items-center justify-center text-gray-400">
                            <div className="text-center">
                                <Users className="w-16 h-16 mx-auto mb-4 opacity-50" />
                                <p>대화방을 선택해주세요</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Chat;
