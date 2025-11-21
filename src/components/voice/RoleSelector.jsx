import React from 'react';
import { User, Monitor, Stethoscope, Beaker } from 'lucide-react';

const RoleSelector = ({ onSelectRole }) => {
    const roles = [
        {
            id: 'A',
            name: '진료실',
            description: 'User A (PC)',
            icon: <Stethoscope className="w-12 h-12 text-blue-600" />,
            color: 'bg-blue-50 hover:bg-blue-100 border-blue-200'
        },
        {
            id: 'B',
            name: '데스크',
            description: 'User B (PC)',
            icon: <Monitor className="w-12 h-12 text-green-600" />,
            color: 'bg-green-50 hover:bg-green-100 border-green-200'
        },
        {
            id: 'C',
            name: '치료실',
            description: 'User C (PC)',
            icon: <User className="w-12 h-12 text-purple-600" />,
            color: 'bg-purple-50 hover:bg-purple-100 border-purple-200'
        },
        {
            id: 'D',
            name: '탕전실',
            description: 'User D (Mobile)',
            icon: <Beaker className="w-12 h-12 text-orange-600" />,
            color: 'bg-orange-50 hover:bg-orange-100 border-orange-200'
        }
    ];

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <div className="max-w-4xl w-full">
                <div className="text-center mb-12">
                    <h1 className="text-4xl font-bold text-gray-900 mb-4">Smart Medical Voice HQ</h1>
                    <p className="text-xl text-gray-600">업무 공간을 선택해주세요</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {roles.map((role) => (
                        <button
                            key={role.id}
                            onClick={() => onSelectRole(role)}
                            className={`p-8 rounded-2xl border-2 transition-all duration-200 flex items-center space-x-6 ${role.color} shadow-sm hover:shadow-md`}
                        >
                            <div className="bg-white p-4 rounded-full shadow-sm">
                                {role.icon}
                            </div>
                            <div className="text-left">
                                <h2 className="text-2xl font-bold text-gray-900">{role.name}</h2>
                                <p className="text-gray-600">{role.description}</p>
                            </div>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default RoleSelector;
