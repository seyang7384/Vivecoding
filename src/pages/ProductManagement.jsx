import React, { useState, useEffect } from 'react';
import { Package, Syringe } from 'lucide-react';
import TreatmentManager from '../components/products/TreatmentManager';
import PackageManager from '../components/products/PackageManager';
import { productService } from '../services/productService';

const ProductManagement = () => {
    const [activeTab, setActiveTab] = useState('packages');

    // Seed data on first load if empty
    useEffect(() => {
        productService.seedInitialData();
    }, []);

    return (
        <div className="h-full flex flex-col bg-gray-50">
            <div className="bg-white border-b border-gray-200 px-6 py-4">
                <h1 className="text-2xl font-bold text-gray-900 flex items-center mb-4">
                    <Package className="w-6 h-6 mr-2 text-blue-600" />
                    수가 관리
                </h1>

                <div className="flex space-x-4">
                    <button
                        onClick={() => setActiveTab('packages')}
                        className={`flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'packages'
                            ? 'bg-blue-100 text-blue-700'
                            : 'text-gray-600 hover:bg-gray-100'
                            }`}
                    >
                        <Package className="w-4 h-4 mr-2" />
                        패키지 관리
                    </button>
                    <button
                        onClick={() => setActiveTab('treatments')}
                        className={`flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'treatments'
                            ? 'bg-blue-100 text-blue-700'
                            : 'text-gray-600 hover:bg-gray-100'
                            }`}
                    >
                        <Syringe className="w-4 h-4 mr-2" />
                        시술 관리
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-scroll">
                {activeTab === 'packages' ? <PackageManager /> : <TreatmentManager />}
            </div>
        </div>
    );
};

export default ProductManagement;
