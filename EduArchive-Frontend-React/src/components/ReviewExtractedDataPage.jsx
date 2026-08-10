import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    HiArrowLeft, HiArrowRight, HiOutlineDocumentText,
    HiOutlinePlus, HiOutlineX,
} from 'react-icons/hi';
import CategoryCombobox from './CategoryCombobox';
import { useNotification } from './Notification';

export default function ReviewExtractedDataPage({ nextPath, backPath }) {
    const navigate = useNavigate();
    const location = useLocation();
    const notify = useNotification();

    const { pdfInfo, extracted } = location.state || {};

    useEffect(() => {
        if (!pdfInfo || !extracted) navigate(backPath, { replace: true });
    }, []);

    const [form, setForm] = useState({
        title:    extracted?.title    || '',
        year:     extracted?.year     || '',
        author:   extracted?.author   || '',
        program:  extracted?.program  || '',
        category: extracted?.category || '',
        abstract: extracted?.abstract || '',
        keywords: extracted?.keywords || [],
    });
    const [newKeyword, setNewKeyword] = useState('');

    if (!pdfInfo || !extracted) return null;

    const addKeyword = () => {
        const kw = newKeyword.trim().toLowerCase();
        if (kw && !form.keywords.includes(kw)) {
            setForm(prev => ({ ...prev, keywords: [...prev.keywords, kw] }));
            setNewKeyword('');
        }
    };

    const removeKeyword = (idx) => {
        setForm(prev => ({ ...prev, keywords: prev.keywords.filter((_, i) => i !== idx) }));
    };

    const handleNext = () => {
        if (!form.title.trim()) { notify.error('Title is required.'); return; }
        if (!form.author.trim()) { notify.error('Author is required.'); return; }
        navigate(nextPath, { state: { form, pdfInfo } });
    };

    const inputCls = "w-full px-3.5 py-2.5 rounded-lg text-sm outline-none transition border"
        + " bg-[var(--input-bg)] border-[var(--input-border)] text-[var(--input-text)]"
        + " placeholder-[var(--input-placeholder)] focus:border-[var(--color-primary)]"
        + " focus:ring-2 focus:ring-[var(--color-primary)]/30";

    return (
        <div className="min-h-screen flex flex-col" style={{ background: 'var(--color-bg)' }}>

            {/* ── Top Bar ─────────────────────────────────── */}
            <div className="sticky top-0 z-20 border-b" style={{ background: 'var(--color-surface-elevated)', borderColor: 'var(--color-border-strong)', backdropFilter: 'blur(16px)' }}>
                <div className="max-w-6xl mx-auto px-4 lg:px-8 py-3.5 flex items-center justify-between gap-4">
                    <button onClick={() => navigate(backPath)} className="inline-flex items-center gap-2 text-sm transition-colors" style={{ color: 'var(--color-text-secondary)' }}
                        onMouseEnter={e => e.currentTarget.style.color = 'var(--color-text)'}
                        onMouseLeave={e => e.currentTarget.style.color = 'var(--color-text-secondary)'}>
                        <HiArrowLeft className="w-4 h-4" /> Back
                    </button>

                    {/* Step pills */}
                    <div className="flex items-center gap-2">
                        {[
                            { label: 'Upload PDF', done: true },
                            { label: 'Review Data', active: true },
                            { label: 'Additional Info', upcoming: true },
                        ].map((s, i) => (
                            <div key={i} className="flex items-center gap-2">
                                <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                                    s.active ? 'text-white' : s.done ? 'text-[#1B5E20]' : ''
                                }`} style={s.active ? { background: '#1B5E20' } : s.done ? { background: 'rgba(27,94,32,0.15)' } : { background: 'var(--color-bg-tertiary)', color: 'var(--color-text-muted)' }}>
                                    <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${s.active ? 'bg-white text-[#1B5E20]' : s.done ? 'bg-[#1B5E20] text-white' : ''}`}
                                        style={s.upcoming ? { background: 'var(--color-border-strong)', color: 'var(--color-text-muted)' } : {}}>
                                        {s.done ? '✓' : i + 1}
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
                    <div className="flex items-center gap-3 p-4 rounded-2xl text-white" style={{ background: 'linear-gradient(135deg, #1B5E20, #2E7D32)' }}>
                        <HiOutlineDocumentText className="w-8 h-8 flex-shrink-0" style={{ color: 'rgba(255,255,255,0.6)' }} />
                        <div>
                            <p className="text-xs font-medium uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.6)' }}>Uploaded PDF</p>
                            <p className="text-sm font-semibold">{pdfInfo.pdf_original_name}</p>
                        </div>
                    </div>

                    {/* Notice */}
                    <div className="p-3.5 rounded-xl border" style={{ background: 'rgba(245,158,11,0.1)', borderColor: 'rgba(245,158,11,0.3)' }}>
                        <p className="text-sm font-medium" style={{ color: '#d97706' }}>
                            📋 Metadata auto-extracted from your PDF — please review and correct before proceeding.
                        </p>
                    </div>

                    {/* ── Row 1: Title + Author ─────────────── */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                        <div className="rounded-2xl border p-5 space-y-1" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
                            <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--color-text-muted)' }}>
                                Title <span className="text-red-400">*</span>
                            </label>
                            <input type="text" value={form.title}
                                onChange={(e) => setForm(prev => ({ ...prev, title: e.target.value }))}
                                className={inputCls} placeholder="Capstone title..." />
                        </div>
                        <div className="rounded-2xl border p-5" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
                            <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--color-text-muted)' }}>
                                Author <span className="text-red-400">*</span>
                            </label>
                            <input type="text" value={form.author}
                                onChange={(e) => setForm(prev => ({ ...prev, author: e.target.value }))}
                                className={inputCls} placeholder="Author name(s)..." />
                        </div>
                    </div>

                    {/* ── Row 2: Year + Program + Category ─── */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                        <div className="rounded-2xl border p-5" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
                            <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--color-text-muted)' }}>Year</label>
                            <input type="number" value={form.year}
                                onChange={(e) => setForm(prev => ({ ...prev, year: e.target.value }))}
                                className={inputCls} min="2000" max="2099" placeholder="2024" />
                        </div>
                        <div className="rounded-2xl border p-5" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
                            <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--color-text-muted)' }}>Program</label>
                            <select value={form.program}
                                onChange={(e) => setForm(prev => ({ ...prev, program: e.target.value }))}
                                className={inputCls} style={{ background: 'var(--input-bg)', color: 'var(--input-text)' }}>
                                <option value="" style={{ background: 'var(--select-option-bg)' }}>Select program</option>
                                <option value="BSIT" style={{ background: 'var(--select-option-bg)' }}>BSIT</option>
                                <option value="BSCpE" style={{ background: 'var(--select-option-bg)' }}>BSCpE</option>
                            </select>
                        </div>
                        <div className="rounded-2xl border p-5" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
                            <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--color-text-muted)' }}>Category</label>
                            <CategoryCombobox value={form.category}
                                onChange={(v) => setForm(prev => ({ ...prev, category: v }))}
                                className={inputCls} />
                        </div>
                    </div>

                    {/* ── Row 3: Abstract + Keywords ───────── */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                        <div className="rounded-2xl border p-5" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
                            <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--color-text-muted)' }}>Abstract</label>
                            <textarea value={form.abstract}
                                onChange={(e) => setForm(prev => ({ ...prev, abstract: e.target.value }))}
                                rows={7}
                                className={inputCls + ' resize-y'}
                                placeholder="Capstone abstract..." />
                        </div>

                        <div className="rounded-2xl border p-5" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
                            <label className="block text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--color-text-muted)' }}>Keywords</label>
                            <div className="flex flex-wrap gap-2 mb-3 min-h-[32px]">
                                {form.keywords.map((kw, idx) => (
                                    <span key={idx} className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full border"
                                        style={{ background: 'rgba(91,190,99,0.12)', color: 'var(--color-primary)', borderColor: 'var(--color-border-strong)' }}>
                                        {kw}
                                        <button onClick={() => removeKeyword(idx)} className="ml-0.5 hover:text-red-400 transition-colors">
                                            <HiOutlineX className="w-3 h-3" />
                                        </button>
                                    </span>
                                ))}
                                {form.keywords.length === 0 && (
                                    <span className="text-xs italic" style={{ color: 'var(--color-text-faint)' }}>No keywords yet</span>
                                )}
                            </div>
                            <div className="flex gap-2">
                                <input type="text" value={newKeyword}
                                    onChange={(e) => setNewKeyword(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addKeyword())}
                                    placeholder="Add keyword & press Enter…"
                                    className={inputCls + ' flex-1'} />
                                <button onClick={addKeyword}
                                    className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border transition-colors"
                                    style={{ background: 'rgba(91,190,99,0.12)', color: 'var(--color-primary)', borderColor: 'var(--color-border-strong)' }}>
                                    <HiOutlinePlus className="w-4 h-4" /> Add
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Fixed Bottom Bar ─────────────────────────── */}
            <div className="fixed bottom-0 left-0 right-0 z-30 border-t"
                style={{ background: 'var(--color-surface-elevated)', borderColor: 'var(--color-border-strong)', backdropFilter: 'blur(16px)' }}>
                <div className="max-w-6xl mx-auto px-4 lg:px-8 py-4 flex items-center justify-between gap-4">
                    <button onClick={() => navigate(backPath)}
                        className="px-4 py-2.5 text-sm font-medium rounded-lg border transition-colors"
                        style={{ color: 'var(--color-text-secondary)', borderColor: 'var(--color-border-strong)', background: 'var(--color-bg-secondary)' }}>
                        ← Back
                    </button>
                    <button onClick={handleNext}
                        className="inline-flex items-center gap-2 px-6 py-2.5 text-white text-sm font-semibold rounded-lg transition-all shadow-md hover:shadow-lg"
                        style={{ background: 'linear-gradient(135deg, #1B5E20, #2E7D32)' }}>
                        Next — Additional Info
                        <HiArrowRight className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
}
