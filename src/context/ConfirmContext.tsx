"use client";

import React, { createContext, useContext, useState, type ReactNode } from 'react';
import ConfirmDialog from '../components/ConfirmDialog';

interface ConfirmOptions {
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    variant?: 'danger' | 'info';
}

interface ConfirmContextType {
    confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextType | undefined>(undefined);

export const ConfirmProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [config, setConfig] = useState<(ConfirmOptions & { resolve: (val: boolean) => void }) | null>(null);

    const confirm = (options: ConfirmOptions) => {
        return new Promise<boolean>((resolve) => {
            setConfig({ ...options, resolve });
        });
    };

    const handleConfirm = () => {
        config?.resolve(true);
        setConfig(null);
    };

    const handleCancel = () => {
        config?.resolve(false);
        setConfig(null);
    };

    return (
        <ConfirmContext.Provider value={{ confirm }}>
            {children}
            {config && (
                <ConfirmDialog
                    isOpen={true}
                    title={config.title}
                    message={config.message}
                    confirmText={config.confirmText}
                    cancelText={config.cancelText}
                    variant={config.variant}
                    onConfirm={handleConfirm}
                    onCancel={handleCancel}
                />
            )}
        </ConfirmContext.Provider>
    );
};

export const useConfirm = () => {
    const context = useContext(ConfirmContext);
    if (!context) throw new Error('useConfirm must be used within ConfirmProvider');
    return context;
};