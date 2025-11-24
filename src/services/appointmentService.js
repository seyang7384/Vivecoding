import { db } from '../firebase';
import {
    collection,
    addDoc,
    getDocs,
    query,
    where,
    Timestamp
} from 'firebase/firestore';

const COLLECTION_NAME = 'appointments';
const LOCAL_STORAGE_KEY = 'hospital_os_appointments';

// Helper to get local data
const getLocalData = () => {
    const data = localStorage.getItem(LOCAL_STORAGE_KEY);
    return data ? JSON.parse(data) : [];
};

// Helper to save local data
const saveLocalData = (data) => {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
};

// Helper to handle timeouts
const withTimeout = (promise, ms = 2000) => {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            reject(new Error("Firestore operation timed out"));
        }, ms);

        promise
            .then(value => {
                clearTimeout(timer);
                resolve(value);
            })
            .catch(reason => {
                clearTimeout(timer);
                reject(reason);
            });
    });
};

export const appointmentService = {
    // Add appointment
    addAppointment: async (appointmentData) => {
        try {
            const docRef = await withTimeout(addDoc(collection(db, COLLECTION_NAME), {
                ...appointmentData,
                createdAt: Timestamp.now()
            }));
            return { id: docRef.id, ...appointmentData };
        } catch (error) {
            console.warn("Firestore failed or timed out, falling back to localStorage:", error);
            const appointments = getLocalData();
            const newAppointment = {
                id: 'local_' + Date.now(),
                ...appointmentData,
                createdAt: { seconds: Date.now() / 1000 }
            };
            appointments.push(newAppointment);
            saveLocalData(appointments);
            return newAppointment;
        }
    },

    // Get appointments
    getAppointments: async () => {
        try {
            const q = query(collection(db, COLLECTION_NAME));
            const querySnapshot = await withTimeout(getDocs(q));
            return querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } catch (error) {
            console.warn("Firestore failed or timed out, falling back to localStorage:", error);
            return getLocalData();
        }
    }
};
