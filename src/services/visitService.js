import { db } from '../firebase';
import {
    collection,
    addDoc,
    getDocs,
    doc,
    updateDoc,
    query,
    where,
    serverTimestamp,
    getDoc,
    setDoc
} from 'firebase/firestore';

const VISITS_COLLECTION = 'visits';

export const visitService = {
    /**
     * Get visit record for a specific patient on a specific date
     * @param {string} patientId 
     * @param {string} date (YYYY-MM-DD)
     */
    getVisit: async (patientId, date) => {
        try {
            // Use a composite ID for easier lookup: patientId_date
            const visitId = `${patientId}_${date}`;
            const docRef = doc(db, VISITS_COLLECTION, visitId);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                return { id: docSnap.id, ...docSnap.data() };
            }
            return null;
        } catch (error) {
            console.error("Error fetching visit:", error);
            return null;
        }
    },

    /**
     * Create or update a visit record
     * @param {string} patientId 
     * @param {string} date 
     * @param {object} data - { items: [], totalCost: 0, status: 'treating' }
     */
    saveVisit: async (patientId, date, data) => {
        try {
            const visitId = `${patientId}_${date}`;
            const docRef = doc(db, VISITS_COLLECTION, visitId);

            await setDoc(docRef, {
                patientId,
                date,
                ...data,
                updatedAt: serverTimestamp()
            }, { merge: true });

            return { id: visitId, ...data };
        } catch (error) {
            console.error("Error saving visit:", error);
            throw error;
        }
    },

    /**
     * Add an item (treatment/prescription) to the visit
     */
    addItem: async (patientId, date, item) => {
        try {
            const visit = await visitService.getVisit(patientId, date);
            let items = visit ? (visit.items || []) : [];

            // Add new item
            items.push({
                id: Date.now(), // Simple ID
                ...item
            });

            // Recalculate total cost
            const totalCost = items.reduce((sum, i) => sum + (Number(i.price) || 0), 0);

            await visitService.saveVisit(patientId, date, {
                items,
                totalCost,
                status: visit ? visit.status : 'treating'
            });

            return items;
        } catch (error) {
            console.error("Error adding item to visit:", error);
            throw error;
        }
    },

    /**
     * Remove an item from the visit
     */
    removeItem: async (patientId, date, itemId) => {
        try {
            const visit = await visitService.getVisit(patientId, date);
            if (!visit) return;

            const items = visit.items.filter(i => i.id !== itemId);
            const totalCost = items.reduce((sum, i) => sum + (Number(i.price) || 0), 0);

            await visitService.saveVisit(patientId, date, {
                items,
                totalCost
            });

            return items;
        } catch (error) {
            console.error("Error removing item from visit:", error);
            throw error;
        }
    },

    /**
     * Get all visits for a specific date (for PaymentPage)
     */
    getVisitsByDate: async (date) => {
        try {
            const q = query(
                collection(db, VISITS_COLLECTION),
                where("date", "==", date)
            );
            const snapshot = await getDocs(q);
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.error("Error fetching visits by date:", error);
            return [];
        }
    },

    /**
     * Update visit status (e.g., to 'completed' or 'paid')
     */
    updateStatus: async (patientId, date, status) => {
        try {
            await visitService.saveVisit(patientId, date, { status });
        } catch (error) {
            console.error("Error updating visit status:", error);
            throw error;
        }
    }
};
