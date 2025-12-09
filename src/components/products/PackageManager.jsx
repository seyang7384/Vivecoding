import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Search, X, ChevronDown, ChevronRight, ArrowUp, ArrowDown } from 'lucide-react';
import Button from '../ui/Button';
import Input from '../ui/Input';
import { productService } from '../../services/productService';

const PackageManager = () => {
    const [packages, setPackages] = useState([]);
    const [treatments, setTreatments] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedCategories, setExpandedCategories] = useState({});

    // Form State
    const [formData, setFormData] = useState({
        name: '',
        price: '',
        category: '',
        description: '',
        items: [], // { name: '', count: 1 }
        order: 0
    });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        const [pData, tData] = await Promise.all([
            productService.getPackages(),
            productService.getTreatments()
        ]);

        // Sort by order first, then name
        const sortedPackages = pData.sort((a, b) => {
            if (a.order !== b.order) return (a.order || 999) - (b.order || 999);
            return a.name.localeCompare(b.name);
        });

        setPackages(sortedPackages);
        setTreatments(tData);
    };

    const handleOpenModal = (item = null) => {
        if (item) {
            setEditingItem(item);
            setFormData({
                name: item.name,
                price: item.price,
                category: item.category,
                description: item.description || '',
                items: item.items || [],
                order: item.order || 0
            });
        } else {
            setEditingItem(null);
            // Default order to last + 1
            const maxOrder = Math.max(...packages.map(p => p.order || 0), 0);
            setFormData({
                name: '',
                price: '',
                category: '',
                description: '',
                items: [],
                order: maxOrder + 1
            });
        }
        setIsModalOpen(true);
    };

    const handleAddItem = () => {
        setFormData(prev => ({
            ...prev,
            items: [...prev.items, { name: treatments[0]?.name || '', count: 1 }]
        }));
    };

    const handleRemoveItem = (index) => {
        setFormData(prev => ({
            ...prev,
            items: prev.items.filter((_, i) => i !== index)
        }));
    };

    const handleItemChange = (index, field, value) => {
        const newItems = [...formData.items];
        newItems[index] = { ...newItems[index], [field]: value };
        setFormData(prev => ({ ...prev, items: newItems }));
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
                await productService.updatePackage(editingItem.id, data);
            } else {
                await productService.addPackage(data);
            }
            loadData();
            setIsModalOpen(false);
        } catch (error) {
            alert('저장 실패: ' + error.message);
        }
    };

    const handleDelete = async (id) => {
        if (confirm('정말 삭제하시겠습니까?')) {
            await productService.deletePackage(id);
            loadData();
        }
    };

    const toggleCategory = (category) => {
        setExpandedCategories(prev => ({
            ...prev,
            [category]: !prev[category]
        }));
    };

    const handleMoveItem = async (item, direction) => {
        const categoryItems = groupedPackages[item.category];
        const currentIndex = categoryItems.findIndex(p => p.id === item.id);
        if (currentIndex === -1) return;

        const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
        if (targetIndex < 0 || targetIndex >= categoryItems.length) return;

        const targetItem = categoryItems[targetIndex];

        // Swap orders
        const itemOrder = item.order || 0;
        const targetOrder = targetItem.order || 0;

        // Optimistic update
        const newPackages = packages.map(p => {
            if (p.id === item.id) return { ...p, order: targetOrder };
            if (p.id === targetItem.id) return { ...p, order: itemOrder };
            return p;
        });

        // Sort again to reflect visual change immediately
        newPackages.sort((a, b) => (a.order || 999) - (b.order || 999));
        setPackages(newPackages);

        try {
            await productService.reorderItems('packages', [
                { id: item.id, order: targetOrder },
                { id: targetItem.id, order: itemOrder }
            ]);
        } catch (error) {
            console.error("Failed to reorder:", error);
            loadData(); // Revert on error
        }
    };

    const handleMoveCategory = async (category, direction, e) => {
        e.stopPropagation(); // Prevent toggling
        const categories = Object.keys(groupedPackages);
        const currentIndex = categories.indexOf(category);
        if (currentIndex === -1) return;

        const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
        if (targetIndex < 0 || targetIndex >= categories.length) return;

        const targetCategory = categories[targetIndex];

        const currentItems = groupedPackages[category];
        const targetItems = groupedPackages[targetCategory];

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
        const newPackages = packages.map(p => {
            const update = updates.find(u => u.id === p.id);
            return update ? { ...p, order: update.order } : p;
        });

        newPackages.sort((a, b) => (a.order || 999) - (b.order || 999));
        setPackages(newPackages);

        try {
            await productService.reorderItems('packages', updates);
        } catch (error) {
            console.error("Failed to reorder categories:", error);
            loadData();
        }
    };

    const filteredPackages = packages.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.category.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Group by category
    const groupedPackages = filteredPackages.reduce((acc, item) => {
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
                        placeholder="패키지 검색..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                </div>
                <Button onClick={() => handleOpenModal()}>
                    <Plus className="w-4 h-4 mr-2" />
                    패키지 추가
                </Button>
            </div>

            <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="w-full divide-y divide-gray-200 table-fixed">
                    <colgroup>
                        <col style={{ width: '30%' }} />
                        <col style={{ width: '40%' }} />
                        <col style={{ width: '15%' }} />
                        <col style={{ width: '15%' }} />
                    </colgroup>
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">패키지명</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">구성</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">가격</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">순서/관리</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {Object.entries(groupedPackages).map(([category, items]) => (
                            <React.Fragment key={category}>
                                <tr
                                    className="bg-gray-100 cursor-pointer hover:bg-gray-200 transition-colors"
                                    onClick={() => toggleCategory(category)}
                                >
                                    <td colSpan="4" className="px-6 py-2 text-sm font-bold text-gray-700">
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
                                        <td className="px-6 py-4 text-sm font-medium text-gray-900 pl-10 align-top break-all">
                                            {item.name}
                                            <div className="text-xs text-gray-400 font-normal whitespace-pre-wrap mt-1 break-all">{item.description}</div>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-500 align-top">
                                            <div className="flex flex-wrap gap-1">
                                                {item.items && item.items.map((i, idx) => (
                                                    <span key={idx} className="inline-block bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-xs mr-1 mb-1">
                                                        {i.name} x{i.count}
                                                    </span>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 align-top">
                                            {Number(item.price).toLocaleString()}원
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium align-top">
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
                                                <button onClick={() => handleOpenModal(item)} className="text-blue-600 hover:text-blue-900 mr-4">
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
                    <div className="bg-white rounded-lg p-6 w-[600px] max-h-[90vh] overflow-y-auto">
                        <h2 className="text-lg font-bold mb-4">{editingItem ? '패키지 수정' : '패키지 추가'}</h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <Input
                                    label="카테고리"
                                    value={formData.category}
                                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                    placeholder="예: 통증, 첩약, 리프팅"
                                    required
                                />
                                <Input
                                    label="패키지명"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    required
                                />
                            </div>

                            <Input
                                label="설명"
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                placeholder="패키지 상세 설명"
                            />

                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <label className="block text-sm font-medium text-gray-700">구성 항목</label>
                                    <button
                                        type="button"
                                        onClick={handleAddItem}
                                        className="text-sm text-blue-600 hover:text-blue-800 flex items-center"
                                    >
                                        <Plus className="w-3 h-3 mr-1" />
                                        항목 추가
                                    </button>
                                </div>
                                <div className="space-y-2 bg-gray-50 p-3 rounded-lg">
                                    {formData.items.map((item, index) => (
                                        <div key={index} className="flex items-center space-x-2">
                                            <select
                                                value={item.name}
                                                onChange={(e) => handleItemChange(index, 'name', e.target.value)}
                                                className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
                                            >
                                                {treatments.map(t => (
                                                    <option key={t.id} value={t.name}>{t.name}</option>
                                                ))}
                                            </select>
                                            <input
                                                type="number"
                                                value={item.count}
                                                onChange={(e) => handleItemChange(index, 'count', Number(e.target.value))}
                                                className="w-20 px-3 py-2 border border-gray-300 rounded-md text-sm"
                                                min="1"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveItem(index)}
                                                className="text-red-500 hover:text-red-700"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))}
                                    {formData.items.length === 0 && (
                                        <div className="text-center text-gray-400 text-sm py-2">구성 항목을 추가해주세요</div>
                                    )}
                                </div>
                            </div>

                            <Input
                                label="총 가격"
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

export default PackageManager;
