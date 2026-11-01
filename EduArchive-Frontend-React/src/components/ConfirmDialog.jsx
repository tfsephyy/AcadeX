import { HiExclamation } from 'react-icons/hi';
import { useId } from 'react';
import { createPortal } from 'react-dom';
import { useDialogFocus } from './useDialogFocus';

export default function ConfirmDialog({ open, title, message, confirmText = 'Confirm', cancelText = 'Cancel', onConfirm, onCancel, variant = 'danger' }) {
    const titleId = useId();
    const messageId = useId();
    const dialogRef = useDialogFocus(open, onCancel);
    if (!open) return null;

    const variantStyles = {
        danger: 'bg-red-600 hover:bg-red-700 focus:ring-red-500',
        warning: 'bg-yellow-600 hover:bg-yellow-700 focus:ring-yellow-500',
        success: 'bg-green-600 hover:bg-green-700 focus:ring-green-500',
        info: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500',
    };

    const iconColorMap = {
        danger: 'bg-red-100 text-red-600',
        warning: 'bg-yellow-100 text-yellow-600',
        success: 'bg-green-100 text-green-600',
        info: 'bg-blue-100 text-blue-600',
    };

    return createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="fixed inset-0 ui-dialog-backdrop" onClick={onCancel} />
            <div ref={dialogRef} role="alertdialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={messageId} tabIndex={-1} className="ui-dialog relative max-w-md w-full p-6 overflow-y-auto flex flex-col">
                <div className="flex items-start gap-4">
                    <div className={`p-2 rounded-full flex-shrink-0 ${iconColorMap[variant]}`}>
                        <HiExclamation className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                        <h3 id={titleId} className="text-lg font-semibold text-gray-900">{title}</h3>
                        <p id={messageId} className="mt-2 text-sm text-gray-500 leading-relaxed">{message}</p>
                    </div>
                </div>
                <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-100">
                    <button
                        onClick={onCancel}
                        data-dialog-autofocus type="button"
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-300 transition-colors"
                    >
                        {cancelText}
                    </button>
                    <button
                        onClick={onConfirm}
                        type="button"
                        className={`px-4 py-2 text-sm font-medium text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors ${variantStyles[variant]}`}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>, document.body
    );
}
