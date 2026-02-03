import React from 'react';

interface ConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string | React.ReactNode;
    confirmText?: string;
    cancelText?: string;
    type?: 'danger' | 'warning' | 'info';
    isLoading?: boolean;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmText = 'Confirmar',
    cancelText = 'Cancelar',
    type = 'danger',
    isLoading = false
}) => {
    if (!isOpen) return null;

    const bgColors = {
        danger: 'bg-red-500 hover:bg-red-600',
        warning: 'bg-amber-500 hover:bg-amber-600',
        info: 'bg-primary hover:bg-primary/90'
    };

    const iconColors = {
        danger: 'text-red-500 bg-red-50 dark:bg-red-900/10',
        warning: 'text-amber-500 bg-amber-50 dark:bg-amber-900/10',
        info: 'text-primary bg-primary/10 dark:bg-primary/10'
    };

    const icons = {
        danger: 'warning',
        warning: 'error',
        info: 'info'
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4 animate-in fade-in duration-200">
            <div
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 w-full max-w-md shadow-2xl scale-100 animate-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="p-6">
                    <div className="flex gap-4">
                        <div className={`size-12 rounded-full flex items-center justify-center flex-shrink-0 ${iconColors[type]}`}>
                            <span className="material-symbols-outlined text-2xl">{icons[type]}</span>
                        </div>
                        <div className="flex-1">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">{title}</h3>
                            <div className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">
                                {typeof message === 'string' ? <p>{message}</p> : message}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 rounded-b-2xl flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        disabled={isLoading}
                        className="px-4 py-2 text-sm font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors disabled:opacity-50"
                    >
                        {cancelText}
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={isLoading}
                        className={`px-6 py-2 text-sm font-bold text-white rounded-lg transition-all shadow-sm disabled:opacity-50 flex items-center gap-2 ${bgColors[type]}`}
                    >
                        {isLoading && <span className="material-symbols-outlined text-base animate-spin">sync</span>}
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
};
