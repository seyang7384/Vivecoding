import React, { useState, useEffect } from 'react';
import { X, Package, Check } from 'lucide-react';
import Button from '../ui/Button';

const PackageSelectionModal = ({ isOpen, onClose, onSelect, packages = [] }) => {
    const [selectedPkgId, setSelectedPkgId] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');

    if (!isOpen) return null;

    const filteredPackages = packages.filter(pkg =>
        pkg.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleConfirm = () => {
        const pkg = packages.find(p => p.id === selectedPkgId);
        if (pkg) {
            onSelect(pkg);
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
                <div className="flex justify-between items-center p-6 border-b border-gray-200">
                    <h2 className="text-xl font-bold text-gray-900 flex items-center">
                        <Package className="w-6 h-6 mr-2 text-purple-600" />
                        패키지 선택
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="p-6 flex-1 overflow-hidden flex flex-col">
                    <input
                        type="text"
                        placeholder="패키지 검색..."
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-4 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />

                    <div className="flex-1 overflow-y-auto space-y-2 pr-2">
                        {filteredPackages.length === 0 ? (
                            <p className="text-center text-gray-500 py-8">검색 결과가 없습니다.</p>
                        ) : (
                            filteredPackages.map((pkg) => (
                                <div
                                    key={pkg.id}
                                    onClick={() => setSelectedPkgId(pkg.id)}
                                    className={`p-4 rounded-lg border cursor-pointer transition-all ${selectedPkgId === pkg.id
                                            ? 'border-purple-600 bg-purple-50 ring-1 ring-purple-600'
                                            : 'border-gray-200 hover:border-purple-300 hover:bg-gray-50'
                                        }`}
                                >
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h3 className={`font-bold ${selectedPkgId === pkg.id ? 'text-purple-900' : 'text-gray-900'}`}>
                                                {pkg.name}
                                            </h3>
                                            <p className="text-sm text-gray-500 mt-1">{pkg.description}</p>
                                            <div className="mt-2 flex flex-wrap gap-1">
                                                {pkg.items && pkg.items.map((item, idx) => (
                                                    <span key={idx} className="text-xs bg-white border border-gray-200 px-2 py-0.5 rounded text-gray-600">
                                                        {item.name} x{item.count}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <span className="block font-bold text-gray-900">
                                                {Number(pkg.price).toLocaleString()}원
                                            </span>
                                            {selectedPkgId === pkg.id && (
                                                <div className="mt-2 flex justify-end">
                                                    <div className="bg-purple-600 text-white rounded-full p-1">
                                                        <Check className="w-4 h-4" />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                <div className="p-6 border-t border-gray-200 flex justify-end space-x-3">
                    <Button onClick={onClose} className="bg-gray-100 text-gray-700 hover:bg-gray-200 w-auto">
                        취소
                    </Button>
                    <Button onClick={handleConfirm} disabled={!selectedPkgId} className="w-auto">
                        선택 완료
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default PackageSelectionModal;
