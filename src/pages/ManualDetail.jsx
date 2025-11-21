import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit2, Trash2, Calendar, User } from 'lucide-react';
import { manualService } from '../services/manualService';
import Button from '../components/ui/Button';

const ManualDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [manual, setManual] = useState(null);
    const [isEditing, setIsEditing] = useState(false);
    const [editData, setEditData] = useState({
        title: '',
        content: '',
        category: ''
    });

    useEffect(() => {
        loadManual();
    }, [id]);

    const loadManual = async () => {
        const data = await manualService.getManualById(id);
        if (data) {
            setManual(data);
            setEditData({
                title: data.title,
                content: data.content,
                category: data.category
            });
        }
    };

    const handleUpdate = async (e) => {
        e.preventDefault();
        await manualService.updateManual(id, editData);
        setIsEditing(false);
        loadManual();
    };

    const handleDelete = async () => {
        if (confirm('정말 이 매뉴얼을 삭제하시겠습니까?')) {
            await manualService.deleteManual(id);
            navigate('/manuals');
        }
    };

    const formatDate = (timestamp) => {
        return new Date(timestamp).toLocaleString('ko-KR');
    };

    if (!manual) return <div>Loading...</div>;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center">
                    <button
                        onClick={() => navigate('/manuals')}
                        className="mr-4 p-2 hover:bg-gray-100 rounded-full transition-colors"
                    >
                        <ArrowLeft className="w-6 h-6 text-gray-600" />
                    </button>
                    <h1 className="text-2xl font-bold text-gray-900">매뉴얼 상세</h1>
                </div>

                {!isEditing && (
                    <div className="flex space-x-2">
                        <Button
                            onClick={() => setIsEditing(true)}
                            className="w-auto bg-white text-blue-600 border border-blue-600 hover:bg-blue-50"
                        >
                            <Edit2 className="w-4 h-4 mr-2" />
                            수정
                        </Button>
                        <Button
                            onClick={handleDelete}
                            className="w-auto bg-red-600 hover:bg-red-700"
                        >
                            <Trash2 className="w-4 h-4 mr-2" />
                            삭제
                        </Button>
                    </div>
                )}
            </div>

            {/* Content */}
            {isEditing ? (
                <div className="bg-white rounded-xl shadow-sm p-6">
                    <form onSubmit={handleUpdate} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">제목</label>
                            <input
                                type="text"
                                value={editData.title}
                                onChange={(e) => setEditData({ ...editData, title: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">카테고리</label>
                            <select
                                value={editData.category}
                                onChange={(e) => setEditData({ ...editData, category: e.target.value })}
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
                                value={editData.content}
                                onChange={(e) => setEditData({ ...editData, content: e.target.value })}
                                rows="15"
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none font-mono text-sm"
                                required
                            ></textarea>
                        </div>

                        <div className="flex space-x-3">
                            <button
                                type="button"
                                onClick={() => {
                                    setIsEditing(false);
                                    setEditData({
                                        title: manual.title,
                                        content: manual.content,
                                        category: manual.category
                                    });
                                }}
                                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
                            >
                                취소
                            </button>
                            <Button type="submit" className="flex-1">
                                저장
                            </Button>
                        </div>
                    </form>
                </div>
            ) : (
                <div className="bg-white rounded-xl shadow-sm p-6">
                    <div className="mb-6">
                        <div className="flex items-center space-x-3 mb-4">
                            <span className="px-3 py-1 bg-blue-100 text-blue-700 text-sm rounded-full font-medium">
                                {manual.category}
                            </span>
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-4">{manual.title}</h2>

                        <div className="flex items-center space-x-6 text-sm text-gray-500 border-b border-gray-200 pb-4">
                            <div className="flex items-center">
                                <User className="w-4 h-4 mr-1" />
                                {manual.author}
                            </div>
                            <div className="flex items-center">
                                <Calendar className="w-4 h-4 mr-1" />
                                작성: {formatDate(manual.createdAt)}
                            </div>
                            {manual.updatedAt !== manual.createdAt && (
                                <div className="flex items-center">
                                    <Calendar className="w-4 h-4 mr-1" />
                                    수정: {formatDate(manual.updatedAt)}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="prose max-w-none">
                        <pre className="whitespace-pre-wrap font-sans text-gray-700 leading-relaxed">
                            {manual.content}
                        </pre>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ManualDetail;
