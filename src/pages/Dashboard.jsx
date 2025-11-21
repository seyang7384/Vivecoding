import React from 'react';
import { Users, Activity, Calendar, DollarSign } from 'lucide-react';

const StatCard = ({ title, value, icon: Icon, color }) => (
    <div className="bg-white rounded-xl shadow-sm p-6 flex items-center">
        <div className={`p-3 rounded-full mr-4 ${color}`}>
            <Icon className="w-6 h-6 text-white" />
        </div>
        <div>
            <p className="text-sm font-medium text-gray-500">{title}</p>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
        </div>
    </div>
);

const Dashboard = () => {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">대시보드</h1>
                <p className="text-gray-500">오늘의 병원 현황을 한눈에 확인하세요.</p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                    title="오늘의 예약"
                    value="24"
                    icon={Calendar}
                    color="bg-blue-500"
                />
                <StatCard
                    title="대기 환자"
                    value="8"
                    icon={Users}
                    color="bg-green-500"
                />
                <StatCard
                    title="진료 중"
                    value="3"
                    icon={Activity}
                    color="bg-orange-500"
                />
                <StatCard
                    title="금일 매출"
                    value="₩1,250,000"
                    icon={DollarSign}
                    color="bg-purple-500"
                />
            </div>

            {/* Recent Activity Placeholder */}
            <div className="bg-white rounded-xl shadow-sm p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-4">최근 진료 내역</h2>
                <div className="border rounded-lg p-8 text-center text-gray-500">
                    데이터가 없습니다.
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
