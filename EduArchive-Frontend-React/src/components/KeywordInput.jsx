import { useId, useState } from 'react';
import { HiOutlinePencil, HiOutlineX, HiOutlinePlus } from 'react-icons/hi';
import { changeKeywords, MAX_KEYWORDS } from '../utils/keywords';

/** One editor for upload review and existing capstones. Changes are explicit. */
export default function KeywordInput({ keywords, onChange, onValidationChange, validationError, disabled = false, inputClassName = '' }) {
    const id = useId();
    const [draft, setDraft] = useState('');
    const [editing, setEditing] = useState(null);
    const [replacement, setReplacement] = useState('');
    const [localError, setError] = useState('');
    const error = validationError ?? localError;
    const reportError = message => { setError(message); onValidationChange?.(message); };

    const commit = (raw = draft, index = null) => {
        const result = changeKeywords(keywords, raw, index);
        reportError(result.error);
        if (result.error) return;
        onChange(result.keywords);
        if (index === null) setDraft('');
        else setEditing(null);
    };
    const remove = index => {
        onChange(keywords.filter((_, position) => position !== index));
        reportError('');
        setEditing(null);
    };

    return <div>
        <div className="flex flex-wrap gap-2 mb-3 min-h-[32px]">
            {keywords.map((keyword, index) => editing === index ? (
                <div key={index} className="flex flex-wrap gap-2 w-full">
                    <input aria-label="Keyword value" value={replacement} disabled={disabled}
                        onChange={event => setReplacement(event.target.value)} className={inputClassName + ' flex-1 min-w-0'}
                        onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); commit(replacement, index); } }} />
                    <button type="button" disabled={disabled} onClick={() => commit(replacement, index)} className="text-sm px-2">Save keyword</button>
                    <button type="button" disabled={disabled} onClick={() => { setEditing(null); reportError(''); }} className="text-sm px-2">Cancel</button>
                </div>
            ) : (
                <span key={index} className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full border max-w-full"
                    style={{ background: 'rgba(91,190,99,0.12)', color: 'var(--color-primary)', borderColor: 'var(--color-border-strong)' }}>
                    <span className="break-all">{keyword}</span>
                    <button type="button" aria-label={`Edit keyword ${keyword}`} disabled={disabled}
                        onClick={() => { setEditing(index); setReplacement(keyword); reportError(''); }} className="p-0.5 disabled:opacity-40">
                        <HiOutlinePencil className="w-3 h-3" />
                    </button>
                    <button type="button" aria-label={`Remove keyword ${keyword}`} disabled={disabled}
                        onClick={() => remove(index)} className="p-0.5 hover:text-red-400 disabled:opacity-40">
                        <HiOutlineX className="w-3 h-3" />
                    </button>
                </span>
            ))}
            {!keywords.length && <span className="text-xs italic" style={{ color: 'var(--color-text-faint)' }}>No keywords yet</span>}
        </div>
        <div className="flex gap-2">
            <input id={id} aria-label="Add keywords" value={draft} disabled={disabled}
                aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : `${id}-help`}
                placeholder="Add keywords, separated by commas…" className={inputClassName + ' flex-1 min-w-0'}
                onChange={event => {
                    const value = event.target.value;
                    setDraft(value);
                    reportError('');
                    if (value.includes(',') && value.split(',').some(term => term.trim())) commit(value);
                }}
                onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); commit(); } }} />
            <button type="button" disabled={disabled} onClick={() => commit()}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border disabled:opacity-40"
                style={{ background: 'rgba(91,190,99,0.12)', color: 'var(--color-primary)', borderColor: 'var(--color-border-strong)' }}>
                <HiOutlinePlus className="w-4 h-4" /> Add
            </button>
            {(draft || error) && <button type="button" aria-label="Clear keyword input" disabled={disabled}
                onClick={() => { setDraft(''); reportError(''); }} className="text-sm px-2">Clear</button>}
        </div>
        {error && <p id={`${id}-error`} role="alert" className="text-xs mt-2 text-red-500">{error}</p>}
        <p id={`${id}-help`} className="text-xs mt-2" style={{ color: 'var(--color-text-muted)' }}>
            {keywords.length}/{MAX_KEYWORDS} keywords. Separate entries with commas; use Enter or Add for a single entry. Edit or remove tags individually.
        </p>
    </div>;
}
