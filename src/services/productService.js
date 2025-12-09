import { db } from '../firebase';
import {
    collection,
    addDoc,
    getDocs,
    doc,
    updateDoc,
    deleteDoc,
    query,
    writeBatch,
    serverTimestamp
} from 'firebase/firestore';

const TREATMENTS_COLLECTION = 'treatments';
const PACKAGES_COLLECTION = 'packages';

// Initial Data Seeding
const INITIAL_TREATMENTS = [
    // 1. 일반약침
    { name: '매선 (1개)', price: 6400, category: '일반약침', order: 1 },
    { name: '봉독 약침', price: 10000, category: '일반약침', order: 2 },
    { name: '황련 약침', price: 10000, category: '일반약침', order: 3 },
    { name: '녹용(CC) 약침', price: 10000, category: '일반약침', order: 4 },
    { name: '마황천오 약침', price: 10000, category: '일반약침', order: 5 },
    { name: '엔오(NO) 약침', price: 10000, category: '일반약침', order: 6 },
    { name: '두개천골태반 약침', price: 10000, category: '일반약침', order: 7 },
    // 2. 특수약침
    { name: '산삼비만 약침', price: 20000, category: '특수약침', order: 8 },
    { name: '태반 약침', price: 18000, category: '특수약침', order: 9 },
    { name: 'PDRN 약침', price: 50000, category: '특수약침', order: 10 },
    { name: '목심부 약침', price: 15000, category: '특수약침', order: 11 },
    { name: '허리심부 약침', price: 20000, category: '특수약침', order: 12 },
    { name: '침도 약침', price: 15000, category: '특수약침', order: 13 },
    { name: '허리침도 약침', price: 20000, category: '특수약침', order: 14 },
    // 3. 복부약침 (Simplified for now)
    { name: '복부약침 (3개 이하)', price: 10000, category: '복부약침', order: 15 },
    { name: '복부약침 (4~7개)', price: 20000, category: '복부약침', order: 16 },
    { name: '복부약침 (특수 추가)', price: 10000, category: '복부약침', order: 17 },
    // 4. 리프팅/피부
    { name: '안면 RF/HIFU', price: 250000, category: '리프팅', order: 18 },
    { name: 'Skin Booster (Standard)', price: 90000, category: '리프팅', order: 19 },
    { name: 'Skin Booster (Premium)', price: 150000, category: '리프팅', order: 20 },
    { name: 'Skin Booster (Signature)', price: 200000, category: '리프팅', order: 21 },
    { name: 'Body RF/HIFU', price: 350000, category: '리프팅', order: 22 },
    // 5. 기타
    { name: '일반 치료 (침+약침+추나)', price: 42000, category: '일반치료', order: 23 },
    { name: '프리미엄 치료 (침+약침2종+추나)', price: 52000, category: '일반치료', order: 24 },
    { name: '다이어트 치료 (침+약침3종+추나)', price: 70000, category: '일반치료', order: 25 },
    { name: '첩약 (1개월)', price: 420000, category: '첩약', order: 26 },
    { name: '첩약 (0.5개월)', price: 210000, category: '첩약', order: 27 },
];

const INITIAL_PACKAGES = [
    // 1. 통증치료 패키지
    {
        name: '통증치료 패키지 (12회)',
        price: 360000,
        description: '침치료+약침치료+추나치료 12회 (10+2)',
        category: '통증',
        items: [{ name: '일반 치료 (침+약침+추나)', count: 12 }],
        order: 1
    },
    {
        name: '통증치료 패키지 (3회+PDRN)',
        price: 108000,
        description: '침치료+약침치료+추나치료 3회 + PDRN(발모 or 스킨부스터)',
        category: '통증',
        items: [
            { name: '일반 치료 (침+약침+추나)', count: 3 },
            { name: 'PDRN 약침', count: 1 }
        ],
        order: 2
    },
    {
        name: '통증치료 패키지 (6회)',
        price: 198000,
        description: '침치료+약침치료+추나치료 6회 (5+1)',
        category: '통증',
        items: [{ name: '일반 치료 (침+약침+추나)', count: 6 }],
        order: 3
    },
    // 4-6. 첩약(Standard)
    {
        name: '첩약(Standard) 1개월',
        price: 420000,
        description: '치료(침+약침+추나) 4.2만원 -> 3.3만원(23% DC)',
        category: '첩약',
        items: [{ name: '첩약 (1개월)', count: 1 }],
        order: 4
    },
    {
        name: '첩약(Standard) 3개월',
        price: 1140000,
        description: '첩약(+0.5개월 free) + [치료(침+약침+추나) 4.2만원 -> 2.97만원(33% DC)]',
        category: '첩약',
        items: [
            { name: '첩약 (1개월)', count: 3 },
            { name: '첩약 (0.5개월)', count: 1 }
        ],
        order: 5
    },
    {
        name: '첩약(Standard) 6개월',
        price: 2160000,
        description: '첩약(+1개월 free) + [치료(침+약침+추나) 4.2만원 -> 2.8만원(38% DC)]',
        category: '첩약',
        items: [
            { name: '첩약 (1개월)', count: 7 }
        ],
        order: 6
    },
    // 7-15. 첩약(Premium)
    {
        name: '첩약(Premium) 1개월 (1단계)',
        price: 500000,
        description: '치료(침+약침+추나) 5.2만원(약침 2종) -> 4.4만원 / 4.2만원(약침 1종) -> 3.4만원',
        category: '첩약',
        items: [{ name: '첩약 (1개월)', count: 1 }],
        order: 7
    },
    {
        name: '첩약(Premium) 1개월 (2단계)',
        price: 600000,
        description: '치료(침+약침+추나) 5.2만원(약침 2종) -> 4.4만원 / 4.2만원(약침 1종) -> 3.4만원',
        category: '첩약',
        items: [{ name: '첩약 (1개월)', count: 1 }],
        order: 8
    },
    {
        name: '첩약(Premium) 1개월 (3단계)',
        price: 700000,
        description: '치료(침+약침+추나) 5.2만원(약침 2종) -> 4.4만원 / 4.2만원(약침 1종) -> 3.4만원',
        category: '첩약',
        items: [{ name: '첩약 (1개월)', count: 1 }],
        order: 9
    },
    {
        name: '첩약(Premium) 3개월 (1단계)',
        price: 1450000,
        description: '첩약(+0.5개월 free) + [치료(침+약침+추나) 5.2만원(약침 2종) -> 3.7만원 / 4.2만원(약침 1종) -> 3.06만원]',
        category: '첩약',
        items: [{ name: '첩약 (1개월)', count: 3 }, { name: '첩약 (0.5개월)', count: 1 }],
        order: 10
    },
    {
        name: '첩약(Premium) 3개월 (2단계)',
        price: 1680000,
        description: '첩약(+0.5개월 free) + [치료(침+약침+추나) 5.2만원(약침 2종) -> 3.7만원 / 4.2만원(약침 1종) -> 3.06만원]',
        category: '첩약',
        items: [{ name: '첩약 (1개월)', count: 3 }, { name: '첩약 (0.5개월)', count: 1 }],
        order: 11
    },
    {
        name: '첩약(Premium) 3개월 (3단계)',
        price: 1900000,
        description: '첩약(+0.5개월 free) + [치료(침+약침+추나) 5.2만원(약침 2종) -> 3.7만원 / 4.2만원(약침 1종) -> 3.06만원]',
        category: '첩약',
        items: [{ name: '첩약 (1개월)', count: 3 }, { name: '첩약 (0.5개월)', count: 1 }],
        order: 12
    },
    {
        name: '첩약(Premium) 6개월 (1단계)',
        price: 3120000,
        description: '첩약(+1개월 free) + [치료(침+약침+추나) 5.2만원(약침 2종) -> 3.3만원 / 4.2만원(약침 1종) -> 2.8만원]',
        category: '첩약',
        items: [{ name: '첩약 (1개월)', count: 7 }],
        order: 13
    },
    {
        name: '첩약(Premium) 6개월 (2단계)',
        price: 3600000,
        description: '첩약(+1개월 free) + [치료(침+약침+추나) 5.2만원(약침 2종) -> 3.3만원 / 4.2만원(약침 1종) -> 2.8만원]',
        category: '첩약',
        items: [{ name: '첩약 (1개월)', count: 7 }],
        order: 14
    },
    {
        name: '첩약(Premium) 6개월 (3단계)',
        price: 4080000,
        description: '첩약(+1개월 free) + [치료(침+약침+추나) 5.2만원(약침 2종) -> 3.3만원 / 4.2만원(약침 1종) -> 2.8만원]',
        category: '첩약',
        items: [{ name: '첩약 (1개월)', count: 7 }],
        order: 15
    },
    // 16-18. 다이어트 첩약(Standard)
    {
        name: '다이어트 첩약(Standard) 1개월',
        price: 420000,
        description: '치료(침+약침+추나) 7만원(약침 3종: 산삼비만약침+마황천오약침+OB) -> 6.4만원(17% DC)\n/ 5.2만원(약침 2종: 마황천오약침+OB) -> 4.4만원(17% DC) / 4.2만원(약침 1종: 마황천오약침 or OB) -> 3.4만원(17% DC)',
        category: '첩약',
        items: [{ name: '첩약 (1개월)', count: 1 }],
        order: 16
    },
    {
        name: '다이어트 첩약(Standard) 3개월',
        price: 1140000,
        description: '첩약(+0.5개월 free) + [치료(침+약침+추나) 7만원(약침 3종: 산삼비만약침+마황천오약침+OB) -> 5.44만원(32% DC)\n/ 5.2만원(약침 2종: 마황천오약침+OB) -> 3.7만원(32% DC) / 4.2만원(약침 1종: 마황천오약침 or OB) -> 3.06만원(27% DC)]',
        category: '첩약',
        items: [{ name: '첩약 (1개월)', count: 3 }, { name: '첩약 (0.5개월)', count: 1 }],
        order: 17
    },
    {
        name: '다이어트 첩약(Standard) 6개월',
        price: 2160000,
        description: '첩약(+1개월 free) + [치료(침+약침+추나) 7만원(약침 3종: 산삼비만약침+마황천오약침+OB) -> 4.8만원(42% DC)\n/ 5.2만원(약침 2종: 마황천오약침+OB) -> 3.3만원(42% DC) / 4.2만원(약침 1종: 마황천오약침 or OB) -> 2.8만원(37% DC)]',
        category: '첩약',
        items: [{ name: '첩약 (1개월)', count: 7 }],
        order: 18
    },
    // 19. 특수약침 패키지
    {
        name: 'PDRN 약침 (6회)',
        price: 270000,
        description: '5+1회',
        category: '특수약침',
        items: [{ name: 'PDRN 약침', count: 6 }],
        order: 19
    },
    {
        name: 'PDRN 약침 (12회)',
        price: 500000,
        description: '10+2회',
        category: '특수약침',
        items: [{ name: 'PDRN 약침', count: 12 }],
        order: 20
    },
    {
        name: '산삼비만 약침 (6회)',
        price: 110000,
        description: '5+1회',
        category: '특수약침',
        items: [{ name: '산삼비만 약침', count: 6 }],
        order: 21
    },
    {
        name: '산삼비만 약침 (12회)',
        price: 200000,
        description: '10+2회',
        category: '특수약침',
        items: [{ name: '산삼비만 약침', count: 12 }],
        order: 22
    },
    {
        name: '태반 약침 (6회)',
        price: 100000,
        description: '5+1회',
        category: '특수약침',
        items: [{ name: '태반 약침', count: 6 }],
        order: 23
    },
    {
        name: '태반 약침 (12회)',
        price: 180000,
        description: '10+2회',
        category: '특수약침',
        items: [{ name: '태반 약침', count: 12 }],
        order: 24
    },
    {
        name: '심부 봉독 약침 (6회)',
        price: 110000,
        description: '5+1회',
        category: '특수약침',
        items: [{ name: '봉독 약침', count: 6 }],
        order: 25
    },
    {
        name: '심부 봉독 약침 (12회)',
        price: 200000,
        description: '10+2회',
        category: '특수약침',
        items: [{ name: '봉독 약침', count: 12 }],
        order: 26
    },
    {
        name: '침도 약침 (15회)',
        price: 210000,
        description: '14+1회',
        category: '특수약침',
        items: [{ name: '침도 약침', count: 15 }],
        order: 27
    },
    // 28. 매선 패키지
    {
        name: '매선 전신 (100개)',
        price: 640000,
        description: '1회',
        category: '매선',
        items: [{ name: '매선 (1개)', count: 100 }],
        order: 28
    },
    {
        name: '매선 전신 (500개)',
        price: 2560000,
        description: '5회 (4+1)',
        category: '매선',
        items: [{ name: '매선 (1개)', count: 500 }],
        order: 29
    },
    {
        name: '매선 전신 (1100개)',
        price: 5120000,
        description: '11회 (8+3)',
        category: '매선',
        items: [{ name: '매선 (1개)', count: 1100 }],
        order: 30
    },
    // 31. 안면 RF/HIFU
    // 1) 6주 Core Plan
    {
        name: '6주 Core Plan (Standard)',
        price: 840000,
        description: 'RF/HIFU 3회 + Skin booster(Std) 3회 (1+2 free)',
        category: '리프팅',
        items: [
            { name: '안면 RF/HIFU', count: 3 },
            { name: 'Skin Booster (Standard)', count: 3 }
        ],
        order: 31
    },
    {
        name: '6주 Core Plan (Premium)',
        price: 900000,
        description: 'RF/HIFU 3회 + Skin booster(Prem) 3회 (1+2 free)',
        category: '리프팅',
        items: [
            { name: '안면 RF/HIFU', count: 3 },
            { name: 'Skin Booster (Premium)', count: 3 }
        ],
        order: 32
    },
    {
        name: '6주 Core Plan (Signature)',
        price: 950000,
        description: 'RF/HIFU 3회 + Skin booster(Sig) 3회 (1+2 free)',
        category: '리프팅',
        items: [
            { name: '안면 RF/HIFU', count: 3 },
            { name: 'Skin Booster (Signature)', count: 3 }
        ],
        order: 33
    },
    // 2) 8주 Standard Plan
    {
        name: '8주 Standard Plan (Standard)',
        price: 1180000,
        description: 'RF/HIFU 4회 + Skin booster(Std) 4회 (2+2 free)',
        category: '리프팅',
        items: [
            { name: '안면 RF/HIFU', count: 4 },
            { name: 'Skin Booster (Standard)', count: 4 }
        ],
        order: 34
    },
    {
        name: '8주 Standard Plan (Premium)',
        price: 1300000,
        description: 'RF/HIFU 4회 + Skin booster(Prem) 4회 (2+2 free)',
        category: '리프팅',
        items: [
            { name: '안면 RF/HIFU', count: 4 },
            { name: 'Skin Booster (Premium)', count: 4 }
        ],
        order: 35
    },
    {
        name: '8주 Standard Plan (Signature)',
        price: 1400000,
        description: 'RF/HIFU 4회 + Skin booster(Sig) 4회 (2+2 free)',
        category: '리프팅',
        items: [
            { name: '안면 RF/HIFU', count: 4 },
            { name: 'Skin Booster (Signature)', count: 4 }
        ],
        order: 36
    },
    // 3) 12주 Intensive Plan
    {
        name: '12주 Intensive Plan (Standard)',
        price: 1520000,
        description: 'RF/HIFU 6회(5+1) + Skin booster(Std) 6회 (3+3 free)',
        category: '리프팅',
        items: [
            { name: '안면 RF/HIFU', count: 6 },
            { name: 'Skin Booster (Standard)', count: 6 }
        ],
        order: 37
    },
    {
        name: '12주 Intensive Plan (Premium)',
        price: 1700000,
        description: 'RF/HIFU 6회(5+1) + Skin booster(Prem) 6회 (3+3 free)',
        category: '리프팅',
        items: [
            { name: '안면 RF/HIFU', count: 6 },
            { name: 'Skin Booster (Premium)', count: 6 }
        ],
        order: 38
    },
    {
        name: '12주 Intensive Plan (Signature)',
        price: 1850000,
        description: 'RF/HIFU 6회(5+1) + Skin booster(Sig) 6회 (3+3 free)',
        category: '리프팅',
        items: [
            { name: '안면 RF/HIFU', count: 6 },
            { name: 'Skin Booster (Signature)', count: 6 }
        ],
        order: 39
    },
    // 40. 바디 RF/HIFU
    {
        name: 'Body Core Plan',
        price: 1050000,
        description: 'Body RF/HIFU 4회 (3+1)',
        category: '리프팅',
        items: [{ name: 'Body RF/HIFU', count: 4 }],
        order: 40
    },
    {
        name: 'Body Intensive Plan',
        price: 1750000,
        description: 'Body RF/HIFU 7회 (5+1)',
        category: '리프팅',
        items: [{ name: 'Body RF/HIFU', count: 7 }],
        order: 41
    }
];

export const productService = {
    // --- Treatments ---
    getTreatments: async () => {
        try {
            const q = query(collection(db, TREATMENTS_COLLECTION));
            const snapshot = await getDocs(q);
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.error("Error fetching treatments:", error);
            return [];
        }
    },

    addTreatment: async (data) => {
        try {
            const docRef = await addDoc(collection(db, TREATMENTS_COLLECTION), {
                ...data,
                createdAt: serverTimestamp()
            });
            return { id: docRef.id, ...data };
        } catch (error) {
            console.error("Error adding treatment:", error);
            throw error;
        }
    },

    updateTreatment: async (id, data) => {
        try {
            const docRef = doc(db, TREATMENTS_COLLECTION, id);
            await updateDoc(docRef, {
                ...data,
                updatedAt: serverTimestamp()
            });
            return { id, ...data };
        } catch (error) {
            console.error("Error updating treatment:", error);
            throw error;
        }
    },

    deleteTreatment: async (id) => {
        try {
            await deleteDoc(doc(db, TREATMENTS_COLLECTION, id));
            return id;
        } catch (error) {
            console.error("Error deleting treatment:", error);
            throw error;
        }
    },

    // --- Packages ---
    getPackages: async () => {
        try {
            const q = query(collection(db, PACKAGES_COLLECTION));
            const snapshot = await getDocs(q);
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.error("Error fetching packages:", error);
            return [];
        }
    },

    addPackage: async (data) => {
        try {
            const docRef = await addDoc(collection(db, PACKAGES_COLLECTION), {
                ...data,
                createdAt: serverTimestamp()
            });
            return { id: docRef.id, ...data };
        } catch (error) {
            console.error("Error adding package:", error);
            throw error;
        }
    },

    updatePackage: async (id, data) => {
        try {
            const docRef = doc(db, PACKAGES_COLLECTION, id);
            await updateDoc(docRef, {
                ...data,
                updatedAt: serverTimestamp()
            });
            return { id, ...data };
        } catch (error) {
            console.error("Error updating package:", error);
            throw error;
        }
    },

    deletePackage: async (id) => {
        try {
            await deleteDoc(doc(db, PACKAGES_COLLECTION, id));
            return id;
        } catch (error) {
            console.error("Error deleting package:", error);
            throw error;
        }
    },

    // --- Reordering ---
    reorderItems: async (type, items) => {
        // type: 'treatments' or 'packages'
        const collectionName = type === 'treatments' ? TREATMENTS_COLLECTION : PACKAGES_COLLECTION;
        const batch = writeBatch(db);

        try {
            items.forEach((item) => {
                const docRef = doc(db, collectionName, item.id);
                batch.update(docRef, { order: item.order });
            });
            await batch.commit();
        } catch (error) {
            console.error("Error reordering items:", error);
            throw error;
        }
    },

    // --- Seeding ---
    seedInitialData: async () => {
        try {
            const batch = writeBatch(db);
            let hasUpdates = false;

            // 1. Clean up duplicates first
            const tSnapshot = await getDocs(collection(db, TREATMENTS_COLLECTION));
            const tMap = {};
            tSnapshot.docs.forEach(doc => {
                const data = doc.data();
                if (!tMap[data.name]) tMap[data.name] = [];
                tMap[data.name].push(doc.id);
            });

            for (const name in tMap) {
                if (tMap[name].length > 1) {
                    const [keep, ...remove] = tMap[name];
                    remove.forEach(id => {
                        batch.delete(doc(db, TREATMENTS_COLLECTION, id));
                        hasUpdates = true;
                    });
                }
            }

            const pSnapshot = await getDocs(collection(db, PACKAGES_COLLECTION));
            const pMap = {};
            pSnapshot.docs.forEach(doc => {
                const data = doc.data();
                if (!pMap[data.name]) pMap[data.name] = [];
                pMap[data.name].push(doc.id);
            });

            for (const name in pMap) {
                if (pMap[name].length > 1) {
                    const [keep, ...remove] = pMap[name];
                    remove.forEach(id => {
                        batch.delete(doc(db, PACKAGES_COLLECTION, id));
                        hasUpdates = true;
                    });
                }
            }

            if (hasUpdates) {
                await batch.commit();
                console.log("Duplicates removed.");
            }

            // 2. Add missing items or update order
            const newBatch = writeBatch(db);
            let hasNewItems = false;

            const tSnapshot2 = await getDocs(collection(db, TREATMENTS_COLLECTION));
            const tMap2 = {};
            tSnapshot2.docs.forEach(d => tMap2[d.data().name] = d.id);

            INITIAL_TREATMENTS.forEach(item => {
                if (!tMap2[item.name]) {
                    const docRef = doc(collection(db, TREATMENTS_COLLECTION));
                    newBatch.set(docRef, { ...item, createdAt: serverTimestamp() });
                    hasNewItems = true;
                } else {
                    // Update all fields for existing items
                    const docRef = doc(db, TREATMENTS_COLLECTION, tMap2[item.name]);
                    newBatch.update(docRef, {
                        price: item.price,
                        category: item.category,
                        order: item.order
                    });
                    hasNewItems = true;
                }
            });

            const pSnapshot2 = await getDocs(collection(db, PACKAGES_COLLECTION));
            const pMap2 = {};
            pSnapshot2.docs.forEach(d => pMap2[d.data().name] = d.id);

            INITIAL_PACKAGES.forEach(item => {
                if (!pMap2[item.name]) {
                    const docRef = doc(collection(db, PACKAGES_COLLECTION));
                    newBatch.set(docRef, { ...item, createdAt: serverTimestamp() });
                    hasNewItems = true;
                } else {
                    // Update all fields for existing items
                    const docRef = doc(db, PACKAGES_COLLECTION, pMap2[item.name]);
                    newBatch.update(docRef, {
                        price: item.price,
                        category: item.category,
                        description: item.description,
                        items: item.items,
                        order: item.order
                    });
                    hasNewItems = true;
                }
            });

            if (hasNewItems) {
                await newBatch.commit();
                console.log("Data seeded and updated.");
            } else {
                console.log("Data is up to date.");
            }

        } catch (error) {
            console.error("Error seeding data:", error);
        }
    }
};
