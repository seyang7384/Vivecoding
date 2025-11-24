import { db } from '../lib/firebase';
import { collection, addDoc, query, orderBy, limit, onSnapshot, serverTimestamp } from 'firebase/firestore';

class VoiceLogService {
    constructor() {
        this.collectionName = 'voice_logs';
        this.useFirebase = false; // Default to false until config is verified

        // Check if Firebase is configured
        // This is a simple check, might need more robust validation
        if (db && db._app && db._app.options.apiKey !== "API_KEY") {
            this.useFirebase = true;
            console.log('🔥 Firebase configured. Using Firestore for voice logs.');
        } else {
            console.warn('⚠️ Firebase not configured. Using localStorage fallback.');
        }
    }

    async addLog(logData) {
        const log = {
            ...logData,
            timestamp: Date.now(),
            createdAt: this.useFirebase ? serverTimestamp() : new Date().toISOString()
        };

        if (this.useFirebase) {
            try {
                await addDoc(collection(db, this.collectionName), log);
            } catch (error) {
                console.error('Error adding log to Firestore:', error);
                this.saveToLocal(log); // Fallback
            }
        } else {
            this.saveToLocal(log);
        }
    }

    subscribeLogs(callback) {
        if (this.useFirebase) {
            const q = query(
                collection(db, this.collectionName),
                orderBy('timestamp', 'desc'),
                limit(100)
            );

            return onSnapshot(q, (snapshot) => {
                const logs = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                })).reverse(); // Show newest at bottom usually, but UI might handle it
                callback(logs);
            }, (error) => {
                console.error('Error subscribing to logs:', error);
                this.pollLocal(callback);
            });
        } else {
            return this.pollLocal(callback);
        }
    }

    // LocalStorage Fallback Methods
    saveToLocal(log) {
        const logs = this.getLocalLogs();
        logs.push({ ...log, id: Date.now().toString() + Math.random().toString(36).substr(2, 9) });
        if (logs.length > 200) logs.shift(); // Keep last 200
        localStorage.setItem(this.collectionName, JSON.stringify(logs));
    }

    getLocalLogs() {
        return JSON.parse(localStorage.getItem(this.collectionName) || '[]');
    }

    pollLocal(callback) {
        // Initial load
        let lastData = JSON.stringify(this.getLocalLogs());
        callback(JSON.parse(lastData));

        // Poll every second
        const interval = setInterval(() => {
            const currentData = JSON.stringify(this.getLocalLogs());
            if (currentData !== lastData) {
                lastData = currentData;
                callback(JSON.parse(currentData));
            }
        }, 1000);

        // Return unsubscribe function
        return () => clearInterval(interval);
    }
}

export const voiceLogService = new VoiceLogService();
