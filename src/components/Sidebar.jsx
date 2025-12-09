import React from 'react';
import { NavLink } from 'react-router-dom';
import {
    LayoutDashboard,
    Users,
    Calendar,
    Settings,
    LogOut,
    X,
    Activity,
    MessageCircle,
    Package,
    Book,
    Mic,
    CheckSquare,
    Banknote
} from 'lucide-react';

const Sidebar = ({ isOpen, onClose }) => {
    const navItems = [
        { icon: LayoutDashboard, label: '대시보드', path: '/dashboard' },
        { icon: Activity, label: '진료 현황', path: '/treatment-status' },
        { icon: Users, label: '환자 관리', path: '/patients' },
        { icon: Calendar, label: '일정', path: '/schedule' },
        { icon: MessageCircle, label: '메신저', path: '/chat' },
        { icon: Package, label: '재고 관리', path: '/inventory' },
        { icon: Book, label: '업무 매뉴얼', path: '/manuals' },
        { icon: Mic, label: '음성 관제 (HQ)', path: '/voice-hq' },
        { icon: CheckSquare, label: '업무 체크리스트', path: '/todo' },
        { icon: Banknote, label: '수납 일지', path: '/payment' },
        { icon: Package, label: '수가 관리', path: '/products' },
        { icon: Settings, label: '설정', path: '/settings' },
    ];

    return (
        <>
            {/* Mobile Overlay */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black bg-opacity-50 z-20 lg:hidden"
                    onClick={onClose}
                />
            )}

            {/* Sidebar Container */}
            <aside
                className={`
          fixed top-0 left-0 z-30 h-screen w-64 bg-white border-r border-gray-200 transition-transform duration-300 ease-in-out
          lg:translate-x-0 lg:static lg:h-auto
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
            >
                <div className="h-full flex flex-col">
                    {/* Logo Area */}
                    <div className="h-16 flex items-center justify-between px-6 border-b border-gray-200">
                        <span className="text-xl font-bold text-blue-600">Hospital OS</span>
                        <button
                            onClick={onClose}
                            className="lg:hidden p-1 rounded-md hover:bg-gray-100"
                        >
                            <X className="w-6 h-6 text-gray-500" />
                        </button>
                    </div>

                    {/* Navigation */}
                    <nav className="flex-1 px-4 py-6 space-y-1">
                        {navItems.map((item) => (
                            <NavLink
                                key={item.path}
                                to={item.path}
                                onClick={onClose}
                                className={({ isActive }) => `
                  flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors
                  ${isActive
                                        ? 'bg-blue-50 text-blue-700'
                                        : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'}
                `}
                            >
                                <item.icon className="w-5 h-5 mr-3" />
                                {item.label}
                            </NavLink>
                        ))}
                    </nav>

                    {/* Footer / Logout */}
                    <div className="p-4 border-t border-gray-200">
                        <button
                            onClick={() => {
                                localStorage.removeItem('isAuthenticated');
                                window.location.href = '/login';
                            }}
                            className="flex items-center w-full px-4 py-3 text-sm font-medium text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                        >
                            <LogOut className="w-5 h-5 mr-3" />
                            로그아웃
                        </button>
                    </div>
                </div>
            </aside>
        </>
    );
};

export default Sidebar;
