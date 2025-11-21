import {
    collection,
    addDoc,
    getDocs,
    doc,
    getDoc,
    updateDoc,
    query,
    orderBy,
    serverTimestamp
} from "firebase/firestore";
import { db } from "../lib/firebase";

const COLLECTION_NAME = "patients";

export const patientService = {
    // Add a new patient
    addPatient: async (patientData) => {
        try {
            const docRef = await addDoc(collection(db, COLLECTION_NAME), {
                ...patientData,
                createdAt: serverTimestamp(),
                lastVisit: patientData.lastVisit || null,
            });
            return { id: docRef.id, ...patientData };
        } catch (error) {
            console.error("Error adding patient: ", error);
            throw error;
        }
    },

    // Get all patients
    getPatients: async () => {
        try {
            const q = query(collection(db, COLLECTION_NAME), orderBy("name"));
            const querySnapshot = await getDocs(q);
            return querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } catch (error) {
            console.error("Error getting patients: ", error);
            throw error;
        }
    },

    // Get a single patient by ID
    getPatientById: async (id) => {
        try {
            const docRef = doc(db, COLLECTION_NAME, id);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                return { id: docSnap.id, ...docSnap.data() };
            } else {
                throw new Error("Patient not found");
            }
        } catch (error) {
            console.error("Error getting patient details: ", error);
            throw error;
        }
    },

    // Update patient data
    updatePatient: async (id, updateData) => {
        try {
            const docRef = doc(db, COLLECTION_NAME, id);
            await updateDoc(docRef, {
                ...updateData,
                updatedAt: serverTimestamp()
            });
        } catch (error) {
            console.error("Error updating patient: ", error);
            throw error;
        }
    }
};
