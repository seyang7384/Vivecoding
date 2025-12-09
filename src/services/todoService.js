import {
    collection,
    addDoc,
    getDocs,
    doc,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    serverTimestamp
} from "firebase/firestore";
import { db } from "../lib/firebase";

const COLLECTION_NAME = "todos";

export const todoService = {
    // Add a new todo
    addTodo: async (todo) => {
        try {
            const docRef = await addDoc(collection(db, COLLECTION_NAME), {
                ...todo,
                isCompleted: false,
                createdAt: serverTimestamp()
            });
            return { id: docRef.id, ...todo, isCompleted: false };
        } catch (error) {
            console.error("Error adding todo: ", error);
            throw error;
        }
    },

    // Get todos for a specific role
    getTodos: async (role) => {
        try {
            const q = query(
                collection(db, COLLECTION_NAME),
                where("role", "==", role),
                orderBy("createdAt", "desc")
            );
            const querySnapshot = await getDocs(q);
            return querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } catch (error) {
            console.error("Error getting todos: ", error);
            throw error;
        }
    },

    // Update todo status
    updateTodoStatus: async (id, isCompleted) => {
        try {
            const docRef = doc(db, COLLECTION_NAME, id);
            await updateDoc(docRef, {
                isCompleted: isCompleted,
                updatedAt: serverTimestamp()
            });
        } catch (error) {
            console.error("Error updating todo status: ", error);
            throw error;
        }
    },

    // Delete a todo
    deleteTodo: async (id) => {
        try {
            const docRef = doc(db, COLLECTION_NAME, id);
            await deleteDoc(docRef);
        } catch (error) {
            console.error("Error deleting todo: ", error);
            throw error;
        }
    }
};
