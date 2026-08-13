"use client";

import React from 'react';
import MonthlyView from '../components/MonthlyView';
import MonthlyInvestedChart from '../components/MonthlyInvestedChart';

const LedgerPage: React.FC = () => {
    return (
        <div className="animate-in fade-in duration-500">
            {/* Above the grid: the same months the table lists, read as a shape. */}
            <MonthlyInvestedChart />
            <MonthlyView />
        </div>
    );
};

export default LedgerPage;