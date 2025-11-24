import React, { useState, useEffect } from 'react';
import { Book, Plus, Edit2, Trash2, Search, ArrowLeft, Save, X } from 'lucide-react';
import { wikiService } from '../services/wikiService';

const WikiPage = () => {
    const [articles, setArticles] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [viewMode, setViewMode] = useState('list'); // 'list', 'view', 'edit'
    const [selectedArticle, setSelectedArticle] = useState(null);
    const [formData, setFormData] = useState({
        title: '',
        content: '',
        author: '김의사'
    });

    useEffect(() => {
        loadArticles();
    }, []);

    const loadArticles = async () => {
        const data = await wikiService.getArticles();
        setArticles(data);
    };

    const handleCreate = () => {
        setSelectedArticle(null);
        setFormData({ title: '', content: '', author: '김의사' });
        setViewMode('edit');
    };

    const handleEdit = async (id) => {
        const article = await wikiService.getArticle(id);
        setSelectedArticle(article);
        setFormData({
            title: article.title,
            content: article.content,
            author: article.author
        });
        setViewMode('edit');
    };

    const handleView = async (id) => {
        const article = await wikiService.getArticle(id);
        setSelectedArticle(article);
        setViewMode('view');
    };

    const handleSave = async () => {
        if (selectedArticle) {
            await wikiService.updateArticle(selectedArticle.id, formData);
        } else {
            await wikiService.addArticle(formData);
        }
        setViewMode('list');
        loadArticles();
    };

    const handleDelete = async (id) => {
        if (confirm('정말 삭제하시겠습니까?')) {
            await wikiService.deleteArticle(id);
            if (selectedArticle?.id === id) {
                setViewMode('list');
            }
            loadArticles();
        }
    };

    const filteredArticles = articles.filter(article =>
        article.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        article.content.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (viewMode === 'edit') {
        return (
            <div>
                <button
                    onClick={() => setViewMode('list')}
                    className="flex items-center text-gray-600 hover:text-gray-900 mb-6"
                >
                    <ArrowLeft size={20} className="mr-2" />
                    목록으로 돌아가기
                </button>

                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                    <h2 className="text-xl font-bold mb-6">{selectedArticle ? '매뉴얼 수정' : '새 매뉴얼 작성'}</h2>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">제목</label>
                            <input
                                type="text"
                                value={formData.title}
                                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                placeholder="매뉴얼 제목을 입력하세요"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">내용</label>
                            <textarea
                                rows="15"
                                value={formData.content}
                                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 resize-none"
                                placeholder="매뉴얼 내용을 입력하세요"
                            />
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setViewMode('list')}
                                className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200"
                            >
                                <X size={18} />
                                취소
                            </button>
                            <button
                                onClick={handleSave}
                                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                            >
                                <Save size={18} />
                                저장
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (viewMode === 'view') {
        return (
            <div>
                <button
                    onClick={() => setViewMode('list')}
                    className="flex items-center text-gray-600 hover:text-gray-900 mb-6"
                >
                    <ArrowLeft size={20} className="mr-2" />
                    목록으로 돌아가기
                </button>

                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                    <div className="flex justify-between items-start mb-6">
                        <div>
                            <h2 className="text-2xl font-bold mb-2">{selectedArticle.title}</h2>
                            <p className="text-sm text-gray-500">
                                작성자: {selectedArticle.author} |
                                수정: {new Date(selectedArticle.updatedAt).toLocaleDateString()}
                            </p>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => handleEdit(selectedArticle.id)}
                                className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                            >
                                <Edit2 size={18} />
                            </button>
                            <button
                                onClick={() => handleDelete(selectedArticle.id)}
                                className="p-2 text-red-600 hover:bg-red-50 rounded"
                            >
                                <Trash2 size={18} />
                            </button>
                        </div>
                    </div>
                    <div className="prose max-w-none">
                        <pre className="whitespace-pre-wrap font-sans text-gray-700">{selectedArticle.content}</pre>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold">업무 매뉴얼</h1>
                <button
                    onClick={handleCreate}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                    <Plus size={18} />
                    새 매뉴얼 작성
                </button>
            </div>

            {/* Search */}
            <div className="mb-4">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                    <input
                        type="text"
                        placeholder="제목 또는 내용 검색..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                </div>
            </div>

            {/* Articles List */}
            <div className="space-y-3">
                {filteredArticles.length === 0 ? (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center text-gray-500">
                        등록된 매뉴얼이 없습니다.
                    </div>
                ) : (
                    filteredArticles.map(article => (
                        <div
                            key={article.id}
                            className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 hover:shadow-md transition-shadow cursor-pointer"
                            onClick={() => handleView(article.id)}
                        >
                            <div className="flex justify-between items-start">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Book size={18} className="text-blue-600" />
                                        <h3 className="text-lg font-semibold text-gray-900">{article.title}</h3>
                                    </div>
                                    <p className="text-sm text-gray-600 line-clamp-2 mb-2">
                                        {article.content}
                                    </p>
                                    <p className="text-xs text-gray-500">
                                        작성자: {article.author} | 수정: {new Date(article.updatedAt).toLocaleDateString()}
                                    </p>
                                </div>
                                <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                                    <button
                                        onClick={() => handleEdit(article.id)}
                                        className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                                    >
                                        <Edit2 size={16} />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(article.id)}
                                        className="p-2 text-red-600 hover:bg-red-50 rounded"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default WikiPage;
