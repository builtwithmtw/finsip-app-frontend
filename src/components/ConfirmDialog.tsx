"use client";

import React from 'react';
import { X, AlertTriangle } from 'lucide-react';
import clsx from 'clsx';

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
        <div
            onClick={onCancel}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200"
        >
            {/* Same shell as TransactionDetailModal: rounded-2xl, header / body / footer at a
                single px-6 rhythm, so the two dialogs read as one family. */}
            <div
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200"
            >
                <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-4">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className={clsx(
                            'shrink-0 w-9 h-9 rounded-lg flex items-center justify-center',
                            variant === 'danger' ? 'bg-rose-50 text-rose-600' : 'bg-blue-50 text-blue-600'
                        )}>
                            <AlertTriangle size={18} />
                        </div>
                        <h3 className="text-base font-semibold text-slate-900 tracking-tight truncate">{title}</h3>
                    </div>
                    <button
                        onClick={onCancel}
                        title="Close"
                        className="shrink-0 -mr-2 -mt-1 p-2 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="px-6 pb-5 border-t border-slate-100 pt-4">
                    <p className="text-sm text-slate-500 leading-relaxed">{message}</p>
                </div>

                <div className="flex gap-3 px-6 py-4 bg-slate-50 border-t border-slate-100">
                    <button
                        onClick={onCancel}
                        className="flex-1 h-10 rounded-lg text-sm font-medium text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 transition-colors"
                    >
                        {cancelText}
                    </button>
                    <button
                        onClick={onConfirm}
                        className={clsx(
                            'flex-1 h-10 rounded-lg text-sm font-semibold text-white transition-colors',
                            variant === 'danger' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-blue-600 hover:bg-blue-700'
                        )}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmDialog;