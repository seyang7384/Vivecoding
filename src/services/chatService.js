import { database } from '../lib/firebase';
import { ref, push, set, onValue, off, query, orderByChild, limitToLast } from 'firebase/database';

// Mock user for demo (in real app, get from auth context)
const getCurrentUser = () => {
    return {
        id: 'user1',
        name: '관리자',
        email: 'admin@hospital.com'
    };
};

export const chatService = {
    // Send a message to a room
    sendMessage: async (roomId, messageText) => {
        const user = getCurrentUser();
        const messagesRef = ref(database, `rooms/${roomId}/messages`);
        const newMessageRef = push(messagesRef);

        await set(newMessageRef, {
            text: messageText,
            userId: user.id,
            userName: user.name,
            timestamp: Date.now(),
            read: false
        });

        // Update room's last message
        const roomRef = ref(database, `rooms/${roomId}`);
        await set(roomRef, {
            lastMessage: messageText,
            lastMessageTime: Date.now(),
            lastMessageUser: user.name
        });

        return newMessageRef.key;
    },

    // Subscribe to messages in a room (real-time)
    subscribeToMessages: (roomId, callback, limit = 50) => {
        const messagesRef = ref(database, `rooms/${roomId}/messages`);
        const messagesQuery = query(messagesRef, orderByChild('timestamp'), limitToLast(limit));

        onValue(messagesQuery, (snapshot) => {
            const messages = [];
            snapshot.forEach((childSnapshot) => {
                messages.push({
                    id: childSnapshot.key,
                    ...childSnapshot.val()
                });
            });
            callback(messages);
        });

        // Return unsubscribe function
        return () => off(messagesQuery);
    },

    // Get list of available rooms
    getRooms: (callback) => {
        const roomsRef = ref(database, 'rooms');

        onValue(roomsRef, (snapshot) => {
            const rooms = [];
            snapshot.forEach((childSnapshot) => {
                rooms.push({
                    id: childSnapshot.key,
                    ...childSnapshot.val()
                });
            });
            callback(rooms);
        });

        return () => off(roomsRef);
    },

    // Initialize default rooms (call once on app setup)
    initializeDefaultRooms: async () => {
        const roomsRef = ref(database, 'rooms');

        // Create general announcement room
        const generalRoomRef = ref(database, 'rooms/general');
        await set(generalRoomRef, {
            name: '전체 공지',
            type: 'announcement',
            createdAt: Date.now()
        });

        // You can add more default rooms here
        const staff1RoomRef = ref(database, 'rooms/staff-김철수');
        await set(staff1RoomRef, {
            name: '김철수',
            type: '1:1',
            createdAt: Date.now()
        });

        const staff2RoomRef = ref(database, 'rooms/staff-이영희');
        await set(staff2RoomRef, {
            name: '이영희',
            type: '1:1',
            createdAt: Date.now()
        });
    }
};
