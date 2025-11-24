import React from 'react';

const DashboardHome = () => {
    return (
        <div>
            <h2 className="text-2xl font-bold text-gray-800 mb-6">대시보드</h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="text-gray-500 text-sm font-medium">오늘 예약</h3>
                    <p className="text-3xl font-bold text-gray-900 mt-2">12</p>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="text-gray-500 text-sm font-medium">대기 환자</h3>
                    <p className="text-3xl font-bold text-blue-600 mt-2">4</p>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="text-gray-500 text-sm font-medium">진료 완료</h3>
                    <p className="text-3xl font-bold text-green-600 mt-2">28</p>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">최근 알림</h3>
                <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="flex items-start space-x-3 pb-4 border-b border-gray-100 last:border-0 last:pb-0">
                            <div className="w-2 h-2 mt-2 bg-blue-500 rounded-full"></div>
                            <div>
                                <p className="text-sm text-gray-800">새로운 예약이 접수되었습니다.</p>
                                <p className="text-xs text-gray-500 mt-1">10분 전</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default DashboardHome;
