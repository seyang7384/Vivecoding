// Mock inventory service using localStorage
// In production, this would use Firestore

const STORAGE_KEY = 'inventory';

export const inventoryService = {
    // Get all inventory items
    getInventory: async () => {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            return JSON.parse(stored);
        }

        // Return mock data if empty
        const mockData = [
            { id: 1, name: '당귀', currentStock: 50, targetStock: 100, unit: 'g' },
            { id: 2, name: '천궁', currentStock: 30, targetStock: 80, unit: 'g' },
            { id: 3, name: '백작약', currentStock: 120, targetStock: 100, unit: 'g' },
            { id: 4, name: '침 (일회용)', currentStock: 15, targetStock: 50, unit: '개' },
            { id: 5, name: '소독용 알코올', currentStock: 200, targetStock: 300, unit: 'ml' },
            { id: 6, name: '탈지면', currentStock: 80, targetStock: 100, unit: '개' }
        ];

        localStorage.setItem(STORAGE_KEY, JSON.stringify(mockData));
        return mockData;
    },

    // Add new inventory item
    addItem: async (item) => {
        const items = await inventoryService.getInventory();
        const newItem = {
            id: Date.now(),
            ...item
        };

        const updated = [...items, newItem];
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        return newItem;
    },

    // Update inventory item
    updateItem: async (id, updates) => {
        const items = await inventoryService.getInventory();
        const updated = items.map(item =>
            item.id === id ? { ...item, ...updates } : item
        );

        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        return updated.find(item => item.id === id);
    },

    // Delete inventory item
    deleteItem: async (id) => {
        const items = await inventoryService.getInventory();
        const updated = items.filter(item => item.id !== id);

        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        return true;
    },

    // Deduct inventory stock
    deductInventory: async (itemName, quantity) => {
        const items = await inventoryService.getInventory();
        const itemIndex = items.findIndex(item => item.name === itemName);

        if (itemIndex === -1) {
            console.warn(`Inventory item not found: ${itemName}`);
            return false;
        }

        const currentStock = items[itemIndex].currentStock || 0;
        const newStock = Math.max(0, currentStock - quantity);

        items[itemIndex] = {
            ...items[itemIndex],
            currentStock: newStock
        };

        localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
        return true;
    }
};
