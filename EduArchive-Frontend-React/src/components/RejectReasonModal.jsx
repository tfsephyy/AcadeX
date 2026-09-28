import { useState, useEffect, useRef } from 'react';
import { HiOutlineX, HiOutlineExclamation } from 'react-icons/hi';

/**
 * RejectReasonModal
 *
 * Themed modal that replaces the native browser prompt() for capstone rejection.
 * Matches the system glass / CSS-custom-property design language.
 *
 * Props:
 *   open        – boolean
 *   title       – string (capstone title shown in subtitle)
 *   onConfirm   – (reason: string) => void
 *   onCancel    – () => void
 */
export default function RejectReasonModal({ open, title, onConfirm, onCancel }) {
    const [reason, setReason] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const textareaRef = useRef(null);

    // Reset & focus whenever modal opens
    useEffect(() => {
        if (open) {
            setReason('');
            setSubmitting(false);
            setTimeout(() => textareaRef.current?.focus(), 80);
        }
    }, [open]);

    // Close on Escape
    useEffect(() => {
        if (!open) return;
        const handler = (e) => { if (e.key === 'Escape') onCancel(); };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [open, onCancel]);

    if (!open) return null;

    const handleConfirm = async () => {
        setSubmitting(true);
        try {
            await onConfirm(reason.trim());
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
                onClick={onCancel}
            />

            {/* Panel */}
            <div className="relative glass-strong rounded-2xl shadow-2xl w-full max-w-md animate-scale-in overflow-hidden"
                style={{ boxShadow: 'var(--shadow-lg), var(--shadow-glow)' }}
            >
                {/* Top accent stripe */}
                <div className="h-1 w-full bg-gradient-to-r from-red-500 via-red-400 to-orange-400" />

                {/* Header */}
                <div className="flex items-center justify-between px-6 pt-5 pb-4"
                    style={{ borderBottom: '1px solid var(--color-border)' }}
                >
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-red-500/15 border border-red-500/25">
                            <HiOutlineExclamation className="w-5 h-5 text-red-400" />
                        </div>
                        <div>
                            <h3 className="text-base font-semibold" style={{ color: 'var(--color-text)' }}>
                                Reject Capstone
                            </h3>
                            {title && (
                                <p className="text-xs mt-0.5 truncate max-w-[260px]"
                                    style={{ color: 'var(--color-text-muted)' }}
                                    title={title}
                                >
                                    {title}
                                </p>
                            )}
                        </div>
                    </div>
                    <button
                        onClick={onCancel}
                        disabled={submitting}
                        className="p-1.5 rounded-lg transition-colors disabled:opacity-50"
                        style={{ color: 'var(--color-text-muted)' }}
                        onMouseEnter={e => {
                            e.currentTarget.style.background = 'var(--color-surface-hover)';
                            e.currentTarget.style.color = 'var(--color-text)';
                        }}
                        onMouseLeave={e => {
                            e.currentTarget.style.background = 'transparent';
                            e.currentTarget.style.color = 'var(--color-text-muted)';
                        }}
                        aria-label="Close"
                    >
                        <HiOutlineX className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="px-6 py-5 space-y-4">
                    <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                        Provide an optional reason for rejection. This will be visible to the student
                        so they can improve and resubmit.
                    </p>

                    <div className="space-y-1.5">
                        <label
                            htmlFor="reject-reason"
                            className="block text-xs font-medium uppercase tracking-wide"
                            style={{ color: 'var(--color-text-muted)' }}
                        >
                            Rejection Reason
                            <span className="ml-1 normal-case font-normal" style={{ color: 'var(--color-text-faint)' }}>
                                (optional)
                            </span>
                        </label>
                        <textarea
                            id="reject-reason"
                            ref={textareaRef}
                            value={reason}
                            onChange={e => setReason(e.target.value)}
                            rows={4}
                            placeholder="e.g. The abstract does not clearly state the research objectives. Please revise and resubmit."
                            className="input-field resize-none"
                            style={{ borderRadius: '12px' }}
                            maxLength={1000}
                        />
                        <div className="flex justify-end">
                            <span className="text-xs" style={{ color: 'var(--color-text-faint)' }}>
                                {reason.length} / 1000
                            </span>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 px-6 pb-6 pt-2"
                    style={{ borderTop: '1px solid var(--color-border)' }}
                >
                    <button
                        onClick={onCancel}
                        disabled={submitting}
                        className="btn-outline !py-2.5 !px-5 !text-sm disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={submitting}
                        className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white rounded-xl
                                   bg-red-600 hover:bg-red-700 active:bg-red-800
                                   focus:outline-none focus:ring-2 focus:ring-red-500/50
                                   disabled:opacity-60 disabled:cursor-not-allowed
                                   transition-colors"
                    >
                        {submitting ? (
                            <>
                                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Rejecting…
                            </>
                        ) : (
                            'Reject Capstone'
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
