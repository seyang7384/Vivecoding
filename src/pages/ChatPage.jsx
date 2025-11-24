import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, Send, Users } from 'lucide-react';
import { chatService } from '../services/chatService';

import { parsePrescription } from '../utils/SmartParser';
import { inventoryService } from '../services/inventoryService';

// [설정] 명칭이 모호해서 시스템이 헷갈려하는 약재 목록
const AMBIGUOUS_HERBS = ['작약', '복령'];

const ChatPage = () => {
    const [activeTab, setActiveTab] = useState('general');
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [currentUser] = useState('김의사'); // TODO: Get from auth context
    const scrollRef = useRef(null);
    const isAtBottomRef = useRef(true);
    const messagesEndRef = useRef(null);

    useEffect(() => {
        // Subscribe to messages
        const unsubscribe = chatService.subscribeToRoom(activeTab, (newMessages) => {
            setMessages(newMessages);
        });

        return () => unsubscribe();
    }, [activeTab]);

    // Check if user is at bottom on scroll
    const handleScroll = () => {
        if (scrollRef.current) {
            const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
            // Consider "at bottom" if within 100px of the bottom
            isAtBottomRef.current = scrollHeight - scrollTop - clientHeight < 100;
        }
    };

    useEffect(() => {
        // Auto-scroll only if user was already at bottom OR if it's a new message from me
        const lastMessage = messages[messages.length - 1];
        const isMyMessage = lastMessage?.sender === currentUser;

        if (isAtBottomRef.current || isMyMessage) {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, currentUser]);

    const handleSendMessage = async (e) => {
        e.preventDefault();
        alert("🔥 handleSendMessage 함수가 실행되었습니다!");
        console.log("🚀 handleSendMessage triggered");
        console.log("📩 Message content:", newMessage);

        if (!newMessage.trim()) {
            console.log("⚠️ Empty message, aborting");
            return;
        }

        let parsedData = null;
        try {
            // 1. 텍스트 분석 (카톡 폼, 시스템 폼 모두 자동 인식)
            console.log("🧠 Calling parsePrescription...");
            parsedData = parsePrescription(newMessage);
            console.log("🔍 SmartParser Result:", parsedData);

            // --- 디버깅용 로그 추가 ---
            console.log("1. 입력된 텍스트:", newMessage);
            console.log("2. 파싱된 전체 데이터:", parsedData);
            console.log("3. 추출된 약재 리스트:", parsedData?.herbs);
            console.log("4. 검출된 모호한 약재:", parsedData?.herbs?.filter(h => ['작약', '복령'].includes(h.name)));
            // -----------------------
        } catch (err) {
            console.error("❌ parsePrescription failed:", err);
            // Continue without parsing if it fails, or handle error
        }

        // ============================================================
        // 🛡️ [신규 기능] 모호한 약재 검문소 (Ambiguity Check)
        // ============================================================
        // 파싱된 약재 중에 '작약'이나 '복령'이 섞여 있는지 확인합니다.
        if (parsedData && parsedData.herbs && parsedData.herbs.length > 0) {
            console.log("🌿 Checking for ambiguous herbs in:", parsedData.herbs);
            const ambiguousItems = parsedData.herbs.filter(herb =>
                AMBIGUOUS_HERBS.includes(herb.name)
            );

            console.log("🛡️ Ambiguous Items Detected:", ambiguousItems);

            // 만약 모호한 약재가 하나라도 발견되면?
            if (ambiguousItems.length > 0) {
                const names = ambiguousItems.map(item => item.name).join(', ');

                // 경고창을 띄우고 함수를 여기서 '강제 종료(return)' 시킵니다.
                alert(
                    `⚠️ 명칭이 불분명한 약재가 감지되었습니다: [${names}]\n\n` +
                    `재고 관리를 위해 '백${names}'인지 '적${names}'인지 정확하게 구분하여 수정해주세요.\n` +
                    `(메시지가 전송되지 않았습니다.)`
                );
                return; // ⛔️ 여기서 멈춤! 전송도 안 되고 재고도 안 까짐.
            }
        }
        // ============================================================

        // 2. 메시지 전송
        await chatService.sendMessage(activeTab, newMessage, currentUser);

        // 3. 재고 차감 실행 (약재 데이터가 있을 때만)
        if (parsedData && parsedData.herbs && parsedData.herbs.length > 0) {
            updateInventory(parsedData.herbs);
        }

        setNewMessage('');
    };

    // [재고 DB 수정 함수]
    const updateInventory = async (herbsToDeduct) => {
        try {
            console.log("📉 재고 차감 시작:", herbsToDeduct);

            for (const herb of herbsToDeduct) {
                await inventoryService.deductInventory(herb.name, herb.amount);
            }

        } catch (error) {
            console.error("재고 차감 실패:", error);
            alert("⚠️ 재고 차감 중 오류가 발생했습니다. (메시지는 전송됨)");
        }
    };

    return (
        <div className="flex flex-col h-[calc(100vh-8rem)]">
            <h1 className="text-2xl font-bold mb-6">사내 메신저</h1>

            {/* Tabs */}
            <div className="flex gap-2 mb-4">
                <button
                    onClick={() => setActiveTab('general')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${activeTab === 'general'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                >
                    <Users size={18} />
                    전체 공지방
                </button>
                <button
                    onClick={() => setActiveTab('direct')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${activeTab === 'direct'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                >
                    <MessageCircle size={18} />
                    1:1 채팅 (준비중)
                </button>
            </div>

            {/* Messages Container */}
            <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col overflow-hidden">
                {/* Messages List */}
                <div
                    ref={scrollRef}
                    onScroll={handleScroll}
                    className="flex-1 overflow-y-auto p-4 space-y-3"
                >
                    {messages.length === 0 ? (
                        <div className="text-center text-gray-500 mt-8">
                            아직 메시지가 없습니다. 첫 메시지를 보내보세요!
                        </div>
                    ) : (
                        messages.map((msg) => {
                            const isMyMessage = msg.sender === currentUser;
                            return (
                                <div
                                    key={msg.id}
                                    className={`flex ${isMyMessage ? 'justify-end' : 'justify-start'}`}
                                >
                                    <div className={`max-w-[70%] ${isMyMessage ? 'items-end' : 'items-start'} flex flex-col`}>
                                        {!isMyMessage && (
                                            <span className="text-xs text-gray-500 mb-1 px-2">{msg.sender}</span>
                                        )}
                                        <div
                                            className={`px-4 py-2 rounded-lg ${isMyMessage
                                                ? 'bg-blue-600 text-white'
                                                : 'bg-gray-100 text-gray-900'
                                                }`}
                                        >
                                            <p className="text-sm whitespace-pre-wrap break-words">{msg.text}</p>
                                        </div>
                                        <span className="text-xs text-gray-400 mt-1 px-2">
                                            {new Date(msg.timestamp).toLocaleTimeString('ko-KR', {
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            })}
                                        </span>
                                    </div>
                                </div>
                            );
                        })
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Message Input */}
                <form onSubmit={handleSendMessage} className="border-t border-gray-200 p-4">
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            placeholder="메시지를 입력하세요..."
                            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                        />
                        <button
                            type="submit"
                            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                        >
                            <Send size={18} />
                            전송
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ChatPage;
