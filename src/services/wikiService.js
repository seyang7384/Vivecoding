import { db } from '../firebase';
import { collection, addDoc, getDocs, doc, getDoc, updateDoc, deleteDoc, query, orderBy } from 'firebase/firestore';

const COLLECTION_NAME = 'wiki';
const LOCAL_STORAGE_KEY = 'hospital_os_wiki';

const getLocalData = () => {
    const data = localStorage.getItem(LOCAL_STORAGE_KEY);
    return data ? JSON.parse(data) : [];
};

const saveLocalData = (data) => {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
};

const withTimeout = (promise, ms = 2000) => {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("Timeout")), ms);
        promise.then(
            value => { clearTimeout(timer); resolve(value); },
            reason => { clearTimeout(timer); reject(reason); }
        );
    });
};

export const wikiService = {
    // Add article
    addArticle: async (articleData) => {
        try {
            const docRef = await withTimeout(addDoc(collection(db, COLLECTION_NAME), {
                ...articleData,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }));
            return { id: docRef.id, ...articleData };
        } catch (error) {
            console.warn("Firestore failed, using localStorage:", error);
            const articles = getLocalData();
            const newArticle = {
                id: 'local_' + Date.now(),
                ...articleData,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            articles.push(newArticle);
            saveLocalData(articles);
            return newArticle;
        }
    },

    // Get all articles
    getArticles: async () => {
        try {
            const q = query(collection(db, COLLECTION_NAME), orderBy('updatedAt', 'desc'));
            const querySnapshot = await withTimeout(getDocs(q));
            return querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } catch (error) {
            console.warn("Firestore failed, using localStorage:", error);
            return getLocalData();
        }
    },

    // Get single article
    getArticle: async (id) => {
        try {
            const docRef = doc(db, COLLECTION_NAME, id);
            const docSnap = await withTimeout(getDoc(docRef));
            if (docSnap.exists()) {
                return { id: docSnap.id, ...docSnap.data() };
            }
            throw new Error("Article not found");
        } catch (error) {
            console.warn("Firestore failed, using localStorage:", error);
            const articles = getLocalData();
            return articles.find(a => a.id === id) || null;
        }
    },

    // Update article
    updateArticle: async (id, data) => {
        try {
            const docRef = doc(db, COLLECTION_NAME, id);
            await withTimeout(updateDoc(docRef, {
                ...data,
                updatedAt: new Date().toISOString()
            }));
            return true;
        } catch (error) {
            console.warn("Firestore failed, using localStorage:", error);
            const articles = getLocalData();
            const index = articles.findIndex(a => a.id === id);
            if (index !== -1) {
                articles[index] = {
                    ...articles[index],
                    ...data,
                    updatedAt: new Date().toISOString()
                };
                saveLocalData(articles);
                return true;
            }
            throw error;
        }
    },

    // Delete article
    deleteArticle: async (id) => {
        try {
            await withTimeout(deleteDoc(doc(db, COLLECTION_NAME, id)));
            return true;
        } catch (error) {
            console.warn("Firestore failed, using localStorage:", error);
            const articles = getLocalData();
            const filtered = articles.filter(a => a.id !== id);
            saveLocalData(filtered);
            return true;
        }
    }
};
