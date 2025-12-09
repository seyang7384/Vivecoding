import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getDatabase } from "firebase/database";

// TODO: Replace the following with your app's Firebase project configuration
const firebaseConfig = {
    apiKey: "AIzaSyB17ttZ0WOFch9D6HxsyZMxy0emv29rVgM",
    authDomain: "hospital-os.firebaseapp.com",
    projectId: "hospital-os",
    storageBucket: "hospital-os.firebasestorage.app",
    messagingSenderId: "890996763438",
    appId: "1:890996763438:web:747a4c8d5ce598d31168bf",
    measurementId: "G-68M1Y3XF2Y"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const realtimeDb = getDatabase(app);

export default app;
