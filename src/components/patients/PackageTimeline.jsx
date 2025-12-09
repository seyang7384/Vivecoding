import React, { useState } from 'react';
import { Package, Check, ChevronRight, AlertCircle, Plus, Trash2 } from 'lucide-react';
import Button from '../ui/Button';

const PackageTimeline = ({ packages = [], onRecordSession, onStartPackage, onDeletePackage }) => {
    const [expandedPkgId, setExpandedPkgId] = useState(null);

    // Helper to calculate progress percentage
    const getProgress = (pkg) => {
        if (!pkg.totalCounts) return 0;
        return Math.min(100, Math.round((pkg.usedCounts / pkg.totalCounts) * 100));
    };

    // Helper to get next recommended step
    const getNextStep = (pkg) => {
        if (!pkg.items || pkg.items.length === 0) return '정보 없음';

        // For herbal packages, always show "첩약 발송" to avoid confusion with item names like "(1개월)"
        if (pkg.type === 'herbal') {
            return '첩약 발송';
        }

        // Simple logic: Rotate through items based on used count
        const itemIndex = pkg.usedCounts % pkg.items.length;
        return pkg.items[itemIndex].name;
    };

    // Helper to format progress text based on package type
    const getProgressText = (pkg) => {
        if (pkg.type === 'herbal') {
            // Herbal medicine: 1 month = 2 units (15 days each)
            // Display as "X/Y회"
            return `${pkg.usedCounts}/${pkg.totalCounts}회`;
        }
        // Default: Percentage
        return `${getProgress(pkg)}%`;
    };

    return (
        <div className="bg-white rounded-xl shadow-sm p-6 border-2 border-purple-100">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-gray-900 flex items-center">
                    <Package className="w-5 h-5 mr-2 text-purple-600" />
                    진료 패키지 및 타임라인
                </h3>
                <Button onClick={onStartPackage} className="w-auto text-sm py-1 px-3">
                    <Plus className="w-4 h-4 mr-1" />
                    패키지 시작
                </Button>
            </div>

            <div className="space-y-4">
                {packages.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg">
                        진행 중인 패키지가 없습니다.
                    </div>
                ) : (
                    packages.map((pkg) => (
                        <div key={pkg.id} className="border border-gray-200 rounded-lg overflow-hidden">
                            {/* Header / Summary */}
                            <div className="p-4 bg-white">
                                <div className="flex justify-between items-start mb-2">
                                    <div>
                                        <h4 className="font-bold text-gray-900 flex items-center gap-2">
                                            {pkg.name}
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onDeletePackage(pkg.id);
                                                }}
                                                className="text-gray-400 hover:text-red-500 transition-colors"
                                                title="패키지 삭제"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </h4>
                                        <p className="text-xs text-gray-500">시작일: {pkg.startDate}</p>
                                    </div>
                                    <span className={`px-2 py-1 text-xs rounded-full font-medium ${pkg.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                                        }`}>
                                        {pkg.status === 'active' ? '진행중' : '종료'}
                                    </span>
                                </div>

                                {/* Progress Bar */}
                                <div className="mt-3">
                                    <div className="flex justify-between text-sm mb-1">
                                        <span className="text-gray-600">
                                            {pkg.type === 'herbal' ? '발송 현황' : '진행률'}
                                            ({pkg.usedCounts}/{pkg.totalCounts}회)
                                        </span>
                                        <span className="font-medium text-purple-600">{getProgressText(pkg)}</span>
                                    </div>
                                    <div className="w-full bg-gray-100 rounded-full h-2.5">
                                        <div
                                            className="bg-purple-600 h-2.5 rounded-full transition-all duration-500"
                                            style={{ width: `${getProgress(pkg)}%` }}
                                        ></div>
                                    </div>
                                </div>

                                {/* Next Step Recommendation */}
                                {pkg.status === 'active' && pkg.usedCounts < pkg.totalCounts && (
                                    <div className="mt-4 flex items-center justify-between bg-purple-50 p-3 rounded-lg">
                                        <div className="flex items-center">
                                            <AlertCircle className="w-4 h-4 text-purple-600 mr-2" />
                                            <span className="text-sm text-purple-900">
                                                {pkg.type === 'herbal' ? '다음 발송:' : '다음 예정:'} <span className="font-bold">{getNextStep(pkg)}</span>
                                            </span>
                                        </div>
                                        <button
                                            onClick={() => onRecordSession(pkg)}
                                            className="text-xs bg-white border border-purple-200 text-purple-700 px-3 py-1 rounded hover:bg-purple-50 font-medium"
                                        >
                                            {pkg.type === 'herbal' ? '발송 기록' : '사용 기록'}
                                        </button>
                                    </div>
                                )}

                                <button
                                    onClick={() => setExpandedPkgId(expandedPkgId === pkg.id ? null : pkg.id)}
                                    className="w-full mt-3 flex items-center justify-center text-xs text-gray-400 hover:text-gray-600 pt-2 border-t border-gray-100"
                                >
                                    {expandedPkgId === pkg.id ? '상세 접기' : '상세 보기'}
                                    <ChevronRight className={`w-3 h-3 ml-1 transform transition-transform ${expandedPkgId === pkg.id ? 'rotate-90' : ''}`} />
                                </button>
                            </div>

                            {/* Expanded Details (History) */}
                            {expandedPkgId === pkg.id && (
                                <div className="bg-gray-50 p-4 border-t border-gray-200">
                                    <h5 className="text-xs font-bold text-gray-500 uppercase mb-3">사용 내역</h5>
                                    <div className="space-y-3">
                                        {pkg.history && pkg.history.length > 0 ? (
                                            pkg.history.map((record, idx) => (
                                                <div key={idx} className="flex items-start relative pl-4 pb-4 last:pb-0 border-l-2 border-gray-200 last:border-l-0">
                                                    <div className="absolute -left-[5px] top-1 w-2.5 h-2.5 rounded-full bg-purple-400"></div>
                                                    <div>
                                                        <p className="text-sm font-medium text-gray-900">{record.treatment}</p>
                                                        <p className="text-xs text-gray-500">{record.date} • {record.note || '완료'}</p>
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <p className="text-sm text-gray-400 italic">아직 사용 내역이 없습니다.</p>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default PackageTimeline;
