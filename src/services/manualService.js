// Mock manual service using localStorage
// In production, this would use Firestore

const STORAGE_KEY = 'manuals';

export const manualService = {
    // Get all manuals
    getManuals: async () => {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            return JSON.parse(stored);
        }

        // Return mock data if empty
        const mockData = [
            {
                id: 1,
                title: '신규 환자 등록 절차',
                content: '1. 환자 관리 메뉴 접속\n2. 신규 환자 등록 버튼 클릭\n3. 필수 정보 입력 (이름, 생년월일, 연락처)\n4. 특이사항 메모 작성\n5. 등록하기 버튼 클릭',
                category: '접수',
                author: '관리자',
                createdAt: Date.now() - 7 * 24 * 60 * 60 * 1000,
                updatedAt: Date.now() - 7 * 24 * 60 * 60 * 1000
            },
            {
                id: 2,
                title: '예약 관리 방법',
                content: '1. 일정 메뉴에서 달력 확인\n2. 예약 추가 버튼 또는 날짜 클릭\n3. 환자명, 시간, 진료 유형 입력\n4. 저장하여 예약 완료\n\n취소 시: 예약을 클릭하여 삭제',
                category: '접수',
                author: '관리자',
                createdAt: Date.now() - 5 * 24 * 60 * 60 * 1000,
                updatedAt: Date.now() - 5 * 24 * 60 * 60 * 1000
            },
            {
                id: 3,
                title: '약재 재고 확인 및 발주',
                content: '매주 월요일 재고 관리 메뉴에서 재고 확인\n\n빨간색 표시된 품목은 즉시 발주 필요\n발주처: 한약재 도매상 (전화 xxx-xxxx-xxxx)\n\n발주 후 입고 시 현재고 수량 업데이트',
                category: '재고관리',
                author: '관리자',
                createdAt: Date.now() - 3 * 24 * 60 * 60 * 1000,
                updatedAt: Date.now() - 3 * 24 * 60 * 60 * 1000
            }
        ];

        localStorage.setItem(STORAGE_KEY, JSON.stringify(mockData));
        return mockData;
    },

    // Get manual by ID
    getManualById: async (id) => {
        const manuals = await manualService.getManuals();
        return manuals.find(m => m.id.toString() === id.toString());
    },

    // Create manual
    createManual: async (manual) => {
        const manuals = await manualService.getManuals();
        const newManual = {
            id: Date.now(),
            ...manual,
            author: '관리자',
            createdAt: Date.now(),
            updatedAt: Date.now()
        };

        const updated = [newManual, ...manuals];
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        return newManual;
    },

    // Update manual
    updateManual: async (id, updates) => {
        const manuals = await manualService.getManuals();
        const updated = manuals.map(manual =>
            manual.id.toString() === id.toString()
                ? { ...manual, ...updates, updatedAt: Date.now() }
                : manual
        );

        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        return updated.find(m => m.id.toString() === id.toString());
    },

    // Delete manual
    deleteManual: async (id) => {
        const manuals = await manualService.getManuals();
        const updated = manuals.filter(m => m.id.toString() !== id.toString());

        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        return true;
    },

    // Search manuals
    searchManuals: async (query) => {
        const manuals = await manualService.getManuals();
        const lowerQuery = query.toLowerCase();

        return manuals.filter(manual =>
            manual.title.toLowerCase().includes(lowerQuery) ||
            manual.content.toLowerCase().includes(lowerQuery) ||
            manual.category.toLowerCase().includes(lowerQuery)
        );
    }
};
