import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    HiArrowLeft, HiArrowRight, HiOutlineDocumentText,
    HiOutlineUserGroup, HiOutlineInformationCircle, HiCheck,
    HiOutlineRefresh, HiOutlineClock,
} from 'react-icons/hi';
import CategoryCombobox from './CategoryCombobox';
import AdviserField from './AdviserField';
import KeywordInput from './KeywordInput';
import { keywordError } from '../utils/keywords';
import { useNotification } from './useNotification';
import { getExtractionNotice } from './extractionNotice';
import api from '../api/axios';
import { getApiErrorMessage } from '../api/errors';
import { useCapstoneUpload } from './useCapstoneUpload';
import { mergeMetadataReview } from '../utils/metadataReview';

export default function ReviewExtractedDataPage({ nextPath, backPath }) {
    const navigate = useNavigate();
    const location = useLocation();
    const notify = useNotification();
    const { manager: uploadManager } = useCapstoneUpload();
    const [checkingTitle, setCheckingTitle] = useState(false);
    const [titleError, setTitleError] = useState('');
    const [keywordInputError, setKeywordInputError] = useState('');

    const state = location.state || {};
    const { pdfInfo } = state;
    const initialExtracted = state.extracted || {};
    const uploadId = state.uploadId || pdfInfo?.upload_id || null;
    const initialStatus = state.processingStatus || state.extractionStatus || 'completed';

    useEffect(() => {
        if (!pdfInfo) navigate(backPath, { replace: true });
    }, []);

    const [form, setForm] = useState({
        title:    initialExtracted.title    || '',
        year:     initialExtracted.year     || '',
        author:   initialExtracted.author   || '',
        program: 'BSIT',
        category: initialExtracted.category || '',
        abstract: initialExtracted.abstract || '',
        keywords: initialExtracted.keywords || [],
        adviser_name: initialExtracted.adviser_name || '',
        adviser_id: initialExtracted.adviser_id || null,
    });
    const [processingStatus, setProcessingStatus] = useState(initialStatus);
    const [processingError, setProcessingError] = useState(state.processingError || '');
    const [extractionStatus, setExtractionStatus] = useState(state.extractionStatus || initialStatus);
    const [extractionScope, setExtractionScope] = useState(state.extractionScope || '');
    const [notes, setNotes] = useState(state.notes || []);
    const [retrying, setRetrying] = useState(false);
    const [pollExpired, setPollExpired] = useState(false);
    const [retryable, setRetryable] = useState(Boolean(state.retryable));
    const pollTimer = useRef(null);
    const editedFields = useRef(new Set(state.editedFields || []));
    const editField = (field, value) => {
        editedFields.current.add(field);
        setForm(prev => ({ ...prev, [field]: value }));
    };

    const isStillProcessing = ['queued', 'processing'].includes(processingStatus);
    const processing = isStillProcessing && !pollExpired;

    // ── Author details: [{name, email, contact}] — synced from author field
    const parseAuthorsFromString = (authorStr) => {
        return (authorStr || '').split(',').map(s => s.trim()).filter(s => s.length > 1).map(name => ({ name, email: '', contact: '' }));
    };

    const [authorDetails, setAuthorDetails] = useState(() => {
        if (initialExtracted?.author_details && Array.isArray(initialExtracted.author_details) && initialExtracted.author_details.length > 0) {
            return initialExtracted.author_details;
        }
        return parseAuthorsFromString(initialExtracted?.author || '');
    });

    const mergeExtracted = useCallback((data) => {
        if (!data || typeof data !== 'object') return;
        setForm(prev => mergeMetadataReview(prev, data, editedFields.current));
        setAuthorDetails(prev => {
            if (editedFields.current.has('author') || editedFields.current.has('author_details')) return prev;
            if (prev.some(row => row.email || row.contact)) return prev;
            if (Array.isArray(data.author_details) && data.author_details.length > 0) return data.author_details;
            return parseAuthorsFromString(data.author || '');
        });
    }, []);

    // ── Poll the queued server job. The job keeps running if this page is
    //    closed; this effect only controls what is displayed here.
    useEffect(() => {
        if (!uploadId || !processing) {
            if (pollTimer.current) clearTimeout(pollTimer.current);
            return;
        }

        let cancelled = false;
        let attempts = 0;

        const poll = async () => {
            if (cancelled) return;
            attempts += 1;
            try {
                const res = await api.get(`/uploads/${uploadId}/status`);
                if (cancelled) return;
                const data = res.data.data || {};

                uploadManager.observeStatus(uploadId, data);

                setProcessingStatus(data.processing_status || 'completed');
                setProcessingError(data.processing_error || '');
                setExtractionStatus(data.extraction_status || data.processing_status);
                setExtractionScope(data.extraction_scope || '');
                setNotes(Array.isArray(data.notes) ? data.notes : []);
                setRetryable(Boolean(data.retryable));

                if (data.processing_status === 'completed') {
                    mergeExtracted(data.extracted || {});
                    notify.success('Document processing completed. Review the suggestions below.');
                    return;
                }
                if (data.processing_status === 'failed') {
                    notify.error(data.processing_error || 'Processing did not finish. You can retry or enter the details manually.');
                    return;
                }
                if (attempts >= 300) {
                    setPollExpired(true);
                    notify.info?.('Processing is taking longer than usual. You can keep this page open or enter details manually.');
                    return;
                }
                pollTimer.current = setTimeout(poll, 3000);
            } catch (error) {
                if (cancelled) return;
                if (error?.response?.status === 404 || error?.response?.status === 410) {
                    setProcessingStatus('failed');
                    setProcessingError(getApiErrorMessage(error, 'This upload is no longer available. Upload the PDF again.'));
                    return;
                }
                if (attempts >= 8) {
                    // The job itself is not cancelled; polling just backs off.
                    pollTimer.current = setTimeout(poll, 10000);
                } else {
                    pollTimer.current = setTimeout(poll, 4000);
                }
            }
        };

        poll();
        return () => {
            cancelled = true;
            if (pollTimer.current) clearTimeout(pollTimer.current);
        };
    }, [uploadId, processing, mergeExtracted, notify, uploadManager]);

    if (!pdfInfo) return null;

    const retryProcessing = async () => {
        if (!uploadId || retrying) return;
        setRetrying(true);
        try {
            const res = await api.post(`/uploads/${uploadId}/retry`);
            const data = res.data.data || {};
            uploadManager.observeStatus(uploadId, data);
            setProcessingStatus(data.processing_status || 'queued');
            setProcessingError('');
            setExtractionStatus(data.extraction_status || 'queued');
            setPollExpired(false);
            notify.success('Document processing was queued again.');
        } catch (error) {
            notify.error(getApiErrorMessage(error, 'Processing could not be retried.'));
        } finally {
            setRetrying(false);
        }
    };

    // Keep authorDetails rows in sync when the author field changes
    const handleAuthorFieldChange = (newAuthorStr) => {
        editField('author', newAuthorStr);
        const newNames = (newAuthorStr || '').split(',').map(s => s.trim()).filter(s => s.length > 1);
        setAuthorDetails(prev => {
            const updated = newNames.map(name => {
                const existing = prev.find(r => r.name.trim().toLowerCase() === name.toLowerCase());
                return existing ? { ...existing, name } : { name, email: '', contact: '' };
            });
            return updated;
        });
    };

    const updateAuthorDetail = (index, field, value) => {
        editedFields.current.add('author_details');
        setAuthorDetails(prev => prev.map((row, i) => i === index ? { ...row, [field]: value } : row));
    };

    const handleBack = () => {
        if (window.confirm('Discard this uploaded PDF and return to the upload step?')) {
            const activeUploadId = uploadManager.getSnapshot().task?.data?.upload_id;
            if (!uploadId || activeUploadId === uploadId) {
                uploadManager.dismiss();
            } else {
                void api.delete(`/uploads/${uploadId}`).catch(() => {});
            }
            navigate(backPath);
        }
    };

    const handleNext = async () => {
        if (processing) { notify.info?.('Please wait for document processing to finish, or retry if it failed.'); return; }
        if (!form.title.trim()) { notify.error('Title is required.'); return; }
        if (!form.author.trim()) { notify.error('Author is required.'); return; }
        if (keywordInputError) { notify.error(keywordInputError); return; }
        if (keywordError(form.keywords)) { notify.error(keywordError(form.keywords)); return; }

        // Check for duplicate title before proceeding
        setCheckingTitle(true);
        setTitleError('');
        try {
            const res = await api.get('/capstones/check-title', { params: { title: form.title.trim() } });
            if (res.data?.data?.exists) {
                setTitleError('A capstone with this title already exists.');
                notify.error('A capstone with this title already exists. Please use a different title.');
                setCheckingTitle(false);
                return;
            }
        } catch (err) {
            // If check fails, let the user proceed — backend store() will catch duplicates
            console.warn('Title check failed, proceeding anyway:', err);
        }
        setCheckingTitle(false);

        const reviewed = { ...form, author_details: authorDetails };
                // Keep this history entry's draft so Back from Additional Info restores
        // the user's corrections instead of reinitializing from OCR suggestions.
        navigate(location.pathname, { replace: true, state: { ...location.state, extracted: reviewed,
            editedFields: [...editedFields.current], processingStatus, extractionStatus, extractionScope, notes } });
        navigate(nextPath, { state: { form: reviewed, pdfInfo } });
    };

    const inputCls = "w-full px-3.5 py-2.5 rounded-lg text-sm outline-none transition border"
        + " bg-[var(--input-bg)] border-[var(--input-border)] text-[var(--input-text)]"
        + " placeholder-[var(--input-placeholder)] focus:border-[var(--color-primary)]"
        + " focus:ring-2 focus:ring-[var(--color-primary)]/30";

    return (
        <div className="upload-review min-h-screen flex flex-col" style={{ background: 'var(--color-bg)' }}>

            {/* ── Top Bar ─────────────────────────────────── */}
            <div className="sticky top-0 z-20 border-b" style={{ background: 'var(--color-surface-elevated)', borderColor: 'var(--color-border-strong)', backdropFilter: 'blur(16px)' }}>
                <div className="max-w-6xl mx-auto px-4 lg:px-8 py-3.5 flex items-center justify-between gap-4">
                    <button onClick={handleBack} className="inline-flex items-center gap-2 text-sm transition-colors" style={{ color: 'var(--color-text-secondary)' }}
                        onMouseEnter={e => e.currentTarget.style.color = 'var(--color-text)'}
                        onMouseLeave={e => e.currentTarget.style.color = 'var(--color-text-secondary)'}>
                        <HiArrowLeft className="w-4 h-4" /> Back
                    </button>

                    {/* Step pills */}
                    <div className="flow-steps flex items-center gap-2" aria-label="Submission steps">
                        {[
                            { label: 'Upload PDF', done: true },
                            { label: 'Review Data', active: true },
                            { label: 'Additional Info', upcoming: true },
                        ].map((s, i) => (
                            <div key={i} className="flex items-center gap-2">
                                <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                                    s.active ? 'text-white' : ''
                                }`} aria-current={s.active ? 'step' : undefined} style={s.active ? { background: '#1B5E20' } : s.done ? { background: 'rgba(27,94,32,0.15)', color: 'var(--color-link)' } : { background: 'var(--color-bg-tertiary)', color: 'var(--color-text-muted)' }}>
                                    <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${s.active ? 'bg-white text-[#1B5E20]' : s.done ? 'bg-[#1B5E20] text-white' : ''}`}
                                        style={s.upcoming ? { background: 'var(--color-border-strong)', color: 'var(--color-text-muted)' } : {}}>
                                        {s.done ? <HiCheck aria-label="Completed" /> : i + 1}
                                    </span>
                                    {s.label}
                                </div>
                                {i < 2 && <div className="w-4 h-px" style={{ background: 'var(--color-border-strong)' }} />}
                            </div>
                        ))}
                    </div>

                    <div className="text-xs hidden sm:block" style={{ color: 'var(--color-text-muted)' }}>Step 2 of 3</div>
                </div>
            </div>

            {/* ── Scrollable Content ───────────────────────── */}
            <div className="flex-1 overflow-y-auto admin-scroll pb-28">
                <div className="max-w-6xl mx-auto px-4 lg:px-8 py-6 space-y-5">

                    {/* PDF file banner */}
                    <div className="flex items-center gap-3 p-4 rounded-2xl text-white" style={{ background: 'var(--document-banner)' }}>
                        <HiOutlineDocumentText className="w-8 h-8 flex-shrink-0" style={{ color: 'rgba(255,255,255,0.6)' }} />
                        <div>
                            <p className="text-xs font-medium uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.6)' }}>Uploaded PDF</p>
                            <p className="text-sm font-semibold">{pdfInfo.pdf_original_name}</p>
                        </div>
                    </div>

                    {/* Processing state / extraction notice */}
                    {processing ? (
                        <div className="p-4 rounded-xl border flex items-start gap-3" style={{ background: 'rgba(59,130,246,0.10)', borderColor: 'rgba(59,130,246,0.3)' }} role="status" aria-live="polite">
                            <HiOutlineClock className="w-5 h-5 flex-shrink-0 animate-pulse" style={{ color: '#2563eb' }} aria-hidden="true" />
                            <div>
                                <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
                                    {processingStatus === 'queued' ? 'Document queued for processing' : 'Reading your document'}
                                </p>
                                <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                                    You can leave this page safely — processing continues in the background and you will be notified when it finishes. The fields unlock when suggestions are ready.
                                </p>
                            </div>
                        </div>
                    ) : isStillProcessing && pollExpired ? (
                        <div className="p-3.5 rounded-xl border" style={{ background: 'rgba(245,158,11,0.1)', borderColor: 'rgba(245,158,11,0.3)' }}>
                            <p className="extraction-notice" style={{ color: 'var(--color-text-secondary)' }}><HiOutlineInformationCircle aria-hidden="true" />
                                Processing is taking longer than usual and continues in the background. You may enter the details manually now; suggestions that finish later will not overwrite what you type.
                            </p>
                        </div>
                    ) : processingStatus === 'failed' || extractionStatus === 'failed' ? (
                        <div className="p-4 rounded-xl border" style={{ background: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.3)' }} role="alert">
                            <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>Automatic processing did not finish</p>
                            <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                                {processingError || 'The file is safe. You can retry processing or continue by entering the details manually.'}
                            </p>
                            {uploadId && (
                                <button type="button" onClick={retryProcessing} disabled={retrying}
                                    className="mt-3 inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border transition-colors disabled:opacity-50"
                                    style={{ color: 'var(--color-primary)', borderColor: 'var(--color-border-strong)', background: 'var(--color-bg-secondary)' }}>
                                    <HiOutlineRefresh className={`w-4 h-4 ${retrying ? 'animate-spin' : ''}`} />
                                    {retrying ? 'Queuing again…' : 'Retry processing'}
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="p-3.5 rounded-xl border" style={{ background: 'rgba(245,158,11,0.1)', borderColor: 'rgba(245,158,11,0.3)' }}>
                            <p className="extraction-notice" style={{ color: 'var(--color-text-secondary)' }}><HiOutlineInformationCircle aria-hidden="true" />
                                {getExtractionNotice({ extractionStatus, extractionScope, extracted: form })}
                            </p>
                            {retryable && uploadId && (
                                <button type="button" onClick={retryProcessing} disabled={retrying}
                                    className="mt-3 inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border transition-colors disabled:opacity-50"
                                    style={{ color: 'var(--color-primary)', borderColor: 'var(--color-border-strong)', background: 'var(--color-bg-secondary)' }}>
                                    <HiOutlineRefresh className={`w-4 h-4 ${retrying ? 'animate-spin' : ''}`} />
                                    {retrying ? 'Queuing again…' : 'Retry processing'}
                                </button>
                            )}
                        </div>
                    )}

                    {!processing && Array.isArray(notes) && notes.length > 0 && (
                        <ul className="text-xs space-y-1 px-1" style={{ color: 'var(--color-text-muted)' }}>
                            {notes.map((note, index) => <li key={index}>• {note}</li>)}
                        </ul>
                    )}

                    {/* ── Row 1: Title + Author ─────────────── */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                        <div className="rounded-2xl border p-5 space-y-1" style={{ background: 'var(--color-surface)', borderColor: titleError ? '#ef4444' : 'var(--color-border)' }}>
                            <label htmlFor="metadata-title" className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: titleError ? '#ef4444' : 'var(--color-text-muted)' }}>
                                Title <span className="text-red-400">*</span>
                            </label>
                            <input id="metadata-title" type="text" value={form.title}
                                onChange={(e) => { editField('title', e.target.value); setTitleError(''); }}
                                disabled={processing}
                                className={inputCls} placeholder="Capstone title..."
                                style={titleError ? { borderColor: '#ef4444' } : {}} />
                            {titleError && (
                                <p className="text-xs mt-1.5 font-medium" style={{ color: '#ef4444' }}>{titleError}</p>
                            )}
                        </div>
                        <div className="rounded-2xl border p-5 space-y-1" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
                            <label htmlFor="metadata-author" className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--color-text-muted)' }}>
                                Author <span className="text-red-400">*</span>
                            </label>
                            <input id="metadata-author" type="text" value={form.author}
                                onChange={(e) => handleAuthorFieldChange(e.target.value)}
                                disabled={processing}
                                className={inputCls} placeholder="Author name(s) separated by commas..." />
                            <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>Separate multiple authors with commas</p>
                        </div>
                    </div>

                    {/* ── Row 2: Year + Program + Category ─── */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                        <div className="rounded-2xl border p-5" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
                            <label htmlFor="metadata-year" className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--color-text-muted)' }}>Year</label>
                            <input id="metadata-year" type="number" value={form.year}
                                onChange={(e) => editField('year', e.target.value)}
                                disabled={processing}
                                className={inputCls} min="2000" max="2099" placeholder="2024" />
                        </div>
                        <div className="rounded-2xl border p-5" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
                            <label htmlFor="metadata-program" className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--color-text-muted)' }}>Program</label>
                            <input id="metadata-program" value="BSIT" readOnly className={inputCls} />
                        </div>
                        <div className="rounded-2xl border p-5" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
                            <label htmlFor="metadata-category" className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--color-text-muted)' }}>Category</label>
                            <CategoryCombobox id="metadata-category" value={form.category}
                                onChange={(v) => setForm(prev => ({ ...prev, category: v }))}
                                disabled={processing}
                                className={inputCls} />
                        </div>
                    </div>

                    {/* Adviser and keywords */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                        <AdviserField name={form.adviser_name} selectedId={form.adviser_id} disabled={processing} inputClassName={inputCls}
                            onChange={(adviser_name, adviser_id) => { editedFields.current.add('adviser_name'); setForm(prev => ({ ...prev, adviser_name, adviser_id })); }} />
                        <div className="rounded-2xl border p-5" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
                            <label className="block text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--color-text-muted)' }}>Keywords</label>
                            <KeywordInput keywords={form.keywords} onChange={values => editField('keywords', values)}
                                disabled={processing} inputClassName={inputCls} onValidationChange={setKeywordInputError} validationError={keywordInputError} />
                        </div>
                    </div>

                    {/* Full-width abstract */}
                    <div className="rounded-2xl border p-5" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
                        <label htmlFor="metadata-abstract" className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--color-text-muted)' }}>Abstract</label>
                        <textarea id="metadata-abstract" value={form.abstract}
                            onChange={(e) => editField('abstract', e.target.value)}
                            disabled={processing}
                            rows={7}
                            className={inputCls + ' resize-y'}
                            placeholder="Capstone abstract..." />
                    </div>

                    {/* ── Row 4: Author Contact Details Table ── */}
                    {authorDetails.length > 0 && (
                        <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
                            <div className="px-5 py-3.5 border-b flex items-center gap-3" style={{ background: 'var(--color-bg-tertiary)', borderColor: 'var(--color-border)' }}>
                                <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(27,94,32,0.15)' }}>
                                    <HiOutlineUserGroup className="w-4 h-4" style={{ color: '#1B5E20' }} />
                                </div>
                                <div>
                                    <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>Authors Contact Details</h3>
                                    <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>Auto-extracted from PDF (Appendix N / Curriculum Vitae) — edit if needed</p>
                                </div>
                            </div>
                            <div className="table-scroll p-5 overflow-x-auto" role="region" aria-label="Scrollable data table" tabIndex={0}>
                                <table className="w-full text-sm border-collapse">
                                    <thead>
                                        <tr style={{ background: 'var(--color-bg-tertiary)' }}>
                                            <th className="text-left text-xs font-semibold uppercase tracking-wider px-4 py-2.5 rounded-tl-lg" style={{ color: 'var(--color-text-muted)', width: '35%' }}>Name</th>
                                            <th className="text-left text-xs font-semibold uppercase tracking-wider px-4 py-2.5" style={{ color: 'var(--color-text-muted)', width: '35%' }}>Email</th>
                                            <th className="text-left text-xs font-semibold uppercase tracking-wider px-4 py-2.5 rounded-tr-lg" style={{ color: 'var(--color-text-muted)', width: '30%' }}>Contact Number</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
                                        {authorDetails.map((row, idx) => (
                                            <tr key={idx} style={{ background: idx % 2 === 0 ? 'transparent' : 'var(--color-bg-tertiary)' }}>
                                                <td className="px-4 py-2.5">
                                                    <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>{row.name}</span>
                                                </td>
                                                <td className="px-4 py-2.5">
                                                    <input
                                                        type="email"
                                                        value={row.email}
                                                        onChange={(e) => updateAuthorDetail(idx, 'email', e.target.value)}
                                                        placeholder="email@example.com"
                                                        className="w-full px-2.5 py-1.5 rounded-lg text-sm outline-none transition border bg-[var(--input-bg)] border-[var(--input-border)] text-[var(--input-text)] placeholder-[var(--input-placeholder)] focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)]/30"
                                                    />
                                                </td>
                                                <td className="px-4 py-2.5">
                                                    <input
                                                        type="tel"
                                                        value={row.contact}
                                                        onChange={(e) => updateAuthorDetail(idx, 'contact', e.target.value)}
                                                        placeholder="09XXXXXXXXX"
                                                        className="w-full px-2.5 py-1.5 rounded-lg text-sm outline-none transition border bg-[var(--input-bg)] border-[var(--input-border)] text-[var(--input-text)] placeholder-[var(--input-placeholder)] focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)]/30"
                                                    />
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                </div>
            </div>

            {/* ── Fixed Bottom Bar ─────────────────────────── */}
            <div className="flow-footer fixed bottom-0 left-0 right-0 z-30 border-t"
                style={{ background: 'var(--color-surface-elevated)', borderColor: 'var(--color-border-strong)', backdropFilter: 'blur(16px)' }}>
                <div className="max-w-6xl mx-auto px-4 lg:px-8 py-4 flex items-center justify-between gap-4">
                    <button onClick={handleBack}
                        className="px-4 py-2.5 text-sm font-medium rounded-lg border transition-colors"
                        style={{ color: 'var(--color-text-secondary)', borderColor: 'var(--color-border-strong)', background: 'var(--color-bg-secondary)' }}>
                        ← Back
                    </button>
                    <button onClick={handleNext} disabled={processing || checkingTitle}
                        className="inline-flex items-center gap-2 px-6 py-2.5 text-white text-sm font-semibold rounded-lg transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{ background: 'linear-gradient(135deg, #1B5E20, #2E7D32)' }}>
                        {checkingTitle ? (<><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Checking title…</>) : processing ? 'Waiting for processing…' : 'Next — Additional Info'}
                        {!checkingTitle && <HiArrowRight className="w-4 h-4" />}
                    </button>
                </div>
            </div>
        </div>
    );
}
