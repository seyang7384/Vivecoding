import React, { useState, useEffect, useRef } from 'react';
import { Send, Users, User, Bell, MessageSquare, Building, AlertCircle } from 'lucide-react';
import { db } from '../firebase';
import { collection, query, where, orderBy, onSnapshot, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { prescriptionService } from '../services/prescriptionService';
import { prescriptionParserService } from '../services/prescriptionParserService';
import { parsePrescription } from '../utils/SmartParser';
import { inventoryService } from '../services/inventoryService';

// [설정] 명칭이 모호해서 시스템이 헷갈려하는 약재 목록
const AMBIGUOUS_HERBS = ['작약', '복령'];

// 원내 업무 룸 (기존 localStorage 기반)
const INTERNAL_ROOMS = [
    { id: 'general', name: '전체 공지', type: 'announcement', section: 'internal' },
    { id: 'prescription', name: '첩약 처방', type: 'prescription', section: 'internal' },
    { id: 'staff-김철수', name: '김철수', type: '1:1', section: 'internal' },
    { id: 'staff-이영희', name: '이영희', type: '1:1', section: 'internal' }
];

const Chat = () => {
    // 원내 업무 (localStorage 기반)
    const [internalRooms] = useState(INTERNAL_ROOMS);
    const [internalMessages, setInternalMessages] = useState([]);

    // 환자 상담 (Firestore 기반)
    const [patientConversations, setPatientConversations] = useState([]);

    const [selectedRoom, setSelectedRoom] = useState(null);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [draftMessage, setDraftMessage] = useState(null); // 발송 대기 메시지
    const messagesEndRef = useRef(null);

    // ============================================================
    // 📡 Firestore 실시간 구독 (환자 상담 conversations)
    // ============================================================
    useEffect(() => {
        const q = query(
            collection(db, 'conversations'),
            where('type', 'in', ['kakao', 'sms']),
            orderBy('createdAt', 'desc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            // patientId 기준으로 그룹화하여 대화방 목록 생성
            const conversationsMap = new Map();

            snapshot.docs.forEach(doc => {
                const data = { id: doc.id, ...doc.data() };
                const key = data.patientId;

                if (!conversationsMap.has(key)) {
                    conversationsMap.set(key, {
                        patientId: data.patientId,
                        patientName: data.patientName || '알 수 없음',
                        messages: [],
                        lastMessage: data,
                        hasDraft: data.status === 'draft'
                    });
                }

                const room = conversationsMap.get(key);
                room.messages.push(data);

                // 가장 최근 메시지 업데이트
                if (!room.lastMessage ||
                    (data.createdAt && room.lastMessage.createdAt &&
                        data.createdAt.toMillis?.() > room.lastMessage.createdAt.toMillis?.())) {
                    room.lastMessage = data;
                    room.hasDraft = data.status === 'draft';
                }
            });

            // Map을 배열로 변환하고 draft 우선 정렬
            const conversationsArray = Array.from(conversationsMap.values());
            conversationsArray.sort((a, b) => {
                // draft 있는 것을 최상단으로
                if (a.hasDraft && !b.hasDraft) return -1;
                if (!a.hasDraft && b.hasDraft) return 1;
                // 그 다음은 최신순
                const aTime = a.lastMessage?.createdAt?.toMillis?.() || 0;
                const bTime = b.lastMessage?.createdAt?.toMillis?.() || 0;
                return bTime - aTime;
            });

            setPatientConversations(conversationsArray);
        }, (error) => {
            console.error('Firestore subscription error:', error);
        });

        return () => unsubscribe();
    }, []);

    // ============================================================
    // 📂 메시지 로드 (방 변경 시)
    // ============================================================
    useEffect(() => {
        if (!selectedRoom) return;

        if (selectedRoom.section === 'internal') {
            // 원내 업무 - localStorage
            const storageKey = `chat_messages_${selectedRoom.id}`;
            const stored = JSON.parse(localStorage.getItem(storageKey) || '[]');
            setMessages(stored);
            setDraftMessage(null);
            setNewMessage('');

            // Poll for localStorage changes
            const interval = setInterval(() => {
                const updated = JSON.parse(localStorage.getItem(storageKey) || '[]');
                setMessages(updated);
            }, 1000);

            return () => clearInterval(interval);
        } else if (selectedRoom.section === 'patient') {
            // 환자 상담 - Firestore
            const conversation = patientConversations.find(c => c.patientId === selectedRoom.patientId);
            if (conversation) {
                // 시간순 정렬
                const sortedMessages = [...conversation.messages].sort((a, b) => {
                    const aTime = a.createdAt?.toMillis?.() || 0;
                    const bTime = b.createdAt?.toMillis?.() || 0;
                    return aTime - bTime;
                });
                setMessages(sortedMessages);

                // draft 메시지가 있으면 입력창에 채우기
                const draft = sortedMessages.find(m => m.status === 'draft');
                if (draft) {
                    setDraftMessage(draft);
                    setNewMessage(draft.content || '');
                } else {
                    setDraftMessage(null);
                    setNewMessage('');
                }
            }
        }
    }, [selectedRoom, patientConversations]);

    // Auto-scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // ============================================================
    // 📤 메시지 전송
    // ============================================================
    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!newMessage.trim() || !selectedRoom) return;

        // 환자 상담 (Firestore)
        if (selectedRoom.section === 'patient') {
            try {
                if (draftMessage) {
                    // Draft 메시지 발송 - status를 'sent'로 변경
                    const docRef = doc(db, 'conversations', draftMessage.id);
                    await updateDoc(docRef, {
                        content: newMessage,
                        status: 'sent',
                        sentAt: serverTimestamp()
                    });

                    // TODO: 실제 카카오톡 API 호출 부분 (나중 연동)
                    console.log('📱 카카오톡 발송 API 호출 예정:', newMessage);

                    alert('메시지가 발송되었습니다!');
                    setDraftMessage(null);
                } else {
                    // 새 메시지 추가
                    await addDoc(collection(db, 'conversations'), {
                        patientId: selectedRoom.patientId,
                        patientName: selectedRoom.patientName,
                        content: newMessage,
                        type: 'kakao',
                        direction: 'outbound',
                        status: 'sent',
                        createdAt: serverTimestamp(),
                        sentAt: serverTimestamp()
                    });
                }
                setNewMessage('');
            } catch (error) {
                console.error('Failed to send message:', error);
                alert('메시지 전송 중 오류가 발생했습니다.');
            }
            return;
        }

        // 원내 업무 (localStorage) - 기존 로직
        let messageText = newMessage;

        // SmartParser로 텍스트 파싱
        let parsedData = null;
        try {
            parsedData = parsePrescription(messageText);

            if (parsedData?.herbs?.some(h => h.name === '감초')) {
                if (window.confirm("'감초'가 입력되었습니다. '자감초'로 변경하시겠습니까?")) {
                    messageText = messageText.replace(/감초/g, '자감초');
                    parsedData = parsePrescription(messageText);
                }
            }

            if (parsedData?.herbs?.length > 0) {
                const ambiguousItems = parsedData.herbs.filter(herb =>
                    AMBIGUOUS_HERBS.includes(herb.name)
                );

                if (ambiguousItems.length > 0) {
                    const names = ambiguousItems.map(item => item.name).join(', ');
                    alert(
                        `⚠️ 명칭이 불분명한 약재가 감지되었습니다: [${names}]\n\n` +
                        `재고 관리를 위해 '백${names}'인지 '적${names}'인지 정확하게 구분하여 수정해주세요.\n` +
                        `(메시지가 전송되지 않았습니다.)`
                    );
                    return;
                }
            }
        } catch (err) {
            console.error("SmartParser failed:", err);
        }

        const lines = messageText.split('\n').filter(line => line.trim());

        if (selectedRoom.id === 'prescription' && lines.length >= 4) {
            const parseResult = prescriptionParserService.parseText(messageText);

            if (parseResult.success) {
                const patients = JSON.parse(localStorage.getItem('patients') || '[]');
                const result = prescriptionService.processPrescription(
                    messageText,
                    parseResult.data.duration,
                    patients
                );

                if (result.success) {
                    setNewMessage('');
                    alert(`첩약 처방이 자동으로 등록되었습니다!\n\n환자: ${result.prescription.patientName}\n복용 기간: ${result.prescription.duration}일\n재상담일: ${new Date(result.prescription.followUpDate).toLocaleDateString('ko-KR')}\n\n일정에 자동으로 추가되었습니다.`);

                    const storageKey = `chat_messages_${selectedRoom.id}`;
                    const updated = JSON.parse(localStorage.getItem(storageKey) || '[]');
                    setMessages(updated);

                    if (parsedData?.herbs?.length > 0) {
                        updateInventory(parsedData.herbs);
                    }
                    return;
                } else if (result.needsRegistration) {
                    if (confirm(`환자 정보를 찾을 수 없습니다.\n환자명: ${result.patientName}\n\n신규 등록하시겠습니까?`)) {
                        window.location.href = '/patients';
                    }
                    return;
                }
            }
        }

        const mockMessage = {
            id: Date.now().toString(),
            text: messageText,
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

        if (parsedData?.herbs?.length > 0) {
            updateInventory(parsedData.herbs);
        }
    };

    const updateInventory = async (herbsToDeduct) => {
        try {
            for (const herb of herbsToDeduct) {
                await inventoryService.deductInventory(herb.name, herb.amount);
            }
        } catch (error) {
            console.error("재고 차감 실패:", error);
            alert("⚠️ 재고 차감 중 오류가 발생했습니다.");
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage(e);
        }
    };

    const formatTime = (timestamp) => {
        if (!timestamp) return '';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
    };

    const selectPatientRoom = (conversation) => {
        setSelectedRoom({
            id: `patient-${conversation.patientId}`,
            name: conversation.patientName,
            type: 'kakao',
            section: 'patient',
            patientId: conversation.patientId,
            patientName: conversation.patientName
        });
    };

    return (
        <div className="h-full flex flex-col">
            <div className="mb-4">
                <h1 className="text-2xl font-bold text-gray-900">통합 메신저</h1>
                <p className="text-gray-500">원내 소통 및 환자 상담 (Firestore 실시간 연동)</p>
            </div>

            <div className="flex-1 bg-white rounded-xl shadow-sm overflow-hidden flex" style={{ height: 'calc(100vh - 200px)' }}>
                {/* Room List - Sectioned Sidebar */}
                <div className="w-72 border-r border-gray-200 flex flex-col overflow-y-auto">

                    {/* 섹션 1: 원내 업무 */}
                    <div className="border-b border-gray-200">
                        <div className="p-3 bg-gray-50 flex items-center space-x-2">
                            <Building className="w-4 h-4 text-gray-600" />
                            <h2 className="font-bold text-sm text-gray-700">원내 업무</h2>
                        </div>
                        {internalRooms.map((room) => (
                            <button
                                key={room.id}
                                onClick={() => setSelectedRoom({ ...room, section: 'internal' })}
                                className={`w-full p-3 flex items-center space-x-3 hover:bg-gray-50 transition-colors border-b border-gray-100 ${selectedRoom?.id === room.id ? 'bg-blue-50 border-l-4 border-l-blue-600' : ''
                                    }`}
                            >
                                <div className={`w-9 h-9 rounded-full flex items-center justify-center ${room.type === 'announcement' ? 'bg-orange-100' : 'bg-blue-100'
                                    }`}>
                                    {room.type === 'announcement' ? (
                                        <Bell className="w-4 h-4 text-orange-600" />
                                    ) : (
                                        <User className="w-4 h-4 text-blue-600" />
                                    )}
                                </div>
                                <div className="flex-1 text-left">
                                    <p className="font-medium text-gray-900 text-sm">{room.name}</p>
                                    <p className="text-xs text-gray-500 truncate">
                                        {(() => {
                                            const storageKey = `chat_messages_${room.id}`;
                                            const msgs = JSON.parse(localStorage.getItem(storageKey) || '[]');
                                            const lastMsg = msgs[msgs.length - 1];
                                            return lastMsg ? lastMsg.text?.substring(0, 20) + '...' : '대화를 시작해보세요';
                                        })()}
                                    </p>
                                </div>
                            </button>
                        ))}
                    </div>

                    {/* 섹션 2: 환자 상담 */}
                    <div>
                        <div className="p-3 bg-yellow-50 flex items-center space-x-2">
                            <MessageSquare className="w-4 h-4 text-yellow-700" />
                            <h2 className="font-bold text-sm text-yellow-700">환자 상담</h2>
                            {patientConversations.filter(c => c.hasDraft).length > 0 && (
                                <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                                    {patientConversations.filter(c => c.hasDraft).length}
                                </span>
                            )}
                        </div>
                        {patientConversations.length === 0 ? (
                            <div className="p-4 text-center text-gray-400 text-sm">
                                환자 상담 내역이 없습니다
                            </div>
                        ) : (
                            patientConversations.map((conversation) => (
                                <button
                                    key={conversation.patientId}
                                    onClick={() => selectPatientRoom(conversation)}
                                    className={`w-full p-3 flex items-center space-x-3 hover:bg-yellow-50 transition-colors border-b border-gray-100 ${selectedRoom?.patientId === conversation.patientId ? 'bg-yellow-100 border-l-4 border-l-yellow-500' : ''
                                        }`}
                                >
                                    <div className={`w-9 h-9 rounded-full flex items-center justify-center ${conversation.hasDraft ? 'bg-red-100' : 'bg-yellow-100'
                                        }`}>
                                        <User className={`w-4 h-4 ${conversation.hasDraft ? 'text-red-600' : 'text-yellow-600'}`} />
                                    </div>
                                    <div className="flex-1 text-left">
                                        <div className="flex items-center space-x-2">
                                            <p className="font-medium text-gray-900 text-sm">{conversation.patientName}</p>
                                            {conversation.hasDraft && (
                                                <span className="bg-red-500 text-white text-xs px-1.5 py-0.5 rounded text-[10px] font-bold">
                                                    발송대기
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-gray-500 truncate">
                                            {conversation.lastMessage?.content?.substring(0, 20) || ''}...
                                        </p>
                                    </div>
                                </button>
                            ))
                        )}
                    </div>
                </div>

                {/* Chat Area */}
                <div className="flex-1 flex flex-col">
                    {selectedRoom ? (
                        <>
                            {/* Chat Header */}
                            <div className={`p-4 border-b border-gray-200 ${selectedRoom.section === 'patient' ? 'bg-yellow-50' : 'bg-gray-50'
                                }`}>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className="font-bold text-gray-900">{selectedRoom.name}</h3>
                                        <p className="text-xs text-gray-500">
                                            {selectedRoom.section === 'patient' ? '카카오톡 상담' :
                                                selectedRoom.type === 'announcement' ? '전체 공지방' : '1:1 채팅'}
                                        </p>
                                    </div>
                                    {draftMessage && (
                                        <div className="flex items-center space-x-2 bg-red-100 text-red-700 px-3 py-1 rounded-full text-sm">
                                            <AlertCircle className="w-4 h-4" />
                                            <span className="font-medium">발송 대기 중인 메시지가 있습니다</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Messages */}
                            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                                {messages.length === 0 ? (
                                    <div className="text-center text-gray-400 mt-10">
                                        <p>아직 메시지가 없습니다.</p>
                                        <p className="text-sm">첫 메시지를 보내보세요!</p>
                                    </div>
                                ) : (
                                    messages.map((message) => {
                                        const isOutbound = message.direction === 'outbound' || message.userId === 'current-user';
                                        const isDraft = message.status === 'draft';

                                        return (
                                            <div
                                                key={message.id}
                                                className={`flex ${isOutbound ? 'justify-end' : 'justify-start'}`}
                                            >
                                                <div
                                                    className={`max-w-md px-4 py-2 rounded-lg whitespace-pre-wrap relative ${isDraft
                                                            ? 'bg-red-100 text-red-900 border-2 border-red-300'
                                                            : isOutbound
                                                                ? 'bg-blue-600 text-white'
                                                                : message.isSystemMessage
                                                                    ? 'bg-gray-800 text-white'
                                                                    : 'bg-gray-100 text-gray-900'
                                                        }`}
                                                >
                                                    {isDraft && (
                                                        <div className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded font-bold">
                                                            발송대기
                                                        </div>
                                                    )}
                                                    {!isOutbound && (
                                                        <p className="text-xs font-medium mb-1 opacity-75">
                                                            {message.userName || message.patientName}
                                                        </p>
                                                    )}
                                                    <p className="text-sm">{message.content || message.text}</p>
                                                    <p className={`text-xs mt-1 ${isOutbound && !isDraft ? 'text-blue-100' : 'text-gray-500'
                                                        }`}>
                                                        {formatTime(message.createdAt || message.timestamp)}
                                                    </p>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                                <div ref={messagesEndRef} />
                            </div>

                            {/* Message Input */}
                            <form onSubmit={handleSendMessage} className={`p-3 border-t border-gray-200 ${draftMessage ? 'bg-red-50' : 'bg-gray-50'
                                }`}>
                                {draftMessage && (
                                    <div className="mb-2 text-sm text-red-600 flex items-center space-x-1">
                                        <AlertCircle className="w-4 h-4" />
                                        <span>아래 내용을 수정 후 전송 버튼을 누르면 카카오톡으로 발송됩니다.</span>
                                    </div>
                                )}
                                <div className="flex space-x-1 items-end">
                                    <textarea
                                        value={newMessage}
                                        onChange={(e) => setNewMessage(e.target.value)}
                                        onKeyDown={handleKeyDown}
                                        placeholder="메시지를 입력하세요... (Shift+Enter로 줄바꿈)"
                                        rows="6"
                                        className={`flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 resize-none ${draftMessage
                                                ? 'border-red-300 focus:ring-red-500 bg-white'
                                                : 'border-gray-300 focus:ring-blue-500'
                                            }`}
                                    />
                                    <button
                                        type="submit"
                                        className={`px-3 py-3 rounded-lg transition-colors flex items-center justify-center ${draftMessage
                                                ? 'bg-red-600 hover:bg-red-700 text-white'
                                                : 'bg-blue-600 hover:bg-blue-700 text-white'
                                            }`}
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
