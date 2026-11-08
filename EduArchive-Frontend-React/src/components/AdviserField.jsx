import { useEffect, useState } from 'react';
import api from '../api/axios';
import { matchAdviser } from '../utils/adviserMatching';

export default function AdviserField({ name, selectedId, onChange, disabled = false, inputClassName }) {
    const [faculty, setFaculty] = useState([]);
    const [status, setStatus] = useState('loading');
    const [attempt, setAttempt] = useState(0);
    useEffect(() => {
        let cancelled = false;
        api.get('/uploads/advisers').then(response => {
            if (cancelled) return;
            setFaculty(response.data.data || []);
            setStatus('ready');
        }).catch(() => { if (!cancelled) setStatus('failed'); });
        return () => { cancelled = true; };
    }, [attempt]);
    const { matches, id } = matchAdviser(name, faculty, selectedId);
    const linked = matches.find(account => account.id === id);

    return (
        <div className="rounded-2xl border p-5" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
            <label htmlFor="metadata-adviser" className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--color-text-muted)' }}>Adviser name</label>
            <input id="metadata-adviser" type="text" value={name || ''} maxLength={255} disabled={disabled}
                onChange={event => onChange(event.target.value, null)} className={inputClassName}
                placeholder="Name above Adviser on the approval sheet" aria-describedby="adviser-match-status" />
            <p id="adviser-match-status" role="status" className="text-xs mt-2" style={{ color: 'var(--color-text-secondary)' }}>
                {status === 'loading' ? 'Loading Faculty accounts…' : status === 'failed'
                    ? 'Faculty matching is unavailable. Your name will be checked again when saved.'
                    : linked ? `Assigned Faculty: ${linked.name} (@${linked.username})`
                        : matches.length > 1 ? 'Multiple Faculty accounts match. Select the correct account below, or leave unassigned.'
                            : name?.trim() ? 'No available Faculty account matches. The adviser name will be saved without an assignment.'
                                : 'Review the extracted name or enter it manually. Matching ignores capitalization and extra spaces.'}
            </p>
            {status === 'failed' && <button type="button" onClick={() => { setStatus('loading'); setAttempt(value => value + 1); }} className="text-xs underline mt-2">Retry Faculty matching</button>}
            {matches.length > 1 && (
                <div className="mt-3">
                    <label htmlFor="metadata-adviser-account" className="block text-xs font-semibold mb-2">Faculty account</label>
                    <select id="metadata-adviser-account" value={id ?? ''} disabled={disabled} className={inputClassName}
                        onChange={event => onChange(name, event.target.value ? Number(event.target.value) : null)}>
                        <option value="">Leave Faculty assignment empty</option>
                        {matches.map(account => <option key={account.id} value={account.id}>{account.name} — @{account.username}{account.faculty_program ? ` · ${account.faculty_program}` : ''}</option>)}
                    </select>
                </div>
            )}
        </div>
    );
}
