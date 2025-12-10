import { db } from '../firebase';
import {
    collection,
    addDoc,
    getDocs,
    query,
    where,
    Timestamp,
    doc,
    updateDoc,
    serverTimestamp
} from 'firebase/firestore';

const RECALL_COLLECTION = 'recall_queue';
const DEFENSE_LOG_COLLECTION = 'defense_logs';

export const defenseService = {
    // --- Recall Queue Management ---

    // Add patient to recall queue (D+3)
    addToRecallQueue: async (patientId, patientName, reason, targetDate, source = 'DEFENSE_FAIL') => {
        try {
            await addDoc(collection(db, RECALL_COLLECTION), {
                patientId,
                patientName,
                reason, // e.g., "Defense 3 Fail", "No-Show"
                targetDate: targetDate, // String 'YYYY-MM-DD'
                source,
                status: 'PENDING', // PENDING, CONTACTED, BOOKED, FAILED
                createdAt: serverTimestamp(),
                notes: []
            });
            console.log(`[Defense] Added to Recall Queue: ${patientName} (${targetDate})`);
        } catch (error) {
            console.error("Failed to add to recall queue:", error);
        }
    },

    // Get recall list for a specific date (or overdue)
    getRecallQueue: async (date) => {
        try {
            // In real app, query by date. For now, get all pending.
            const q = query(collection(db, RECALL_COLLECTION), where("status", "==", "PENDING"));
            const snapshot = await getDocs(q);
            const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            // Filter by date (client-side for simplicity if needed, or exact match)
            // Here we return all pending for demo purposes, or filter logic:
            return list.filter(item => item.targetDate <= date);
        } catch (error) {
            console.error("Failed to get recall queue:", error);
            return [];
        }
    },

    // Update recall status
    updateRecallStatus: async (id, status, note = null) => {
        try {
            const docRef = doc(db, RECALL_COLLECTION, id);
            const updateData = { status, updatedAt: serverTimestamp() };
            if (note) {
                // We can't use arrayUnion easily without importing it, so let's just overwrite or append string for now
                // Or assume note is handled separately. Simple status update:
            }
            await updateDoc(docRef, updateData);
        } catch (error) {
            console.error("Failed to update recall status:", error);
        }
    },

    // --- No-Show Detection ---

    // Get potential no-shows (Appointments > 10 mins past start, no check-in)
    getPotentialNoShows: async (appointments, visits) => {
        const now = new Date();
        const potentialNoShows = [];

        appointments.forEach(app => {
            const appTime = new Date(app.start); // ISO string or Date object
            const diffMins = (now - appTime) / (1000 * 60);

            // If 10 mins passed AND not checked in (not in visits)
            if (diffMins >= 10 && diffMins < 120) { // Check window: 10 mins to 2 hours
                const hasVisited = visits.some(v => v.patientId === app.patientId); // Simplified check
                if (!hasVisited && !app.status) { // Assuming app.status 'completed' or similar exists
                    potentialNoShows.push({
                        ...app,
                        minutesLate: Math.floor(diffMins)
                    });
                }
            }
        });

        return potentialNoShows;
    },

    // --- Defense Logging ---

    logDefenseAction: async (patientId, action, result, details = {}) => {
        try {
            await addDoc(collection(db, DEFENSE_LOG_COLLECTION), {
                patientId,
                action, // e.g., "PROPOSAL", "DEFENSE_1", "PRIORITY_ASSIGN"
                result, // "SUCCESS", "FAIL", "UNCERTAIN"
                details,
                timestamp: serverTimestamp()
            });
            console.log(`[Defense Log] ${action} -> ${result}`);
        } catch (error) {
            console.error("Failed to log defense action:", error);
        }
    },

    // --- Priority Confirmation Check (18:30 Logic) ---
    checkPriorityConfirmations: async () => {
        // This would typically run on a server cron.
        // For client-side simulation, we check logs or local state.
        console.log("[Defense] Checking priority confirmations (18:30 check)...");
        // Mock logic: Find 'PRIORITY_ASSIGN' logs for today with no 'CONFIRM_RECEIVED'
        return [];
    }
};
