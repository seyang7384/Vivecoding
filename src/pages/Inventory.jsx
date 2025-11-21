import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit2, Trash2, AlertTriangle } from 'lucide-react';
import { inventoryService } from '../services/inventoryService';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';

const Inventory = () => {
    const [inventory, setInventory] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        currentStock: '',
        targetStock: '',
        unit: 'g'
    });

    useEffect(() => {
        loadInventory();
    }, []);

    const loadInventory = async () => {
        const data = await inventoryService.getInventory();
        setInventory(data);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (editingItem) {
            await inventoryService.updateItem(editingItem.id, {
                ...formData,
                currentStock: Number(formData.currentStock),
                targetStock: Number(formData.targetStock)
            });
        } else {
            await inventoryService.addItem({
                ...formData,
                currentStock: Number(formData.currentStock),
                targetStock: Number(formData.targetStock)
            });
        }

        loadInventory();
        closeModal();
    };

    const handleEdit = (item) => {
        setEditingItem(item);
        setFormData({
            name: item.name,
            currentStock: item.currentStock.toString(),
            targetStock: item.targetStock.toString(),
            unit: item.unit
        });
        setIsModalOpen(true);
    };

    const handleDelete = async (id) => {
        if (confirm('정말 삭제하시겠습니까?')) {
            await inventoryService.deleteItem(id);
            loadInventory();
        }
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingItem(null);
        setFormData({ name: '', currentStock: '', targetStock: '', unit: 'g' });
    };

    const filteredInventory = inventory.filter(item =>
        item.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const isLowStock = (item) => item.currentStock < item.targetStock;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">재고 관리</h1>
                    <p className="text-gray-500">약재 및 소모품 재고 현황</p>
                </div>
                <Button onClick={() => setIsModalOpen(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    품목 추가
                </Button>
            </div>

            {/* Search Bar */}
            <div className="bg-white p-4 rounded-xl shadow-sm">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                        type="text"
                        placeholder="품목명으로 검색..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
            </div>

            {/* Low Stock Alert */}
            {inventory.some(isLowStock) && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start space-x-3">
                    <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
                    <div>
                        <h3 className="font-medium text-red-900">재고 부족 알림</h3>
                        <p className="text-sm text-red-700">
                            {inventory.filter(isLowStock).length}개 품목의 재고가 적정 수준 이하입니다.
                        </p>
                    </div>
                </div>
            )}

            {/* Inventory Table */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    품목명
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    현재고
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    적정재고
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    단위
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    상태
                                </th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    관리
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {filteredInventory.map((item) => (
                                <tr
                                    key={item.id}
                                    className={`${isLowStock(item) ? 'bg-red-50' : ''} hover:bg-gray-50 transition-colors`}
                                >
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="font-medium text-gray-900">{item.name}</div>
                                    </td>
                                    <td className={`px-6 py-4 whitespace-nowrap font-semibold ${isLowStock(item) ? 'text-red-600' : 'text-gray-900'
                                        }`}>
                                        {item.currentStock}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-gray-900">
                                        {item.targetStock}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                                        {item.unit}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {isLowStock(item) ? (
                                            <span className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded-full font-medium">
                                                재고 부족
                                            </span>
                                        ) : (
                                            <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full font-medium">
                                                정상
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right space-x-2">
                                        <button
                                            onClick={() => handleEdit(item)}
                                            className="text-blue-600 hover:text-blue-800"
                                        >
                                            <Edit2 className="w-4 h-4 inline" />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(item.id)}
                                            className="text-red-600 hover:text-red-800"
                                        >
                                            <Trash2 className="w-4 h-4 inline" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Add/Edit Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
                        <div className="p-6 border-b border-gray-200">
                            <h3 className="text-lg font-bold text-gray-900">
                                {editingItem ? '품목 수정' : '품목 추가'}
                            </h3>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <Input
                                label="품목명"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                required
                            />
                            <div className="grid grid-cols-2 gap-4">
                                <Input
                                    label="현재고"
                                    type="number"
                                    value={formData.currentStock}
                                    onChange={(e) => setFormData({ ...formData, currentStock: e.target.value })}
                                    required
                                />
                                <Input
                                    label="적정재고"
                                    type="number"
                                    value={formData.targetStock}
                                    onChange={(e) => setFormData({ ...formData, targetStock: e.target.value })}
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">단위</label>
                                <select
                                    value={formData.unit}
                                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="g">g</option>
                                    <option value="ml">ml</option>
                                    <option value="개">개</option>
                                    <option value="박스">박스</option>
                                </select>
                            </div>
                            <div className="pt-4 flex space-x-3">
                                <button
                                    type="button"
                                    onClick={closeModal}
                                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
                                >
                                    취소
                                </button>
                                <Button type="submit" className="flex-1">
                                    {editingItem ? '수정' : '추가'}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Inventory;
