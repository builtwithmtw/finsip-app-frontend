import React from 'react';
import MonthlyView from '../components/MonthlyView';

const LedgerPage: React.FC = () => {
    return (
        <div className="animate-in fade-in duration-500">
            <MonthlyView />
        </div>
    );
};

export default LedgerPage;
