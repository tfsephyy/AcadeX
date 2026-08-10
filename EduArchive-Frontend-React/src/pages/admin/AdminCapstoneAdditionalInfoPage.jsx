import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    HiArrowLeft, HiOutlineDocumentText, HiOutlineUpload, HiOutlineX,
    HiOutlinePlus, HiOutlineSearch, HiOutlineTrash, HiOutlineCheck,
    HiOutlineLink, HiOutlineUser, HiOutlineBookOpen,
} from 'react-icons/hi';
import { HiOutlineGlobeAlt, HiOutlineEyeSlash, HiOutlineClock } from 'react-icons/hi2';
import {
    storeCapstone, uploadAdminResource,
    getPublishedCapstones, getFacultyList,
} from '../../api/admin';
import { useNotification } from '../../components/Notification';
import { LoadingOverlay } from '../../components/Loading';

const STATUS_OPTIONS = [
    { value: 'published',   label: 'Published',   desc: 'Visible to all in the library', icon: HiOutlineGlobeAlt,  accent: '#16a34a', bg: 'rgba(22,163,74,0.12)',  border: 'rgba(22,163,74,0.4)' },
    { value: 'unpublished', label: 'Unpublished', desc: 'Saved but hidden from view',    icon: HiOutlineEyeSlash, accent: 'var(--color-text-muted)', bg: 'var(--color-bg-tertiary)', border: 'var(--color-border-strong)' },
    { value: 'in_progress', label: 'In Progress', desc: 'Still being worked on',         icon: HiOutlineClock,    accent: '#d97706', bg: 'rgba(217,119,6,0.1)',  border: 'rgba(217,119,6,0.35)' },
];

function SectionCard({ icon: Icon, title, subtitle, children, accent = 'var(--color-primary)' }) {
    return (
        <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
            <div className="px-5 py-3.5 border-b flex items-center gap-3" style={{ background: 'var(--color-bg-tertiary)', borderColor: 'var(--color-border)' }}>
                <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${accent}22` }}>
                    <Icon className="w-4 h-4" style={{ color: accent }} />
                </div>
                <div>
                    <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>{title}</h3>
                    {subtitle && <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{subtitle}</p>}
                </div>
            </div>
            <div className="p-5">{children}</div>
        </div>
    );
}

const inputCls = "w-full px-3 py-2 rounded-lg text-sm outline-none transition border "
    + "bg-[var(--input-bg)] border-[var(--input-border)] text-[var(--input-text)] "
    + "placeholder-[var(--input-placeholder)] focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/30";

export default function AdminCapstoneAdditionalInfoPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const notify = useNotification();
    const { form: initialForm, pdfInfo } = location.state || {};

    useEffect(() => {
        if (!initialForm || !pdfInfo) navigate('/admin/capstone-library', { replace: true });
    }, []);

    const [publicationStatus, setPublicationStatus] = useState('published');
    const [saving, setSaving] = useState(false);

    const [resources, setResources] = useState([]);
    const [newResourceName, setNewResourceName] = useState('');
    const [uploadingResource, setUploadingResource] = useState(false);
    const resourceFileRef = useRef(null);
    const [pendingResourceFile, setPendingResourceFile] = useState(null);

    const [references, setReferences] = useState([]);
    const [refSearch, setRefSearch] = useState('');
    const [refResults, setRefResults] = useState([]);
    const [refLoading, setRefLoading] = useState(false);
    const [refDropdownOpen, setRefDropdownOpen] = useState(false);
    const refSearchTimer = useRef(null);

    const [adviser, setAdviser] = useState(null);
    const [adviserSearch, setAdviserSearch] = useState('');
    const [adviserResults, setAdviserResults] = useState([]);
    const [adviserLoading, setAdviserLoading] = useState(false);
    const [adviserDropdownOpen, setAdviserDropdownOpen] = useState(false);

    const searchReferences = useCallback(async (q) => {
        if (!q.trim()) { setRefResults([]); return; }
        setRefLoading(true);
        try {
            const res = await getPublishedCapstones({ search: q, per_page: 10 });
            const list = res.data.data?.data || res.data.data || [];
            setRefResults(list.filter(c => !references.find(r => r.id === c.id)));
        } catch { setRefResults([]); } finally { setRefLoading(false); }
    }, [references]);

    useEffect(() => {
        clearTimeout(refSearchTimer.current);
        refSearchTimer.current = setTimeout(() => searchReferences(refSearch), 350);
        return () => clearTimeout(refSearchTimer.current);
    }, [refSearch, searchReferences]);

    const addReference = (cap) => {
        if (!references.find(r => r.id === cap.id))
            setReferences(prev => [...prev, { id: cap.id, title: cap.title, author: cap.author, year: cap.year, program: cap.program }]);
        setRefSearch(''); setRefResults([]); setRefDropdownOpen(false);
    };

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

    const handleAddResource = async () => {
        if (!newResourceName.trim()) { notify.error('Resource name is required.'); return; }
        if (!pendingResourceFile) { notify.error('Please select a file.'); return; }
        setUploadingResource(true);
        try {
            const fd = new FormData();
            fd.append('file', pendingResourceFile);
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

    const handleSave = async () => {
        if (!initialForm?.title?.trim()) { notify.error('Title is required.'); return; }
        if (!initialForm?.author?.trim()) { notify.error('Author is required.'); return; }
        setSaving(true);
        try {
            await storeCapstone({
                ...initialForm,
                pdf_path: pdfInfo.pdf_path,
                pdf_original_name: pdfInfo.pdf_original_name,
                publication_status: publicationStatus,
                adviser_id: adviser?.id || null,
                references: references.map(r => r.id),
                resources: resources.map(r => ({ name: r.name, file_path: r.file_path, file_original_name: r.file_original_name })),
            });
            notify.success('Capstone saved successfully!');
            navigate('/admin/capstone-library', { replace: true });
        } catch (err) {
            const errors = err.response?.data?.errors;
            if (errors?.title) notify.error('A capstone with this title already exists.');
            else notify.error(err.response?.data?.message || 'Failed to save capstone.');
        } finally { setSaving(false); }
    };

    if (!initialForm || !pdfInfo) return null;
    const currentStatus = STATUS_OPTIONS.find(o => o.value === publicationStatus);

    return (
        <div className="min-h-screen flex flex-col" style={{ background: 'var(--color-bg)' }}>
            {saving && <LoadingOverlay text="Saving capstone..." />}

            {/* Top Bar */}
            <div className="sticky top-0 z-20 border-b" style={{ background: 'var(--color-surface-elevated)', borderColor: 'var(--color-border-strong)', backdropFilter: 'blur(16px)' }}>
                <div className="max-w-6xl mx-auto px-4 lg:px-8 py-3.5 flex items-center justify-between gap-4">
                    <button onClick={() => navigate(-1)} className="inline-flex items-center gap-2 text-sm transition-colors"
                        style={{ color: 'var(--color-text-secondary)' }}>
                        <HiArrowLeft className="w-4 h-4" /> Back
                    </button>
                    <div className="flex items-center gap-2">
                        {[
                            { label: 'Upload PDF', done: true },
                            { label: 'Review Data', done: true },
                            { label: 'Additional Info', active: true },
                        ].map((s, i) => (
                            <div key={i} className="flex items-center gap-2">
                                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold"
                                    style={s.active ? { background: '#1B5E20', color: '#fff' } : { background: 'rgba(27,94,32,0.15)', color: '#1B5E20' }}>
                                    <span className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold"
                                        style={s.active ? { background: '#fff', color: '#1B5E20' } : { background: '#1B5E20', color: '#fff' }}>
                                        {s.done ? '✓' : i + 1}
                                    </span>
                                    {s.label}
                                </div>
                                {i < 2 && <div className="w-4 h-px" style={{ background: 'var(--color-border-strong)' }} />}
                            </div>
                        ))}
                    </div>
                    <div className="text-xs hidden sm:block" style={{ color: 'var(--color-text-muted)' }}>Step 3 of 3</div>
                </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto admin-scroll pb-28">
                <div className="max-w-6xl mx-auto px-4 lg:px-8 py-6 space-y-5">

                    {/* Summary banner */}
                    <div className="flex items-start gap-3 p-5 rounded-2xl text-white" style={{ background: 'linear-gradient(135deg, #1B5E20, #2E7D32)' }}>
                        <HiOutlineDocumentText className="w-8 h-8 flex-shrink-0 mt-0.5" style={{ color: 'rgba(255,255,255,0.6)' }} />
                        <div>
                            <p className="text-xs font-medium uppercase tracking-wider mb-0.5" style={{ color: 'rgba(255,255,255,0.6)' }}>Capstone being submitted</p>
                            <h1 className="text-base font-bold leading-snug">{initialForm.title}</h1>
                            <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.75)' }}>
                                {initialForm.author}{initialForm.year && <span className="mx-1.5">·</span>}{initialForm.year}{initialForm.program && <span className="mx-1.5">·</span>}{initialForm.program}
                            </p>
                        </div>
                    </div>

                    {/* Status */}
                    <SectionCard icon={HiOutlineGlobeAlt} title="Publication Status" subtitle="Choose who can see this capstone" accent="#16a34a">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            {STATUS_OPTIONS.map((opt) => {
                                const isSelected = publicationStatus === opt.value;
                                const Icon = opt.icon;
                                return (
                                    <button key={opt.value} onClick={() => setPublicationStatus(opt.value)}
                                        className="relative text-left p-4 rounded-xl border-2 transition-all"
                                        style={{ background: isSelected ? opt.bg : 'var(--color-bg-secondary)', borderColor: isSelected ? opt.border : 'var(--color-border)' }}>
                                        {isSelected && (
                                            <div className="absolute top-3 right-3 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: opt.accent }}>
                                                <HiOutlineCheck className="w-3 h-3 text-white" />
                                            </div>
                                        )}
                                        <Icon className="w-5 h-5 mb-2" style={{ color: opt.accent }} />
                                        <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>{opt.label}</p>
                                        <p className="text-xs mt-0.5 leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>{opt.desc}</p>
                                    </button>
                                );
                            })}
                        </div>
                    </SectionCard>

                    {/* Resources + References side by side */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                        <SectionCard icon={HiOutlineLink} title="Additional Resources" subtitle="Attach supplementary files" accent="#2563eb">
                            {resources.length > 0 && (
                                <div className="mb-3 space-y-2">
                                    {resources.map((r) => (
                                        <div key={r.id} className="flex items-center gap-2 p-2.5 rounded-lg border"
                                            style={{ background: 'rgba(37,99,235,0.08)', borderColor: 'rgba(37,99,235,0.25)' }}>
                                            <HiOutlineDocumentText className="w-4 h-4 flex-shrink-0" style={{ color: '#2563eb' }} />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs font-semibold truncate" style={{ color: 'var(--color-text)' }}>{r.name}</p>
                                                <p className="text-xs truncate" style={{ color: 'var(--color-text-muted)' }}>{r.local_name || r.file_original_name}</p>
                                            </div>
                                            <button onClick={() => setResources(prev => prev.filter(x => x.id !== r.id))}
                                                className="p-1 flex-shrink-0" style={{ color: 'var(--color-text-muted)' }}
                                                onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                                                onMouseLeave={e => e.currentTarget.style.color = 'var(--color-text-muted)'}>
                                                <HiOutlineTrash className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                            <div className="rounded-xl border-2 border-dashed p-3 space-y-2.5" style={{ borderColor: 'var(--color-border-strong)' }}>
                                <input type="text" value={newResourceName} onChange={(e) => setNewResourceName(e.target.value)}
                                    placeholder="Resource name (e.g. Source Code)…" className={inputCls} />
                                <div onClick={() => resourceFileRef.current?.click()}
                                    className="flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer"
                                    style={{ borderColor: 'var(--color-border-strong)', background: 'var(--input-bg)' }}>
                                    <HiOutlineUpload className="w-4 h-4" style={{ color: 'var(--color-text-muted)' }} />
                                    <span className="text-xs flex-1 truncate" style={{ color: pendingResourceFile ? 'var(--color-text)' : 'var(--color-text-muted)' }}>
                                        {pendingResourceFile ? pendingResourceFile.name : 'Click to select file…'}
                                    </span>
                                    {pendingResourceFile && (
                                        <button onClick={(e) => { e.stopPropagation(); setPendingResourceFile(null); if (resourceFileRef.current) resourceFileRef.current.value = ''; }}
                                            style={{ color: 'var(--color-text-muted)' }}>
                                            <HiOutlineX className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                </div>
                                <input ref={resourceFileRef} type="file" onChange={(e) => setPendingResourceFile(e.target.files[0])} className="hidden" />
                                <button onClick={handleAddResource}
                                    disabled={uploadingResource || !newResourceName.trim() || !pendingResourceFile}
                                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    style={{ background: 'rgba(37,99,235,0.12)', color: '#2563eb', borderColor: 'rgba(37,99,235,0.3)' }}>
                                    {uploadingResource ? <><span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" /> Uploading…</> : <><HiOutlinePlus className="w-3.5 h-3.5" /> Add Resource</>}
                                </button>
                            </div>
                        </SectionCard>

                        <SectionCard icon={HiOutlineBookOpen} title="References" subtitle="Cite other capstones as references" accent="#7c3aed">
                            {references.length > 0 && (
                                <div className="mb-3 space-y-2">
                                    {references.map((r) => (
                                        <div key={r.id} className="flex items-center gap-2 p-2.5 rounded-lg border"
                                            style={{ background: 'rgba(124,58,237,0.08)', borderColor: 'rgba(124,58,237,0.25)' }}>
                                            <HiOutlineDocumentText className="w-4 h-4 flex-shrink-0" style={{ color: '#7c3aed' }} />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs font-semibold truncate" style={{ color: 'var(--color-text)' }}>{r.title}</p>
                                                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{r.author}{r.year && <span className="mx-1">·</span>}{r.year}</p>
                                            </div>
                                            <button onClick={() => setReferences(prev => prev.filter(x => x.id !== r.id))}
                                                className="p-1 flex-shrink-0" style={{ color: 'var(--color-text-muted)' }}
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
                                    <HiOutlineSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: 'var(--color-text-muted)' }} />
                                    <input type="text" value={refSearch}
                                        onChange={(e) => { setRefSearch(e.target.value); setRefDropdownOpen(true); }}
                                        onFocus={() => setRefDropdownOpen(true)}
                                        placeholder="Search capstone titles to cite…"
                                        className={inputCls + ' pl-9'} />
                                    {refLoading && <span className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} />}
                                </div>
                                {refDropdownOpen && (refResults.length > 0 || refSearch.trim()) && (
                                    <div className="absolute top-full left-0 right-0 z-30 mt-1 rounded-xl border shadow-lg overflow-hidden"
                                        style={{ background: 'var(--color-surface-elevated)', borderColor: 'var(--color-border-strong)' }}>
                                        {refResults.length === 0 ? (
                                            <div className="px-4 py-3 text-xs text-center" style={{ color: 'var(--color-text-muted)' }}>{refLoading ? 'Searching…' : 'No capstones found'}</div>
                                        ) : (
                                            <div className="max-h-48 overflow-y-auto admin-scroll divide-y" style={{ borderColor: 'var(--color-border)' }}>
                                                {refResults.map((cap) => (
                                                    <button key={cap.id} onClick={() => addReference(cap)}
                                                        className="w-full text-left px-4 py-2.5 transition-colors"
                                                        style={{ color: 'var(--color-text)' }}
                                                        onMouseEnter={e => e.currentTarget.style.background = 'var(--color-bg-tertiary)'}
                                                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                                        <p className="text-xs font-medium line-clamp-1">{cap.title}</p>
                                                        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{cap.author}{cap.year && <span className="mx-1">·</span>}{cap.year}</p>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                                {refDropdownOpen && <div className="fixed inset-0 z-20" onClick={() => setRefDropdownOpen(false)} />}
                            </div>
                        </SectionCard>
                    </div>

                    {/* Adviser + Summary */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                        <SectionCard icon={HiOutlineUser} title="Adviser" subtitle="Faculty member who advised this capstone" accent="#d97706">
                            {adviser ? (
                                <div className="flex items-center gap-3 p-3 rounded-lg border"
                                    style={{ background: 'rgba(217,119,6,0.08)', borderColor: 'rgba(217,119,6,0.3)' }}>
                                    <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(217,119,6,0.15)' }}>
                                        <HiOutlineUser className="w-4 h-4" style={{ color: '#d97706' }} />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>{adviser.name}</p>
                                        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Faculty Adviser</p>
                                    </div>
                                    <button onClick={() => setAdviser(null)} style={{ color: 'var(--color-text-muted)' }}
                                        onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                                        onMouseLeave={e => e.currentTarget.style.color = 'var(--color-text-muted)'}>
                                        <HiOutlineX className="w-4 h-4" />
                                    </button>
                                </div>
                            ) : (
                                <div className="relative">
                                    <div className="relative">
                                        <HiOutlineSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: 'var(--color-text-muted)' }} />
                                        <input type="text" value={adviserSearch}
                                            onChange={(e) => setAdviserSearch(e.target.value)}
                                            onFocus={() => { setAdviserDropdownOpen(true); searchAdviser(''); }}
                                            placeholder="Search faculty by name…"
                                            className={inputCls + ' pl-9'} />
                                        {adviserLoading && <span className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} />}
                                    </div>
                                    {adviserDropdownOpen && (
                                        <div className="absolute top-full left-0 right-0 z-30 mt-1 rounded-xl border shadow-lg overflow-hidden"
                                            style={{ background: 'var(--color-surface-elevated)', borderColor: 'var(--color-border-strong)' }}>
                                            {adviserResults.length === 0 ? (
                                                <div className="px-4 py-3 text-xs text-center" style={{ color: 'var(--color-text-muted)' }}>{adviserLoading ? 'Loading…' : 'No faculty found'}</div>
                                            ) : (
                                                <div className="max-h-48 overflow-y-auto admin-scroll divide-y" style={{ borderColor: 'var(--color-border)' }}>
                                                    {adviserResults.filter(f => !adviserSearch || f.name.toLowerCase().includes(adviserSearch.toLowerCase())).map((fac) => (
                                                        <button key={fac.id}
                                                            onClick={() => { setAdviser(fac); setAdviserDropdownOpen(false); setAdviserSearch(''); }}
                                                            className="w-full text-left px-4 py-2.5 flex items-center gap-2.5 transition-colors"
                                                            style={{ color: 'var(--color-text)' }}
                                                            onMouseEnter={e => e.currentTarget.style.background = 'var(--color-bg-tertiary)'}
                                                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                                            <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: 'var(--color-bg-tertiary)' }}>
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
                        </SectionCard>

                        {/* Summary panel */}
                        <div className="rounded-2xl border p-5" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
                            <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--color-text-muted)' }}>Submission Summary</p>
                            <div className="space-y-2.5">
                                {[
                                    { label: 'Status', value: (
                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border"
                                            style={{ background: currentStatus.bg, color: currentStatus.accent, borderColor: currentStatus.border }}>
                                            <span className="w-1.5 h-1.5 rounded-full" style={{ background: currentStatus.accent }} />
                                            {currentStatus.label}
                                        </span>
                                    )},
                                    { label: 'Resources', value: `${resources.length} file${resources.length !== 1 ? 's' : ''}` },
                                    { label: 'References', value: `${references.length} capstone${references.length !== 1 ? 's' : ''}` },
                                    { label: 'Adviser', value: adviser ? adviser.name : '—' },
                                ].map((row, i) => (
                                    <div key={i} className="flex items-center justify-between">
                                        <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{row.label}</span>
                                        {typeof row.value === 'string'
                                            ? <span className="text-xs font-semibold" style={{ color: 'var(--color-text)' }}>{row.value}</span>
                                            : row.value}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Bottom Bar */}
            <div className="fixed bottom-0 left-0 right-0 z-30 border-t"
                style={{ background: 'var(--color-surface-elevated)', borderColor: 'var(--color-border-strong)', backdropFilter: 'blur(16px)' }}>
                <div className="max-w-6xl mx-auto px-4 lg:px-8 py-4 flex items-center justify-between gap-4">
                    <button onClick={() => navigate(-1)}
                        className="px-4 py-2.5 text-sm font-medium rounded-lg border transition-colors"
                        style={{ color: 'var(--color-text-secondary)', borderColor: 'var(--color-border-strong)', background: 'var(--color-bg-secondary)' }}>
                        ← Back
                    </button>
                    <button id="admin-save-capstone-btn" onClick={handleSave} disabled={saving}
                        className="inline-flex items-center gap-2 px-6 py-2.5 text-white text-sm font-semibold rounded-lg transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{ background: 'linear-gradient(135deg, #1B5E20, #2E7D32)' }}>
                        {saving ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Saving…</> : <><HiOutlineCheck className="w-4 h-4" /> Save Capstone</>}
                    </button>
                </div>
            </div>
        </div>
    );
}
