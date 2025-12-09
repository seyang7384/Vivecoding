import React, { useState, useEffect } from 'react';
import {
    CheckSquare,
    Plus,
    Trash2,
    Calendar,
    Clock,
    AlertCircle,
    CheckCircle2,
    Circle,
    UserCog,
    Stethoscope,
    Syringe,
    FlaskConical
} from 'lucide-react';
import { todoService } from '../services/todoService';

const ROLES = [
    { id: 'doctor', name: '원장님', icon: Stethoscope, color: 'blue' },
    { id: 'manager', name: '실장님', icon: UserCog, color: 'purple' },
    { id: 'nurse', name: '치료실', icon: Syringe, color: 'green' },
    { id: 'pharmacy', name: '탕전실', icon: FlaskConical, color: 'orange' }
];

const FREQUENCIES = [
    { id: 'daily', name: '매일', icon: Clock },
    { id: 'weekly', name: '주간', icon: Calendar },
    { id: 'monthly', name: '월간', icon: Calendar },
    { id: 'yearly', name: '연간', icon: Calendar },
    { id: 'adhoc', name: '수시', icon: AlertCircle }
];

const TodoListPage = () => {
    const [selectedRole, setSelectedRole] = useState(ROLES[0].id);
    const [selectedFrequency, setSelectedFrequency] = useState(FREQUENCIES[0].id);
    const [todos, setTodos] = useState([]);
    const [newTodo, setNewTodo] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchTodos();
    }, [selectedRole]);

    const fetchTodos = async () => {
        setLoading(true);
        try {
            const data = await todoService.getTodos(selectedRole);
            setTodos(data);
        } catch (error) {
            console.error("Failed to fetch todos:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleAddTodo = async (e) => {
        e.preventDefault();
        if (!newTodo.trim()) return;

        try {
            const todo = {
                role: selectedRole,
                content: newTodo,
                frequency: selectedFrequency,
                isCompleted: false
            };
            const addedTodo = await todoService.addTodo(todo);
            setTodos([addedTodo, ...todos]);
            setNewTodo('');
        } catch (error) {
            console.error("Failed to add todo:", error);
        }
    };

    const toggleTodo = async (id, currentStatus) => {
        try {
            await todoService.updateTodoStatus(id, !currentStatus);
            setTodos(todos.map(t =>
                t.id === id ? { ...t, isCompleted: !currentStatus } : t
            ));
        } catch (error) {
            console.error("Failed to update todo:", error);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('정말 삭제하시겠습니까?')) return;
        try {
            await todoService.deleteTodo(id);
            setTodos(todos.filter(t => t.id !== id));
        } catch (error) {
            console.error("Failed to delete todo:", error);
        }
    };

    const filteredTodos = todos.filter(t => t.frequency === selectedFrequency);
    const currentRole = ROLES.find(r => r.id === selectedRole);

    return (
        <div className="h-screen bg-gray-900 text-white flex flex-col">
            {/* Header */}
            <header className="h-16 bg-gray-800 border-b border-gray-700 flex items-center justify-between px-6">
                <div className="flex items-center space-x-3">
                    <CheckSquare className="w-6 h-6 text-blue-400" />
                    <h1 className="text-xl font-bold">업무 체크리스트</h1>
                </div>
            </header>

            <div className="flex-1 flex overflow-hidden">
                {/* Sidebar - Roles */}
                <div className="w-64 bg-gray-800 border-r border-gray-700 p-4 space-y-2">
                    <h2 className="text-xs font-bold text-gray-500 uppercase mb-4 px-2">직무 선택</h2>
                    {ROLES.map(role => (
                        <button
                            key={role.id}
                            onClick={() => setSelectedRole(role.id)}
                            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${selectedRole === role.id
                                    ? `bg-${role.color}-600 text-white shadow-lg`
                                    : 'text-gray-400 hover:bg-gray-700 hover:text-gray-200'
                                }`}
                        >
                            <role.icon className="w-5 h-5" />
                            <span className="font-medium">{role.name}</span>
                        </button>
                    ))}
                </div>

                {/* Main Content */}
                <div className="flex-1 flex flex-col bg-gray-900">
                    {/* Frequency Tabs */}
                    <div className="flex items-center space-x-1 p-4 border-b border-gray-800 overflow-x-auto">
                        {FREQUENCIES.map(freq => (
                            <button
                                key={freq.id}
                                onClick={() => setSelectedFrequency(freq.id)}
                                className={`flex items-center space-x-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${selectedFrequency === freq.id
                                        ? 'bg-gray-700 text-white border border-gray-600'
                                        : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800'
                                    }`}
                            >
                                <freq.icon className="w-4 h-4" />
                                <span>{freq.name}</span>
                                <span className="bg-gray-800 px-2 py-0.5 rounded-full text-xs">
                                    {todos.filter(t => t.frequency === freq.id).length}
                                </span>
                            </button>
                        ))}
                    </div>

                    {/* Todo List Area */}
                    <div className="flex-1 p-6 overflow-y-auto">
                        <div className="max-w-3xl mx-auto space-y-6">
                            {/* Input Area */}
                            <form onSubmit={handleAddTodo} className="relative">
                                <input
                                    type="text"
                                    value={newTodo}
                                    onChange={(e) => setNewTodo(e.target.value)}
                                    placeholder={`${currentRole.name}의 ${FREQUENCIES.find(f => f.id === selectedFrequency).name} 업무를 입력하세요...`}
                                    className="w-full bg-gray-800 text-white pl-4 pr-12 py-4 rounded-xl border border-gray-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all shadow-lg"
                                />
                                <button
                                    type="submit"
                                    className="absolute right-2 top-2 bottom-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center"
                                >
                                    <Plus className="w-5 h-5" />
                                </button>
                            </form>

                            {/* List */}
                            <div className="space-y-3">
                                {loading ? (
                                    <div className="text-center py-10 text-gray-500">로딩 중...</div>
                                ) : filteredTodos.length === 0 ? (
                                    <div className="text-center py-10 text-gray-500 bg-gray-800/30 rounded-xl border border-dashed border-gray-700">
                                        등록된 업무가 없습니다.
                                    </div>
                                ) : (
                                    filteredTodos.map(todo => (
                                        <div
                                            key={todo.id}
                                            className={`group flex items-center justify-between p-4 rounded-xl border transition-all ${todo.isCompleted
                                                    ? 'bg-gray-800/50 border-gray-800 opacity-60'
                                                    : 'bg-gray-800 border-gray-700 hover:border-gray-600 shadow-sm'
                                                }`}
                                        >
                                            <div className="flex items-center space-x-4 flex-1">
                                                <button
                                                    onClick={() => toggleTodo(todo.id, todo.isCompleted)}
                                                    className={`p-1 rounded-full transition-colors ${todo.isCompleted ? 'text-green-500' : 'text-gray-500 hover:text-gray-400'
                                                        }`}
                                                >
                                                    {todo.isCompleted ? <CheckCircle2 className="w-6 h-6" /> : <Circle className="w-6 h-6" />}
                                                </button>
                                                <span className={`text-lg ${todo.isCompleted ? 'line-through text-gray-500' : 'text-gray-200'}`}>
                                                    {todo.content}
                                                </span>
                                            </div>
                                            <button
                                                onClick={() => handleDelete(todo.id)}
                                                className="opacity-0 group-hover:opacity-100 p-2 text-gray-500 hover:text-red-400 transition-all"
                                            >
                                                <Trash2 className="w-5 h-5" />
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TodoListPage;
