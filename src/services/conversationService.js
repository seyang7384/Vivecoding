import { db } from '../firebase';
import {
    collection,
    addDoc,
    getDocs,
    doc,
    updateDoc,
    query,
    where,
    orderBy,
    serverTimestamp
} from 'firebase/firestore';

const CONVERSATIONS_COLLECTION = 'conversations';

export const conversationService = {
    /**
     * Create a new conversation message
     * @param {object} data - { patientId, patientName, content, type, direction, status }
     * @returns {object} Created message with ID
     */
    createMessage: async (data) => {
        try {
            const docRef = await addDoc(collection(db, CONVERSATIONS_COLLECTION), {
                patientId: data.patientId,
                patientName: data.patientName || '',
                content: data.content,                    // 치료 계획서 내용
                type: data.type || 'kakao',               // 'kakao', 'sms', 'email'
                direction: data.direction || 'outbound',  // 'outbound' (발신), 'inbound' (수신)
                status: data.status || 'draft',           // 'draft' (작성중), 'sent' (발송완료), 'failed' (발송실패)
                createdAt: serverTimestamp(),
                sentAt: null
            });
            console.log('✅ Conversation created:', docRef.id);
            return { id: docRef.id, ...data };
        } catch (error) {
            console.error('Error creating conversation:', error);
            throw error;
        }
    },

    /**
     * Get all draft (pending) messages for desk staff view
     * @returns {array} Array of draft messages
     */
    getDraftMessages: async () => {
        try {
            const q = query(
                collection(db, CONVERSATIONS_COLLECTION),
                where('status', '==', 'draft'),
                orderBy('createdAt', 'desc')
            );
            const snapshot = await getDocs(q);
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.error('Error fetching draft messages:', error);
            return [];
        }
    },

    /**
     * Get messages for a specific patient
     * @param {string} patientId 
     * @returns {array} Array of messages
     */
    getMessagesByPatient: async (patientId) => {
        try {
            const q = query(
                collection(db, CONVERSATIONS_COLLECTION),
                where('patientId', '==', patientId),
                orderBy('createdAt', 'desc')
            );
            const snapshot = await getDocs(q);
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.error('Error fetching patient messages:', error);
            return [];
        }
    },

    /**
     * Update message status
     * @param {string} messageId 
     * @param {string} status - 'draft', 'sent', 'failed'
     */
    updateStatus: async (messageId, status) => {
        try {
            const docRef = doc(db, CONVERSATIONS_COLLECTION, messageId);
            const updateData = { status };
            if (status === 'sent') {
                updateData.sentAt = serverTimestamp();
            }
            await updateDoc(docRef, updateData);
            console.log(`✅ Message ${messageId} status updated to ${status}`);
        } catch (error) {
            console.error('Error updating message status:', error);
            throw error;
        }
    },

    /**
     * Update message content (for editing before send)
     * @param {string} messageId 
     * @param {string} content 
     */
    updateContent: async (messageId, content) => {
        try {
            const docRef = doc(db, CONVERSATIONS_COLLECTION, messageId);
            await updateDoc(docRef, { content });
            console.log(`✅ Message ${messageId} content updated`);
        } catch (error) {
            console.error('Error updating message content:', error);
            throw error;
        }
    },

    /**
     * Mark message as sent
     * @param {string} messageId 
     */
    markAsSent: async (messageId) => {
        await conversationService.updateStatus(messageId, 'sent');
    }
};
