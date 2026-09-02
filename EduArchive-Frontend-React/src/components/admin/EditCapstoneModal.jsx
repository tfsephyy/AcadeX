import { useState, useEffect, useRef, useCallback } from 'react';
import {
    HiOutlineX, HiOutlineCheck, HiOutlineSearch, HiOutlineUser,
    HiOutlineDocumentText, HiOutlineTrash, HiOutlinePlus,
    HiOutlineUpload, HiOutlineShieldCheck,
} from 'react-icons/hi';
import { HiOutlineGlobeAlt, HiOutlineEyeSlash, HiOutlineClock, HiOutlineDocumentDuplicate } from 'react-icons/hi2';
import {
    updateCapstone, uploadAdminResource, uploadAdminImrad,
    getPublishedCapstones, getFacultyList,
} from '../../api/admin';
import { useNotification } from '../../components/Notification';
import { LoadingOverlay } from '../../components/Loading';
import CategoryCombobox from '../../components/CategoryCombobox';

/* ─── Constants ─────────────────────────────────────────────── */
const STATUS_OPTIONS = [
    { value: 'published',   label: 'Published',   desc: 'Visible to all', icon: HiOutlineGlobeAlt,  accent: '#16a34a', bg: 'rgba(22,163,74,0.12)',   border: 'rgba(22,163,74,0.4)' },
    { value: 'unpublished', label: 'Unpublished', desc: 'Hidden from view', icon: HiOutlineEyeSlash, accent: '#6b7280', bg: 'rgba(107,114,128,0.1)',  border: 'rgba(107,114,128,0.35)' },
    { value: 'in_progress', label: 'In Progress', desc: 'Still being worked on', icon: HiOutlineClock, accent: '#d97706', bg: 'rgba(217,119,6,0.12)', border: 'rgba(217,119,6,0.35)' },
];

const COPYRIGHT_OPTIONS = [
    { value: 'copyrighted', label: 'Copyrighted', desc: 'Protected by copyright.',  accent: '#7c3aed', bg: 'rgba(124,58,237,0.12)', border: 'rgba(124,58,237,0.4)' },
    { value: 'pending',     label: 'Pending',     desc: 'Status being verified.',    accent: '#d97706', bg: 'rgba(217,119,6,0.12)',  border: 'rgba(217,119,6,0.35)' },
    { value: 'unprotected', label: 'Unprotected', desc: 'No copyright recorded.',   accent: '#6b7280', bg: 'rgba(107,114,128,0.1)', border: 'rgba(107,114,128,0.35)' },
];

/* ─── Shared input class using theme vars ────────────────────── */
const inputCls = [
    'w-full px-3 py-2.5 rounded-lg text-sm outline-none transition border',
    'bg-[var(--input-bg)] border-[var(--input-border)]',
    'text-[var(--input-text)] placeholder-[var(--input-placeholder)]',
    'focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/30',
].join(' ');

/* ─── Option card (status / copyright) ──────────────────────── */
function OptionCard({ isSelected, accent, bg, border, children, onClick }) {
    return (
        <button onClick={onClick}
            className="relative text-left p-3 rounded-xl border-2 transition-all w-full"
            style={{
                background: isSelected ? bg : 'var(--color-bg-secondary)',
                borderColor: isSelected ? border : 'var(--color-border)',
            }}>
            {isSelected && (
                <div className="absolute top-2 right-2 w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: accent }}>
                    <HiOutlineCheck className="w-2.5 h-2.5 text-white" />
                </div>
            )}
            {children}
        </button>
    );
}

/* ─── Section label ──────────────────────────────────────────── */
function SectionLabel({ children }) {
    return <label className="text-sm font-semibold block mb-2" style={{ color: 'var(--color-text)' }}>{children}</label>;
}

/* ─── Component ─────────────────────────────────────────────── */
export default function EditCapstoneModal({ capstone, onClose, onSuccess, updateFn }) {
    const actualUpdate = updateFn || updateCapstone;
    const notify = useNotification();
    const [saving, setSaving] = useState(false);
    const [activeTab, setActiveTab] = useState('basic');

    /* ── Step 2 state ── */
    const [form, setForm] = useState({
        title: '', year: '', author: '', program: '', category: '', abstract: '', keywords: [],
    });
    const [newKeyword, setNewKeyword] = useState('');

    /* ── Step 3 state ── */
    const [publicationStatus, setPublicationStatus] = useState('published');
    const [copyrightStatus, setCopyrightStatus] = useState('');

    // IMRAD
    const [imradInfo, setImradInfo] = useState(null);
    const [uploadingImrad, setUploadingImrad] = useState(false);
    const imradRef = useRef(null);

    // Resources
    const [resources, setResources] = useState([]);
    const [newResourceName, setNewResourceName] = useState('');
    const [pendingResourceFile, setPendingResourceFile] = useState(null);
    const [uploadingResource, setUploadingResource] = useState(false);
    const resourceFileRef = useRef(null);

    // References
    const [references, setReferences] = useState([]);
    const [refSearch, setRefSearch] = useState('');
    const [refResults, setRefResults] = useState([]);
    const [refLoading, setRefLoading] = useState(false);
    const [refDropdownOpen, setRefDropdownOpen] = useState(false);
    const refTimer = useRef(null);

    // Adviser
    const [adviser, setAdviser] = useState(null);
    const [adviserSearch, setAdviserSearch] = useState('');
    const [adviserResults, setAdviserResults] = useState([]);
    const [adviserLoading, setAdviserLoading] = useState(false);
    const [adviserDropdownOpen, setAdviserDropdownOpen] = useState(false);

    /* ── Seed from capstone ── */
    useEffect(() => {
        if (!capstone) return;
        setForm({
            title:    capstone.title    || '',
            year:     capstone.year     || '',
            author:   capstone.author   || '',
            program:  capstone.program  || '',
            category: capstone.category || '',
            abstract: capstone.abstract || '',
            keywords: capstone.keywords?.map(k => k.name || k) || [],
        });
        setPublicationStatus(capstone.publication_status || 'published');
        setCopyrightStatus(capstone.copyright_status || '');
        setImradInfo(capstone.imrad_path ? { file_path: capstone.imrad_path, file_original_name: capstone.imrad_original_name } : null);
        setResources(capstone.resources?.map(r => ({ ...r, id: r.id || Date.now() + Math.random() })) || []);
        setReferences(capstone.references?.map(r => ({ id: r.id, title: r.title, author: r.author, year: r.year })) || []);
        setAdviser(capstone.adviser ? { id: capstone.adviser.id, name: capstone.adviser.name } : null);
    }, [capstone]);

    /* ── Reference search ── */
    const searchReferences = useCallback(async (q) => {
        if (!q.trim()) { setRefResults([]); return; }
        setRefLoading(true);
        try {
            const res = await getPublishedCapstones({ search: q, per_page: 10 });
            const list = res.data.data?.data || res.data.data || [];
            setRefResults(list.filter(c => c.id !== capstone.id && !references.find(r => r.id === c.id)));
        } catch { setRefResults([]); } finally { setRefLoading(false); }
    }, [references, capstone?.id]);

    useEffect(() => {
        clearTimeout(refTimer.current);
        refTimer.current = setTimeout(() => searchReferences(refSearch), 350);
        return () => clearTimeout(refTimer.current);
    }, [refSearch, searchReferences]);

    /* ── Adviser search ── */
    const searchAdviser = useCallback(async (q) => {
        setAdviserLoading(true);
        try {
            const res = await getFacultyList({ search: q });
            setAdviserResults(res.data.data || []);
        } catch { setAdviserResults([]); } finally { setAdviserLoading(false); }
    }, []);

    useEffect(() => {
        if (!adviserDropdownOpen) return;
        const t = setTimeout(() => searchAdviser(adviserSearch), 300);
        return () => clearTimeout(t);
    }, [adviserSearch, adviserDropdownOpen, searchAdviser]);

    /* ── IMRAD upload ── */
    const handleImradSelect = async (file) => {
        if (!file) return;
        setUploadingImrad(true);
        try {
            const fd = new FormData(); fd.append('file', file);
            const res = await uploadAdminImrad(fd);
            setImradInfo(res.data.data);
            notify.success('IMRAD file uploaded!');
        } catch (err) {
            notify.error(err.response?.data?.message || 'Failed to upload IMRAD.');
        } finally { setUploadingImrad(false); }
    };

    /* ── Resource upload ── */
    const handleAddResource = async () => {
        if (!newResourceName.trim()) { notify.error('Resource name required.'); return; }
        if (!pendingResourceFile) { notify.error('Select a file.'); return; }
        setUploadingResource(true);
        try {
            const fd = new FormData(); fd.append('file', pendingResourceFile);
            const res = await uploadAdminResource(fd);
            const { file_path, file_original_name } = res.data.data;
            setResources(prev => [...prev, { id: Date.now(), name: newResourceName.trim(), file_path, file_original_name, local_name: pendingResourceFile.name }]);
            setNewResourceName(''); setPendingResourceFile(null);
            if (resourceFileRef.current) resourceFileRef.current.value = '';
            notify.success('Resource added!');
        } catch (err) {
            notify.error(err.response?.data?.message || 'Failed to upload resource.');
        } finally { setUploadingResource(false); }
    };

    /* ── Save ── */
    const handleSave = async () => {
        if (!form.title.trim()) { notify.error('Title is required.'); return; }
        if (!form.author.trim()) { notify.error('Author is required.'); return; }
        setSaving(true);
        try {
            await actualUpdate(capstone.id, {
                ...form,
                publication_status:  publicationStatus,
                copyright_status:    copyrightStatus || null,
                imrad_path:          imradInfo?.file_path || null,
                imrad_original_name: imradInfo?.file_original_name || null,
                adviser_id:          adviser?.id || null,
                references:          references.map(r => r.id),
                resources:           resources.map(r => ({ name: r.name, file_path: r.file_path, file_original_name: r.file_original_name })),
            });
            notify.success('Capstone updated successfully!');
            onSuccess();
        } catch (err) {
            notify.error(err.response?.data?.message || 'Failed to update capstone.');
        } finally { setSaving(false); }
    };

    const tabs = [
        { id: 'basic',      label: 'Basic Info' },
        { id: 'additional', label: 'Additional Info' },
    ];

    return (
        <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
            {saving && <LoadingOverlay text="Saving changes…" />}
            <div className="w-full sm:max-w-3xl rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[92vh]"
                style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>

                {/* ── Header ── */}
                <div className="flex items-center justify-between gap-3 px-6 py-4 border-b flex-shrink-0"
                    style={{ borderColor: 'var(--color-border)' }}>
                    <div>
                        <h2 className="text-lg font-bold" style={{ color: 'var(--color-text)' }}>Edit Capstone</h2>
                        <p className="text-xs mt-0.5 line-clamp-1" style={{ color: 'var(--color-text-muted)' }}>{capstone?.title}</p>
                    </div>
                    <button onClick={onClose}
                        className="p-2 rounded-lg transition-colors"
                        style={{ color: 'var(--color-text-muted)' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--color-bg-tertiary)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <HiOutlineX className="w-5 h-5" />
                    </button>
                </div>

                {/* ── Tabs ── */}
                <div className="flex border-b flex-shrink-0 px-6" style={{ borderColor: 'var(--color-border)' }}>
                    {tabs.map(tab => (
                        <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                            className="py-3 px-4 text-sm font-medium border-b-2 transition-colors mr-2 -mb-px"
                            style={activeTab === tab.id
                                ? { borderColor: 'var(--color-primary)', color: 'var(--color-primary)' }
                                : { borderColor: 'transparent', color: 'var(--color-text-muted)' }}>
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* ── Body ── */}
                <div className="flex-1 overflow-y-auto admin-scroll">

                    {/* ─── BASIC INFO ─── */}
                    {activeTab === 'basic' && (
                        <div className="p-6 space-y-4">

                            {/* Title */}
                            <div>
                                <SectionLabel>Title <span className="text-red-500">*</span></SectionLabel>
                                <input type="text" value={form.title}
                                    onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                                    className={inputCls} placeholder="Full capstone title…" />
                            </div>

                            {/* Author */}
                            <div>
                                <SectionLabel>Author <span className="text-red-500">*</span></SectionLabel>
                                <input type="text" value={form.author}
                                    onChange={e => setForm(p => ({ ...p, author: e.target.value }))}
                                    className={inputCls} placeholder="Author name(s)…" />
                            </div>

                            {/* Year / Program / Category */}
                            <div className="grid grid-cols-3 gap-3">
                                <div>
                                    <SectionLabel>Year</SectionLabel>
                                    <input type="number" value={form.year} min="2000" max="2099"
                                        onChange={e => setForm(p => ({ ...p, year: e.target.value }))}
                                        className={inputCls} />
                                </div>
                                <div>
                                    <SectionLabel>Program</SectionLabel>
                                    <select value={form.program}
                                        onChange={e => setForm(p => ({ ...p, program: e.target.value }))}
                                        className={inputCls}>
                                        <option value="">Select Program</option>
                                        <option value="BSIT">BSIT</option>
                                        <option value="BSCpE">BSCpE</option>
                                    </select>
                                </div>
                                <div>
                                    <SectionLabel>Category</SectionLabel>
                                    <CategoryCombobox value={form.category} onChange={v => setForm(p => ({ ...p, category: v }))} />
                                </div>
                            </div>

                            {/* Abstract */}
                            <div>
                                <SectionLabel>Abstract</SectionLabel>
                                <textarea value={form.abstract}
                                    onChange={e => setForm(p => ({ ...p, abstract: e.target.value }))}
                                    rows="5" className={inputCls} placeholder="Capstone abstract…" />
                            </div>

                            {/* Keywords */}
                            <div>
                                <SectionLabel>Keywords</SectionLabel>
                                <div className="flex gap-2 mb-2">
                                    <input type="text" value={newKeyword}
                                        onChange={e => setNewKeyword(e.target.value)}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                if (newKeyword.trim() && !form.keywords.includes(newKeyword.trim())) {
                                                    setForm(p => ({ ...p, keywords: [...p.keywords, newKeyword.trim()] }));
                                                    setNewKeyword('');
                                                }
                                            }
                                        }}
                                        placeholder="Add keyword and press Enter"
                                        className={inputCls + ' flex-1'} />
                                    <button onClick={() => {
                                        if (newKeyword.trim() && !form.keywords.includes(newKeyword.trim())) {
                                            setForm(p => ({ ...p, keywords: [...p.keywords, newKeyword.trim()] }));
                                            setNewKeyword('');
                                        }
                                    }}
                                        className="px-4 py-2 text-white text-sm font-medium rounded-lg transition-colors"
                                        style={{ background: 'var(--color-primary)' }}>
                                        Add
                                    </button>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {form.keywords.map(kw => (
                                        <span key={kw} className="inline-flex items-center gap-1.5 px-3 py-1 text-sm rounded-full"
                                            style={{ background: 'rgba(27,94,32,0.12)', color: 'var(--color-primary)' }}>
                                            {kw}
                                            <button onClick={() => setForm(p => ({ ...p, keywords: p.keywords.filter(k => k !== kw) }))}
                                                className="leading-none opacity-70 hover:opacity-100">×</button>
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ─── ADDITIONAL INFO ─── */}
                    {activeTab === 'additional' && (
                        <div className="p-6 space-y-6">

                            {/* Publication Status */}
                            <div>
                                <SectionLabel>Publication Status</SectionLabel>
                                <div className="grid grid-cols-3 gap-2">
                                    {STATUS_OPTIONS.map(opt => {
                                        const isSelected = publicationStatus === opt.value;
                                        const Icon = opt.icon;
                                        return (
                                            <OptionCard key={opt.value} isSelected={isSelected}
                                                accent={opt.accent} bg={opt.bg} border={opt.border}
                                                onClick={() => setPublicationStatus(opt.value)}>
                                                <Icon className="w-4 h-4 mb-1.5" style={{ color: opt.accent }} />
                                                <p className="text-xs font-semibold" style={{ color: 'var(--color-text)' }}>{opt.label}</p>
                                                <p className="text-[10px] leading-tight mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{opt.desc}</p>
                                            </OptionCard>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Copyright Status */}
                            <div>
                                <SectionLabel>Copyright Status</SectionLabel>
                                <div className="grid grid-cols-3 gap-2">
                                    {COPYRIGHT_OPTIONS.map(opt => {
                                        const isSelected = copyrightStatus === opt.value;
                                        return (
                                            <OptionCard key={opt.value} isSelected={isSelected}
                                                accent={opt.accent} bg={opt.bg} border={opt.border}
                                                onClick={() => setCopyrightStatus(isSelected ? '' : opt.value)}>
                                                <HiOutlineShieldCheck className="w-4 h-4 mb-1.5" style={{ color: opt.accent }} />
                                                <p className="text-xs font-semibold" style={{ color: 'var(--color-text)' }}>{opt.label}</p>
                                                <p className="text-[10px] leading-tight mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{opt.desc}</p>
                                            </OptionCard>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* IMRAD */}
                            <div>
                                <SectionLabel>IMRAD File <span className="font-normal text-xs" style={{ color: 'var(--color-text-muted)' }}>(optional)</span></SectionLabel>
                                {imradInfo ? (
                                    <div className="flex items-center gap-3 p-3 rounded-lg border"
                                        style={{ background: 'rgba(8,145,178,0.08)', borderColor: 'rgba(8,145,178,0.3)' }}>
                                        <HiOutlineDocumentDuplicate className="w-5 h-5 flex-shrink-0" style={{ color: '#0891b2' }} />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text)' }}>
                                                {imradInfo.file_original_name || 'IMRAD File'}
                                            </p>
                                            <p className="text-xs" style={{ color: '#0891b2' }}>Uploaded</p>
                                        </div>
                                        <button onClick={() => { setImradInfo(null); if (imradRef.current) imradRef.current.value = ''; }}
                                            style={{ color: 'var(--color-text-muted)' }}
                                            onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                                            onMouseLeave={e => e.currentTarget.style.color = 'var(--color-text-muted)'}>
                                            <HiOutlineX className="w-4 h-4" />
                                        </button>
                                    </div>
                                ) : (
                                    <div onClick={() => imradRef.current?.click()}
                                        className="flex items-center gap-3 p-4 rounded-lg border-2 border-dashed cursor-pointer transition-colors"
                                        style={{ borderColor: 'rgba(8,145,178,0.35)', background: 'rgba(8,145,178,0.05)' }}
                                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(8,145,178,0.1)'}
                                        onMouseLeave={e => e.currentTarget.style.background = 'rgba(8,145,178,0.05)'}>
                                        {uploadingImrad
                                            ? <span className="w-5 h-5 border-2 rounded-full animate-spin" style={{ borderColor: '#0891b2', borderTopColor: 'transparent' }} />
                                            : <HiOutlineUpload className="w-5 h-5" style={{ color: '#0891b2' }} />}
                                        <span className="text-sm font-medium" style={{ color: '#0891b2' }}>
                                            {uploadingImrad ? 'Uploading…' : 'Click to upload IMRAD PDF'}
                                        </span>
                                    </div>
                                )}
                                <input ref={imradRef} type="file" accept=".pdf"
                                    onChange={e => handleImradSelect(e.target.files[0])} className="hidden" />
                            </div>

                            {/* Adviser */}
                            <div>
                                <SectionLabel>Adviser</SectionLabel>
                                {adviser ? (
                                    <div className="flex items-center gap-3 p-3 rounded-lg border"
                                        style={{ background: 'rgba(217,119,6,0.08)', borderColor: 'rgba(217,119,6,0.3)' }}>
                                        <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                                            style={{ background: 'rgba(217,119,6,0.15)' }}>
                                            <HiOutlineUser className="w-4 h-4" style={{ color: '#d97706' }} />
                                        </div>
                                        <span className="text-sm font-medium flex-1" style={{ color: 'var(--color-text)' }}>{adviser.name}</span>
                                        <button onClick={() => setAdviser(null)}
                                            style={{ color: 'var(--color-text-muted)' }}
                                            onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                                            onMouseLeave={e => e.currentTarget.style.color = 'var(--color-text-muted)'}>
                                            <HiOutlineX className="w-4 h-4" />
                                        </button>
                                    </div>
                                ) : (
                                    <div className="relative">
                                        <div className="relative">
                                            <HiOutlineSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
                                                style={{ color: 'var(--color-text-muted)' }} />
                                            <input type="text" value={adviserSearch}
                                                onChange={e => setAdviserSearch(e.target.value)}
                                                onFocus={() => { setAdviserDropdownOpen(true); searchAdviser(''); }}
                                                placeholder="Search faculty by name…"
                                                className={inputCls + ' pl-9'} />
                                            {adviserLoading && (
                                                <span className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 border-2 rounded-full animate-spin"
                                                    style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} />
                                            )}
                                        </div>
                                        {adviserDropdownOpen && (
                                            <div className="absolute top-full left-0 right-0 z-30 mt-1 rounded-xl border shadow-lg overflow-hidden"
                                                style={{ background: 'var(--color-surface-elevated)', borderColor: 'var(--color-border-strong)' }}>
                                                {adviserResults.length === 0 ? (
                                                    <div className="px-4 py-3 text-xs text-center"
                                                        style={{ color: 'var(--color-text-muted)' }}>
                                                        {adviserLoading ? 'Loading…' : 'No faculty found'}
                                                    </div>
                                                ) : (
                                                    <div className="max-h-48 overflow-y-auto admin-scroll divide-y"
                                                        style={{ borderColor: 'var(--color-border)' }}>
                                                        {adviserResults
                                                            .filter(f => !adviserSearch || f.name.toLowerCase().includes(adviserSearch.toLowerCase()))
                                                            .map(fac => (
                                                                <button key={fac.id}
                                                                    onClick={() => { setAdviser(fac); setAdviserDropdownOpen(false); setAdviserSearch(''); }}
                                                                    className="w-full text-left px-4 py-2.5 flex items-center gap-2.5 transition-colors"
                                                                    style={{ color: 'var(--color-text)' }}
                                                                    onMouseEnter={e => e.currentTarget.style.background = 'var(--color-bg-tertiary)'}
                                                                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                                                    <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                                                                        style={{ background: 'var(--color-bg-tertiary)' }}>
                                                                        <HiOutlineUser className="w-3.5 h-3.5" style={{ color: 'var(--color-text-muted)' }} />
                                                                    </div>
                                                                    <span className="text-sm">{fac.name}</span>
                                                                </button>
                                                            ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                        {adviserDropdownOpen && <div className="fixed inset-0 z-20" onClick={() => setAdviserDropdownOpen(false)} />}
                                    </div>
                                )}
                            </div>

                            {/* Resources */}
                            <div>
                                <SectionLabel>Additional Resources</SectionLabel>
                                {resources.length > 0 && (
                                    <div className="mb-3 space-y-1.5">
                                        {resources.map(r => (
                                            <div key={r.id} className="flex items-center gap-2 p-2.5 rounded-lg border"
                                                style={{ background: 'rgba(37,99,235,0.08)', borderColor: 'rgba(37,99,235,0.25)' }}>
                                                <HiOutlineDocumentText className="w-4 h-4 flex-shrink-0" style={{ color: '#2563eb' }} />
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs font-semibold truncate" style={{ color: 'var(--color-text)' }}>{r.name}</p>
                                                    <p className="text-xs truncate" style={{ color: 'var(--color-text-muted)' }}>{r.local_name || r.file_original_name}</p>
                                                </div>
                                                <button onClick={() => setResources(p => p.filter(x => x.id !== r.id))}
                                                    style={{ color: 'var(--color-text-muted)' }}
                                                    onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                                                    onMouseLeave={e => e.currentTarget.style.color = 'var(--color-text-muted)'}>
                                                    <HiOutlineTrash className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                <div className="rounded-xl border-2 border-dashed p-3 space-y-2.5"
                                    style={{ borderColor: 'var(--color-border-strong)' }}>
                                    <input type="text" value={newResourceName}
                                        onChange={e => setNewResourceName(e.target.value)}
                                        placeholder="Resource name (e.g. Source Code)…"
                                        className={inputCls} />
                                    <div onClick={() => resourceFileRef.current?.click()}
                                        className="flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors"
                                        style={{ borderColor: 'var(--color-border-strong)', background: 'var(--color-bg-secondary)' }}
                                        onMouseEnter={e => e.currentTarget.style.background = 'var(--color-bg-tertiary)'}
                                        onMouseLeave={e => e.currentTarget.style.background = 'var(--color-bg-secondary)'}>
                                        <HiOutlineUpload className="w-4 h-4" style={{ color: 'var(--color-text-muted)' }} />
                                        <span className="text-xs flex-1 truncate"
                                            style={{ color: pendingResourceFile ? 'var(--color-text)' : 'var(--color-text-muted)' }}>
                                            {pendingResourceFile ? pendingResourceFile.name : 'Click to select file…'}
                                        </span>
                                        {pendingResourceFile && (
                                            <button onClick={e => { e.stopPropagation(); setPendingResourceFile(null); if (resourceFileRef.current) resourceFileRef.current.value = ''; }}
                                                style={{ color: 'var(--color-text-muted)' }}
                                                onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                                                onMouseLeave={e => e.currentTarget.style.color = 'var(--color-text-muted)'}>
                                                <HiOutlineX className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                    </div>
                                    <input ref={resourceFileRef} type="file"
                                        onChange={e => setPendingResourceFile(e.target.files[0])} className="hidden" />
                                    <button onClick={handleAddResource}
                                        disabled={uploadingResource || !newResourceName.trim() || !pendingResourceFile}
                                        className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                        style={{ background: 'rgba(37,99,235,0.1)', color: '#2563eb', borderColor: 'rgba(37,99,235,0.3)' }}>
                                        {uploadingResource
                                            ? <><span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />Uploading…</>
                                            : <><HiOutlinePlus className="w-3.5 h-3.5" />Add Resource</>}
                                    </button>
                                </div>
                            </div>

                            {/* References */}
                            <div>
                                <SectionLabel>References</SectionLabel>
                                {references.length > 0 && (
                                    <div className="mb-3 space-y-1.5">
                                        {references.map(r => (
                                            <div key={r.id} className="flex items-center gap-2 p-2.5 rounded-lg border"
                                                style={{ background: 'rgba(124,58,237,0.08)', borderColor: 'rgba(124,58,237,0.25)' }}>
                                                <HiOutlineDocumentText className="w-4 h-4 flex-shrink-0" style={{ color: '#7c3aed' }} />
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs font-semibold truncate" style={{ color: 'var(--color-text)' }}>{r.title}</p>
                                                    <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                                                        {r.author}{r.year && <span className="mx-1">·</span>}{r.year}
                                                    </p>
                                                </div>
                                                <button onClick={() => setReferences(p => p.filter(x => x.id !== r.id))}
                                                    style={{ color: 'var(--color-text-muted)' }}
                                                    onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                                                    onMouseLeave={e => e.currentTarget.style.color = 'var(--color-text-muted)'}>
                                                    <HiOutlineTrash className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                <div className="relative">
                                    <div className="relative">
                                        <HiOutlineSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
                                            style={{ color: 'var(--color-text-muted)' }} />
                                        <input type="text" value={refSearch}
                                            onChange={e => { setRefSearch(e.target.value); setRefDropdownOpen(true); }}
                                            onFocus={() => setRefDropdownOpen(true)}
                                            placeholder="Search capstone titles to cite…"
                                            className={inputCls + ' pl-9'} />
                                        {refLoading && (
                                            <span className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 border-2 rounded-full animate-spin"
                                                style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} />
                                        )}
                                    </div>
                                    {refDropdownOpen && (refResults.length > 0 || refSearch.trim()) && (
                                        <div className="absolute top-full left-0 right-0 z-30 mt-1 rounded-xl border shadow-lg overflow-hidden"
                                            style={{ background: 'var(--color-surface-elevated)', borderColor: 'var(--color-border-strong)' }}>
                                            {refResults.length === 0 ? (
                                                <div className="px-4 py-3 text-xs text-center"
                                                    style={{ color: 'var(--color-text-muted)' }}>
                                                    {refLoading ? 'Searching…' : 'No results'}
                                                </div>
                                            ) : (
                                                <div className="max-h-40 overflow-y-auto admin-scroll divide-y"
                                                    style={{ borderColor: 'var(--color-border)' }}>
                                                    {refResults.map(cap => (
                                                        <button key={cap.id}
                                                            onClick={() => { setReferences(p => [...p, { id: cap.id, title: cap.title, author: cap.author, year: cap.year }]); setRefSearch(''); setRefDropdownOpen(false); }}
                                                            className="w-full text-left px-4 py-2.5 transition-colors"
                                                            style={{ color: 'var(--color-text)' }}
                                                            onMouseEnter={e => e.currentTarget.style.background = 'var(--color-bg-tertiary)'}
                                                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                                            <p className="text-xs font-medium line-clamp-1">{cap.title}</p>
                                                            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                                                                {cap.author}{cap.year && <span className="mx-1">·</span>}{cap.year}
                                                            </p>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    {refDropdownOpen && <div className="fixed inset-0 z-20" onClick={() => setRefDropdownOpen(false)} />}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* ── Footer ── */}
                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t flex-shrink-0 rounded-b-2xl"
                    style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg-secondary)' }}>
                    <button onClick={onClose}
                        className="px-4 py-2 text-sm font-medium rounded-lg border transition-colors"
                        style={{ color: 'var(--color-text-secondary)', borderColor: 'var(--color-border-strong)', background: 'var(--color-bg-secondary)' }}>
                        Cancel
                    </button>
                    <button onClick={handleSave} disabled={saving}
                        className="px-5 py-2 text-sm font-semibold text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
                        style={{ background: 'linear-gradient(135deg, #1B5E20, #2E7D32)' }}>
                        {saving
                            ? <><span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />Saving…</>
                            : <><HiOutlineCheck className="w-4 h-4" />Save Changes</>}
                    </button>
                </div>
            </div>
        </div>
    );
}
