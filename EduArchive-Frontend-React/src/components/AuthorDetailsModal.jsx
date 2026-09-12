import { useEffect } from 'react';
import { HiOutlineUserGroup, HiX, HiOutlineMail, HiOutlinePhone } from 'react-icons/hi';

/**
 * AuthorDetailsModal
 *
 * Shows a table of author contact details (name, email, contact number).
 * Fully theme-aware: uses CSS variables that resolve correctly in both
 * dark mode (default) and light mode ([data-theme="light"]).
 *
 * The modal panel uses --color-bg-secondary (solid, never transparent)
 * as its base so it never bleeds through in dark mode.
 *
 * Props:
 *   open         – boolean
 *   onClose      – () => void
 *   capstone     – { title: string, author: string, author_details: array|null }
 */
export default function AuthorDetailsModal({ open, onClose, capstone }) {
    // Close on Escape key
    useEffect(() => {
        if (!open) return;
        const onKey = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, onClose]);

    if (!open || !capstone) return null;

    // Build rows: prefer structured author_details, else derive from comma-split author string
    const rows = (() => {
        if (capstone.author_details && Array.isArray(capstone.author_details) && capstone.author_details.length > 0) {
            return capstone.author_details;
        }
        return (capstone.author || '')
            .split(',')
            .map(s => s.trim())
            .filter(s => s.length > 1)
            .map(name => ({ name, email: '', contact: '' }));
    })();

    const hasContact = rows.some(r => r.email || r.contact);

    return (
        <>
            {/* Backdrop — solid dark overlay, no blur */}
            <div
                className="fixed inset-0 z-50 bg-black/70"
                onClick={onClose}
            />

            {/* Modal panel — centred over backdrop */}
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
                <div
                    className="pointer-events-auto w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden"
                    style={{
                        background: 'var(--color-bg-secondary)',
                        border: '1px solid var(--color-border-strong)',
                        boxShadow: 'var(--shadow-lg)',
                    }}
                >
                    {/* Header */}
                    <div
                        className="px-6 py-4 flex items-center justify-between border-b"
                        style={{
                            background: 'var(--color-bg-tertiary)',
                            borderColor: 'var(--color-border-strong)',
                        }}
                    >
                        <div className="flex items-center gap-3">
                            <div
                                className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                                style={{ background: 'rgba(91,190,99,0.15)' }}
                            >
                                <HiOutlineUserGroup className="w-5 h-5" style={{ color: 'var(--color-primary)' }} />
                            </div>
                            <div>
                                <h2 className="text-base font-bold" style={{ color: 'var(--color-text)' }}>
                                    Authors Details
                                </h2>
                                <p className="text-xs mt-0.5 truncate max-w-xs" style={{ color: 'var(--color-text-muted)' }}>
                                    {capstone.title}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-1.5 rounded-lg transition-colors"
                            style={{ color: 'var(--color-text-muted)' }}
                            onMouseEnter={e => e.currentTarget.style.background = 'var(--color-bg)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                            <HiX className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Body */}
                    <div className="p-6">
                        {rows.length === 0 ? (
                            <p className="text-sm text-center py-8" style={{ color: 'var(--color-text-muted)' }}>
                                No author information available.
                            </p>
                        ) : (
                            <div
                                className="overflow-x-auto rounded-xl border"
                                style={{ borderColor: 'var(--color-border-strong)' }}
                            >
                                <table className="w-full text-sm border-collapse">
                                    <thead>
                                        <tr style={{ background: 'var(--color-bg-tertiary)' }}>
                                            <th
                                                className="text-left text-xs font-semibold uppercase tracking-wider px-4 py-3"
                                                style={{ color: 'var(--color-text-muted)', width: '35%' }}
                                            >
                                                Name
                                            </th>
                                            {hasContact && (
                                                <>
                                                    <th
                                                        className="text-left text-xs font-semibold uppercase tracking-wider px-4 py-3"
                                                        style={{ color: 'var(--color-text-muted)', width: '35%' }}
                                                    >
                                                        Email
                                                    </th>
                                                    <th
                                                        className="text-left text-xs font-semibold uppercase tracking-wider px-4 py-3"
                                                        style={{ color: 'var(--color-text-muted)', width: '30%' }}
                                                    >
                                                        Contact Number
                                                    </th>
                                                </>
                                            )}
                                        </tr>
                                    </thead>
                                    <tbody
                                        className="divide-y"
                                        style={{ borderColor: 'var(--color-border)' }}
                                    >
                                        {rows.map((row, idx) => (
                                            <tr
                                                key={idx}
                                                style={{
                                                    background: idx % 2 === 0
                                                        ? 'var(--color-bg-secondary)'
                                                        : 'var(--color-bg-tertiary)',
                                                }}
                                            >
                                                <td className="px-4 py-3">
                                                    <span
                                                        className="font-medium text-sm"
                                                        style={{ color: 'var(--color-text)' }}
                                                    >
                                                        {row.name}
                                                    </span>
                                                </td>
                                                {hasContact && (
                                                    <>
                                                        <td className="px-4 py-3">
                                                            {row.email ? (
                                                                <a
                                                                    href={`mailto:${row.email}`}
                                                                    className="inline-flex items-center gap-1.5 text-sm hover:underline"
                                                                    style={{ color: 'var(--color-primary)' }}
                                                                >
                                                                    <HiOutlineMail className="w-3.5 h-3.5 flex-shrink-0" />
                                                                    {row.email}
                                                                </a>
                                                            ) : (
                                                                <span style={{ color: 'var(--color-text-faint)' }}>—</span>
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            {row.contact ? (
                                                                <a
                                                                    href={`tel:${row.contact}`}
                                                                    className="inline-flex items-center gap-1.5 text-sm hover:underline"
                                                                    style={{ color: 'var(--color-primary)' }}
                                                                >
                                                                    <HiOutlinePhone className="w-3.5 h-3.5 flex-shrink-0" />
                                                                    {row.contact}
                                                                </a>
                                                            ) : (
                                                                <span style={{ color: 'var(--color-text-faint)' }}>—</span>
                                                            )}
                                                        </td>
                                                    </>
                                                )}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {!hasContact && rows.length > 0 && (
                            <p className="text-xs mt-3 text-center" style={{ color: 'var(--color-text-faint)' }}>
                                Contact information was not extracted from this capstone's PDF.
                            </p>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}
