import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Search, ChevronDown, ChevronRight, ArrowUp, ArrowDown } from 'lucide-react';
import Button from '../ui/Button';
import Input from '../ui/Input';
import { productService } from '../../services/productService';

const TreatmentManager = () => {
    const [treatments, setTreatments] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [formData, setFormData] = useState({ name: '', price: '', category: '', order: 0 });
    const [expandedCategories, setExpandedCategories] = useState({});

    useEffect(() => {
        loadTreatments();
    }, []);

    const loadTreatments = async () => {
        const data = await productService.getTreatments();
        // Sort by order first, then name
        const sortedData = data.sort((a, b) => {
            if (a.order !== b.order) return (a.order || 999) - (b.order || 999);
            return a.name.localeCompare(b.name);
        });
        setTreatments(sortedData);
    };

    const handleOpenModal = (item = null) => {
        if (item) {
            setEditingItem(item);
            setFormData({
                name: item.name,
                price: item.price,
                category: item.category,
                order: item.order || 0
            });
        } else {
            setEditingItem(null);
            // Default order to last + 1
            const maxOrder = Math.max(...treatments.map(t => t.order || 0), 0);
            setFormData({ name: '', price: '', category: '', order: maxOrder + 1 });
        }
        setIsModalOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const data = {
                ...formData,
                price: Number(formData.price),
                order: Number(formData.order)
            };

            if (editingItem) {
                await productService.updateTreatment(editingItem.id, data);
            } else {
                await productService.addTreatment(data);
            }
            loadTreatments();
            setIsModalOpen(false);
        } catch (error) {
            alert('저장 실패: ' + error.message);
        }
    };

    const handleDelete = async (id) => {
        if (confirm('정말 삭제하시겠습니까?')) {
            await productService.deleteTreatment(id);
            loadTreatments();
        }
    };

    const toggleCategory = (category) => {
        setExpandedCategories(prev => ({
            ...prev,
            [category]: !prev[category]
        }));
    };

    const handleMoveItem = async (item, direction) => {
        const categoryItems = groupedTreatments[item.category];
        const currentIndex = categoryItems.findIndex(t => t.id === item.id);
        if (currentIndex === -1) return;

        const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
        if (targetIndex < 0 || targetIndex >= categoryItems.length) return;

        const targetItem = categoryItems[targetIndex];

        // Swap orders
        const itemOrder = item.order || 0;
        const targetOrder = targetItem.order || 0;

        // Optimistic update
        const newTreatments = treatments.map(t => {
            if (t.id === item.id) return { ...t, order: targetOrder };
            if (t.id === targetItem.id) return { ...t, order: itemOrder };
            return t;
        });

        // Sort again to reflect visual change immediately
        newTreatments.sort((a, b) => (a.order || 999) - (b.order || 999));
        setTreatments(newTreatments);

        try {
            await productService.reorderItems('treatments', [
                { id: item.id, order: targetOrder },
                { id: targetItem.id, order: itemOrder }
            ]);
        } catch (error) {
            console.error("Failed to reorder:", error);
            loadTreatments(); // Revert on error
        }
    };

    const handleMoveCategory = async (category, direction, e) => {
        e.stopPropagation(); // Prevent toggling
        const categories = Object.keys(groupedTreatments);
        const currentIndex = categories.indexOf(category);
        if (currentIndex === -1) return;

        const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
        if (targetIndex < 0 || targetIndex >= categories.length) return;

        const targetCategory = categories[targetIndex];

        const currentItems = groupedTreatments[category];
        const targetItems = groupedTreatments[targetCategory];

        // Collect all orders involved
        const allItems = [...currentItems, ...targetItems];
        const allOrders = allItems.map(i => i.order || 0).sort((a, b) => a - b);

        const updates = [];

        if (direction === 'up') {
            // Current category takes the first set of orders
            currentItems.forEach((item, idx) => {
                updates.push({ id: item.id, order: allOrders[idx] });
            });
            // Target category takes the remaining orders
            targetItems.forEach((item, idx) => {
                updates.push({ id: item.id, order: allOrders[currentItems.length + idx] });
            });
        } else {
            // Target category takes the first set of orders
            targetItems.forEach((item, idx) => {
                updates.push({ id: item.id, order: allOrders[idx] });
            });
            // Current category takes the remaining orders
            currentItems.forEach((item, idx) => {
                updates.push({ id: item.id, order: allOrders[targetItems.length + idx] });
            });
        }

        // Optimistic update
        const newTreatments = treatments.map(t => {
            const update = updates.find(u => u.id === t.id);
            return update ? { ...t, order: update.order } : t;
        });

        newTreatments.sort((a, b) => (a.order || 999) - (b.order || 999));
        setTreatments(newTreatments);

        try {
            await productService.reorderItems('treatments', updates);
        } catch (error) {
            console.error("Failed to reorder categories:", error);
            loadTreatments();
        }
    };

    const filteredTreatments = treatments.filter(t =>
        t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.category.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Group by category
    const groupedTreatments = filteredTreatments.reduce((acc, item) => {
        const cat = item.category || '기타';
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(item);
        return acc;
    }, {});

    return (
        <div className="p-4">
            <div className="flex justify-between items-center mb-6">
                <div className="relative w-64">
                    <Search className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" />
                    <input
                        type="text"
                        placeholder="시술 검색..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                </div>
                <Button onClick={() => handleOpenModal()}>
                    <Plus className="w-4 h-4 mr-2" />
                    시술 추가
                </Button>
            </div>

            <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="w-full divide-y divide-gray-200 table-fixed">
                    <colgroup>
                        <col style={{ width: '40%' }} />
                        <col style={{ width: '30%' }} />
                        <col style={{ width: '30%' }} />
                    </colgroup>
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">시술명</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">가격</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">순서/관리</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {Object.entries(groupedTreatments).map(([category, items]) => (
                            <React.Fragment key={category}>
                                <tr
                                    className="bg-gray-100 cursor-pointer hover:bg-gray-200 transition-colors"
                                    onClick={() => toggleCategory(category)}
                                >
                                    <td colSpan="3" className="px-6 py-2 text-sm font-bold text-gray-700">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center">
                                                {expandedCategories[category] ? (
                                                    <ChevronDown className="w-4 h-4 mr-2 text-gray-500" />
                                                ) : (
                                                    <ChevronRight className="w-4 h-4 mr-2 text-gray-500" />
                                                )}
                                                {category}
                                                <span className="ml-2 text-xs font-normal text-gray-500">({items.length})</span>
                                            </div>
                                            <div className="flex items-center space-x-2 mr-4">
                                                <button
                                                    onClick={(e) => handleMoveCategory(category, 'up', e)}
                                                    className="text-gray-400 hover:text-gray-600 p-1 bg-white rounded shadow-sm"
                                                    title="카테고리 위로 이동"
                                                >
                                                    <ArrowUp className="w-3 h-3" />
                                                </button>
                                                <button
                                                    onClick={(e) => handleMoveCategory(category, 'down', e)}
                                                    className="text-gray-400 hover:text-gray-600 p-1 bg-white rounded shadow-sm"
                                                    title="카테고리 아래로 이동"
                                                >
                                                    <ArrowDown className="w-3 h-3" />
                                                </button>
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                                {expandedCategories[category] && items.map((item, index) => (
                                    <tr key={item.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 text-sm font-medium text-gray-900 pl-10 break-all">
                                            {item.name}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                                            {Number(item.price).toLocaleString()}원
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <div className="flex items-center justify-end space-x-2">
                                                <button
                                                    onClick={() => handleMoveItem(item, 'up')}
                                                    className="text-gray-400 hover:text-gray-600 p-1"
                                                    title="위로 이동"
                                                >
                                                    <ArrowUp className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleMoveItem(item, 'down')}
                                                    className="text-gray-400 hover:text-gray-600 p-1 mr-2"
                                                    title="아래로 이동"
                                                >
                                                    <ArrowDown className="w-4 h-4" />
                                                </button>
                                                <button onClick={() => handleOpenModal(item)} className="text-blue-600 hover:text-blue-900 mr-2">
                                                    <Edit className="w-4 h-4" />
                                                </button>
                                                <button onClick={() => handleDelete(item.id)} className="text-red-600 hover:text-red-900">
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </React.Fragment>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 w-96">
                        <h2 className="text-lg font-bold mb-4">{editingItem ? '시술 수정' : '시술 추가'}</h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <Input
                                label="카테고리"
                                value={formData.category}
                                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                placeholder="예: 일반약침, 특수약침"
                                required
                            />
                            <Input
                                label="시술명"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                required
                            />
                            <Input
                                label="가격"
                                type="number"
                                value={formData.price}
                                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                                required
                            />
                            <Input
                                label="순서 (정렬용)"
                                type="number"
                                value={formData.order}
                                onChange={(e) => setFormData({ ...formData, order: e.target.value })}
                                placeholder="숫자가 작을수록 먼저 표시됩니다"
                            />
                            <div className="flex justify-end space-x-2 mt-6">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
                                >
                                    취소
                                </button>
                                <Button type="submit">저장</Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TreatmentManager;
