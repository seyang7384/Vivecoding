import {
    collection,
    doc,
    setDoc,
    getDoc,
    serverTimestamp
} from "firebase/firestore";
import { db } from "../firebase";

const COLLECTION_NAME = "daily_payments";

export const paymentService = {
    // Save daily log (incomes + expenses)
    saveDailyLog: async (date, data) => {
        try {
            // date format: YYYY-MM-DD
            const docRef = doc(db, COLLECTION_NAME, date);
            await setDoc(docRef, {
                ...data,
                updatedAt: serverTimestamp()
            }, { merge: true });
            return { date, ...data };
        } catch (error) {
            console.error("Error saving daily log: ", error);
            throw error;
        }
    },

    // Get daily log
    getDailyLog: async (date) => {
        try {
            const docRef = doc(db, COLLECTION_NAME, date);
            const docSnap = await getDoc(docRef);

            const defaultData = {
                date,
                incomes: Array(30).fill().map((_, i) => ({
                    id: i + 1,
                    name: '',
                    cash: 0,
                    card: 0,
                    support: 0,
                    transfer: 0,
                    zero: 0,
                    unpaid: 0,
                    memo: ''
                })),
                expenses: [],
                closingData: {
                    prevBalance: 200000,
                    directorDeposit: 0
                }
            };

            if (docSnap.exists()) {
                const data = docSnap.data();
                return {
                    date: docSnap.id,
                    incomes: data.incomes || defaultData.incomes,
                    expenses: data.expenses || defaultData.expenses,
                    closingData: data.closingData || defaultData.closingData
                };
            } else {
                return defaultData;
            }
        } catch (error) {
            console.error("Error getting daily log: ", error);
            throw error;
        }
    }
};
