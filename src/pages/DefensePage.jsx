import React from 'react';
import NoShowManager from '../components/NoShowManager';
import RecallManager from '../components/RecallManager';

const DefensePage = () => {
    return (
        <div className="p-6 max-w-4xl mx-auto">
            <h1 className="text-2xl font-bold text-gray-800 mb-6">예약 방어 및 리콜 관리</h1>

            <div className="space-y-8">
                <section>
                    <NoShowManager />
                </section>

                <section>
                    <RecallManager />
                </section>
            </div>
        </div>
    );
};

export default DefensePage;
