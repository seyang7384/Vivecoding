import React from 'react';
import { Menu, User } from 'lucide-react';
import NotificationCenter from './ui/NotificationCenter';

const Header = ({ onMenuClick }) => {
    return (
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 lg:px-8">
            <div className="flex items-center">
                <button
                    onClick={onMenuClick}
                    className="lg:hidden p-2 mr-4 text-gray-600 hover:bg-gray-100 rounded-md"
                >
                    <Menu className="w-6 h-6" />
                </button>
                <h2 className="text-lg font-semibold text-gray-800 lg:hidden">Hospital OS</h2>
            </div>

            <div className="flex items-center space-x-4">
                <NotificationCenter />

                <div className="flex items-center space-x-3 pl-4 border-l border-gray-200">
                    <div className="text-right hidden sm:block">
                        <p className="text-sm font-medium text-gray-900">김의사 원장</p>
                        <p className="text-xs text-gray-500">진료실 1</p>
                    </div>
                    <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                        <User className="w-6 h-6 text-gray-500" />
                    </div>
                </div>
            </div>
        </header>
    );
};

export default Header;
