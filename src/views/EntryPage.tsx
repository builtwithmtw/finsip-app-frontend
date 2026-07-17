"use client";

import React from 'react';
import BulkTransactionForm from '../components/BulkTransactionForm';

const EntryPage: React.FC = () => {
    return (
        <div className="animate-in fade-in duration-500">
            <BulkTransactionForm />
        </div>
    );
};

export default EntryPage;