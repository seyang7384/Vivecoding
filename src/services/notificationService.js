import { collection, query, where, getDocs, addDoc, updateDoc, doc, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase";

const NOTIFICATIONS_COLLECTION = "notifications";

export const notificationService = {
    // Check for herbal medicine reminders (27 days after start date)
    checkHerbalReminders: async (patients) => {
        const notifications = [];
        const today = new Date();

        patients.forEach(patient => {
            if (patient.herbalStartDate) {
                const startDate = new Date(patient.herbalStartDate);
                // Calculate target date: Start Date + 27 Days
                const targetDate = new Date(startDate);
                targetDate.setDate(startDate.getDate() + 27);

                // Reset time components for accurate date comparison
                const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
                const targetDateOnly = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());

                // Check if today is exactly the target date
                if (todayDate.getTime() === targetDateOnly.getTime()) {
                    notifications.push({
                        type: 'HERBAL_REFILL',
                        patientId: patient.id,
                        patientName: patient.name,
                        message: `${patient.name}님 첩약 재처방 상담 필요 (3일 전)`,
                        isRead: false,
                        createdAt: new Date(),
                        link: `/patients/${patient.id}`
                    });
                }
            }
        });

        return notifications;
    },

    // Get unread notifications (Mock implementation for now)
    getNotifications: async () => {
        // In a real app, fetch from Firestore
        // const q = query(collection(db, NOTIFICATIONS_COLLECTION), where("isRead", "==", false));
        // const snapshot = await getDocs(q);
        // return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Returning mock data for UI testing
        return [
            {
                id: '1',
                type: 'HERBAL_REFILL',
                patientName: '김철수',
                message: '김철수님 첩약 재처방 상담 필요 (3일 전)',
                isRead: false,
                createdAt: new Date(),
                link: '/patients/1'
            }
        ];
    },

    // Mark notification as read
    markAsRead: async (notificationId) => {
        // await updateDoc(doc(db, NOTIFICATIONS_COLLECTION, notificationId), { isRead: true });
        console.log(`Notification ${notificationId} marked as read`);
    }
};
