import {
    collection,
    addDoc,
    getDocs,
    doc,
    getDoc,
    updateDoc,
    query,

    serverTimestamp
} from "firebase/firestore";
import { db } from "../firebase";

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
            const q = query(collection(db, COLLECTION_NAME));
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
    },

    // --- Package Management ---

    // Add a package to a patient
    addPatientPackage: async (patientId, packageData) => {
        try {
            const docRef = doc(db, COLLECTION_NAME, patientId);
            const patientDoc = await getDoc(docRef);

            if (!patientDoc.exists()) throw new Error("Patient not found");

            const currentPackages = patientDoc.data().packages || [];
            const newPackage = {
                id: `pkg_${Date.now()}`,
                ...packageData,
                startDate: new Date().toISOString().split('T')[0],
                status: 'active',
                history: []
            };

            await updateDoc(docRef, {
                packages: [...currentPackages, newPackage],
                updatedAt: serverTimestamp()
            });

            return newPackage;
        } catch (error) {
            console.error("Error adding patient package:", error);
            throw error;
        }
    },

    // Update a specific package for a patient (e.g., record session)
    updatePatientPackage: async (patientId, packageId, updateData) => {
        try {
            const docRef = doc(db, COLLECTION_NAME, patientId);
            const patientDoc = await getDoc(docRef);

            if (!patientDoc.exists()) throw new Error("Patient not found");

            const packages = patientDoc.data().packages || [];
            const updatedPackages = packages.map(pkg =>
                pkg.id === packageId ? { ...pkg, ...updateData } : pkg
            );

            await updateDoc(docRef, {
                packages: updatedPackages,
                updatedAt: serverTimestamp()
            });

            return updatedPackages.find(p => p.id === packageId);
        } catch (error) {
            console.error("Error updating patient package:", error);
            throw error;
        }
    },

    // Delete a package from a patient
    deletePatientPackage: async (patientId, packageId) => {
        try {
            const docRef = doc(db, COLLECTION_NAME, patientId);
            const patientDoc = await getDoc(docRef);

            if (!patientDoc.exists()) throw new Error("Patient not found");

            const packages = patientDoc.data().packages || [];
            const updatedPackages = packages.filter(pkg => pkg.id !== packageId);

            await updateDoc(docRef, {
                packages: updatedPackages,
                updatedAt: serverTimestamp()
            });
        } catch (error) {
            console.error("Error deleting patient package:", error);
            throw error;
        }
    },

    // Revert a session (decrement used count and remove last history)
    revertPackageSession: async (patientId, packageId) => {
        try {
            const docRef = doc(db, COLLECTION_NAME, patientId);
            const patientDoc = await getDoc(docRef);

            if (!patientDoc.exists()) throw new Error("Patient not found");

            const packages = patientDoc.data().packages || [];
            const updatedPackages = packages.map(pkg => {
                if (pkg.id === packageId) {
                    const newUsedCounts = Math.max(0, pkg.usedCounts - 1);
                    const newHistory = [...(pkg.history || [])];
                    if (newHistory.length > 0) {
                        newHistory.pop(); // Remove the last entry
                    }
                    return {
                        ...pkg,
                        usedCounts: newUsedCounts,
                        history: newHistory,
                        status: 'active' // Revert to active if it was completed
                    };
                }
                return pkg;
            });

            await updateDoc(docRef, {
                packages: updatedPackages,
                updatedAt: serverTimestamp()
            });

            return updatedPackages.find(p => p.id === packageId);
        } catch (error) {
            console.error("Error reverting patient package session:", error);
            throw error;
        }
    }
};
