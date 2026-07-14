import React from 'react';
import { X, AlertTriangle } from 'lucide-react';

interface ConfirmDialogProps {
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
    confirmText?: string;
    cancelText?: string;
    variant?: 'danger' | 'info';
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
    isOpen,
    title,
    message,
    onConfirm,
    onCancel,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    variant = 'info'
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-lg shadow-sm w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="p-6">
                    <div className="flex items-center justify-between mb-6">
                        <div className={`p-3 rounded-lg ${variant === 'danger' ? 'bg-rose-50 text-rose-600' : 'bg-blue-50 text-blue-600'}`}>
                            <AlertTriangle size={24} />
                        </div>
                        <button onClick={onCancel} className="text-slate-400 hover:text-slate-600 transition-colors">
                            <X size={20} />
                        </button>
                    </div>

                    <h3 className="text-xl font-black text-slate-900 mb-2 uppercase tracking-tight">{title}</h3>
                    <p className="text-slate-500 font-medium leading-relaxed">{message}</p>
                </div>

                <div className="p-4 bg-slate-50 flex gap-3">
                    <button
                        onClick={onCancel}
                        className="flex-1 h-12 rounded-xl text-sm font-black text-slate-500 hover:bg-slate-200 transition-colors uppercase tracking-wider"
                    >
                        {cancelText}
                    </button>
                    <button
                        onClick={onConfirm}
                        className={`flex-1 h-12 rounded-xl text-sm font-black text-white shadow-sm transition-all active:scale-95 uppercase tracking-wider ${variant === 'danger'
                                ? 'bg-rose-600 hover:bg-rose-500 '
                                : 'bg-blue-600 hover:bg-blue-500 '
                            }`}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmDialog;
