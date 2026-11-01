import { HiX } from 'react-icons/hi';
import { useId } from 'react';
import { createPortal } from 'react-dom';
import { useDialogFocus } from './useDialogFocus';

export default function Modal({ open, onClose, title, children, size = 'lg' }) {
    const titleId = useId();
    const dialogRef = useDialogFocus(open, onClose);
    if (!open) return null;

    const sizeClasses = {
        sm: 'max-w-md',
        md: 'max-w-lg',
        lg: 'max-w-2xl',
        xl: 'max-w-4xl',
        full: 'max-w-6xl',
    };

    return createPortal(
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <div className="fixed inset-0 ui-dialog-backdrop" onClick={onClose} />
            <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} className={`ui-dialog relative bg-white ${sizeClasses[size]} w-full flex flex-col`}>
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                    <h2 id={titleId} className="text-lg font-semibold text-gray-900">{title}</h2>
                    <button
                        onClick={onClose}
                        type="button" aria-label="Close dialog"
                        className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                        <HiX className="w-5 h-5" />
                    </button>
                </div>
                {/* Body */}
                <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5">
                    {children}
                </div>
            </div>
        </div>, document.body
    );
}
