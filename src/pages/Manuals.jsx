import React, { useState, useEffect } from 'react';
import { Plus, Search, Book, Calendar } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { manualService } from '../services/manualService';
import Button from '../components/ui/Button';

const Manuals = () => {
    const navigate = useNavigate();
    const [manuals, setManuals] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const [newManual, setNewManual] = useState({
        title: '',
        content: '',
        category: '접수'
    });

    useEffect(() => {
        loadManuals();
    }, []);

    const loadManuals = async () => {
        const data = await manualService.getManuals();
        setManuals(data);
    };

    const handleSearch = async () => {
        if (searchTerm.trim()) {
            const results = await manualService.searchManuals(searchTerm);
            setManuals(results);
        } else {
            loadManuals();
        }
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        await manualService.createManual(newManual);
        setIsCreating(false);
        setNewManual({ title: '', content: '', category: '접수' });
        loadManuals();
    };

    const formatDate = (timestamp) => {
        return new Date(timestamp).toLocaleDateString('ko-KR');
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">업무 매뉴얼</h1>
                    <p className="text-gray-500">병원 업무 가이드 및 절차</p>
                </div>
                <Button onClick={() => setIsCreating(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    매뉴얼 작성
                </Button>
            </div>

            {/* Search Bar */}
            <div className="bg-white p-4 rounded-xl shadow-sm">
                <div className="flex space-x-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                        <input
                            type="text"
                            placeholder="제목, 내용, 카테고리로 검색..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    <Button onClick={handleSearch} className="w-auto px-6">
                        검색
                    </Button>
                </div>
            </div>

            {/* Manuals List */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {manuals.map((manual) => (
                    <div
                        key={manual.id}
                        onClick={() => navigate(`/manuals/${manual.id}`)}
                        className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow cursor-pointer border border-gray-100"
                    >
                        <div className="flex items-start space-x-3 mb-3">
                            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                <Book className="w-5 h-5 text-blue-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="font-bold text-gray-900 mb-1 truncate">
                                    {manual.title}
                                </h3>
                                <span className="inline-block px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                                    {manual.category}
                                </span>
                            </div>
                        </div>

                        <p className="text-sm text-gray-600 line-clamp-3 mb-4">
                            {manual.content}
                        </p>

                        <div className="flex items-center text-xs text-gray-500 space-x-4">
                            <div className="flex items-center">
                                <Calendar className="w-3 h-3 mr-1" />
                                {formatDate(manual.updatedAt)}
                            </div>
                            <div>
                                작성자: {manual.author}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {manuals.length === 0 && (
                <div className="text-center py-12 bg-white rounded-xl">
                    <Book className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">등록된 매뉴얼이 없습니다.</p>
                </div>
            )}

            {/* Create Modal */}
            {isCreating && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl">
                        <div className="p-6 border-b border-gray-200">
                            <h3 className="text-lg font-bold text-gray-900">새 매뉴얼 작성</h3>
                        </div>
                        <form onSubmit={handleCreate} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">제목</label>
                                <input
                                    type="text"
                                    value={newManual.title}
                                    onChange={(e) => setNewManual({ ...newManual, title: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">카테고리</label>
                                <select
                                    value={newManual.category}
                                    onChange={(e) => setNewManual({ ...newManual, category: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="접수">접수</option>
                                    <option value="진료">진료</option>
                                    <option value="재고관리">재고관리</option>
                                    <option value="기타">기타</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">내용</label>
                                <textarea
                                    value={newManual.content}
                                    onChange={(e) => setNewManual({ ...newManual, content: e.target.value })}
                                    rows="10"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                                    required
                                ></textarea>
                            </div>

                            <div className="pt-4 flex space-x-3">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsCreating(false);
                                        setNewManual({ title: '', content: '', category: '접수' });
                                    }}
                                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
                                >
                                    취소
                                </button>
                                <Button type="submit" className="flex-1">
                                    작성완료
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Manuals;
