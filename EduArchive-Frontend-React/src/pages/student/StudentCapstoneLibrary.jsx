import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { HiOutlineSearch, HiOutlineFilter, HiOutlineDocumentText, HiOutlineEye, HiOutlineTrash } from 'react-icons/hi';
import {
    getStudentCapstones, deleteStudentCapstone, getArchivedStudentCapstones,
    getPublishedYears, getPublishedPrograms, getPublishedCategories,
} from '../../api/admin';
import { useNotification } from '../../components/Notification';
import Loading from '../../components/Loading';
import EmptyState from '../../components/EmptyState';
import ConfirmDialog from '../../components/ConfirmDialog';

const STATUS_MAP = {
    pending:  { bg: 'bg-amber-100',  text: 'text-amber-700',  border: 'border-amber-300',  dot: 'bg-amber-500',  label: 'Pending Review' },
    approved: { bg: 'bg-blue-100',   text: 'text-blue-700',   border: 'border-blue-300',   dot: 'bg-blue-500',   label: 'Approved' },
    rejected: { bg: 'bg-red-100',    text: 'text-red-700',    border: 'border-red-300',    dot: 'bg-red-500',    label: 'Rejected' },
};

function StatusBadge({ status, isPublished }) {
    if (isPublished) return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-green-100 text-green-700 border border-green-300">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500" /> Published
        </span>
    );
    const s = STATUS_MAP[status] || STATUS_MAP.pending;
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${s.bg} ${s.text} ${s.border}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} /> {s.label}
        </span>
    );
}

export default function StudentCapstoneLibrary() {
    const navigate = useNavigate();
    const notify = useNotification();
    const [capstones, setCapstones] = useState([]);
    const [loading, setLoading] = useState(true);
    const [viewing, setViewing] = useState('active');
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [filters, setFilters] = useState({ year: '', program: '', category: '' });
    const [years, setYears] = useState([]);
    const [programs, setPrograms] = useState([]);
    const [categories, setCategories] = useState([]);
    const [showFilters, setShowFilters] = useState(false);
    const [page, setPage] = useState(1);
    const [lastPage, setLastPage] = useState(1);
    const [confirm, setConfirm] = useState({ open: false, title: '', message: '', action: null, variant: 'danger' });
    const searchTimer = useRef(null);

    useEffect(() => {
        clearTimeout(searchTimer.current);
        searchTimer.current = setTimeout(() => setDebouncedSearch(search), 350);
        return () => clearTimeout(searchTimer.current);
    }, [search]);

    useEffect(() => { loadFilters(); }, []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => { fetchCapstones(); }, [debouncedSearch, filters, page, viewing]);

    const loadFilters = async () => {
        try {
            const [yR, pR, cR] = await Promise.all([getPublishedYears(), getPublishedPrograms(), getPublishedCategories()]);
            setYears(yR.data.data || []);
            setPrograms(pR.data.data || []);
            setCategories(cR.data.data || []);
        } catch {}
    };

    const fetchCapstones = useCallback(async () => {
        try {
            setLoading(true);
            const params = { page, per_page: 20 };
            if (debouncedSearch) params.search = debouncedSearch;
            if (filters.year) params.year = filters.year;
            if (filters.program) params.program = filters.program;
            if (filters.category) params.category = filters.category;
            const res = viewing === 'archived'
                ? await getArchivedStudentCapstones(params)
                : await getStudentCapstones(params);
            const data = res.data.data;
            setCapstones(data?.data || data || []);
            setLastPage(data?.last_page || 1);
        } catch {
            notify.error('Failed to load capstones.');
        } finally {
            setLoading(false);
        }
    }, [debouncedSearch, filters, page, viewing, notify]);

    const handleDelete = (cap) => setConfirm({
        open: true,
        title: 'Delete Capstone',
        message: `Permanently delete "${cap.title}"? This cannot be undone.`,
        variant: 'danger',
        action: async () => {
            try { await deleteStudentCapstone(cap.id); notify.success('Deleted.'); fetchCapstones(); }
            catch { notify.error('Failed to delete.'); }
            setConfirm(p => ({ ...p, open: false }));
        },
    });

    const setFilter = (k, v) => { setFilters(p => ({ ...p, [k]: v })); setPage(1); };

    return (
        <div className="flex flex-col gap-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">
                        {viewing === 'archived' ? 'Archived Capstones' : 'My Capstone Library'}
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">
                        {viewing === 'archived' ? 'Your archived submissions' : 'All capstone projects you have submitted'}
                    </p>
                </div>
                <div className="flex gap-2">
                    {viewing === 'active'
                        ? <button onClick={() => { setViewing('archived'); setPage(1); }}
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 shadow-sm transition-colors">
                            View Archived
                          </button>
                        : <button onClick={() => { setViewing('active'); setPage(1); }}
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 shadow-sm transition-colors">
                            ← Back to Active
                          </button>
                    }
                </div>
            </div>

            {/* Search + Filters */}
            <div className="flex flex-wrap gap-3 items-center">
                <div className="relative flex-1 min-w-[200px]">
                    <HiOutlineSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input type="text" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
                        placeholder="Search by title or author..."
                        className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm placeholder-gray-400 bg-white focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none" />
                </div>
                <select value={filters.category} onChange={e => setFilter('category', e.target.value)}
                    className="px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-green-500 outline-none">
                    <option value="">All Categories</option>
                    {categories.map(c => {
                        const val = typeof c === 'string' ? c : c.name;
                        return <option key={val} value={val}>{val}</option>;
                    })}
                </select>
                <button onClick={() => setShowFilters(!showFilters)}
                    className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg border transition-colors ${showFilters ? 'bg-green-50 text-green-700 border-green-200' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}>
                    <HiOutlineFilter className="w-4 h-4" /> Filters
                </button>
            </div>
            {showFilters && (
                <div className="flex flex-wrap gap-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <select value={filters.year} onChange={e => setFilter('year', e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-green-500 outline-none">
                        <option value="">All Years</option>
                        {years.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                    <select value={filters.program} onChange={e => setFilter('program', e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-green-500 outline-none">
                        <option value="">All Programs</option>
                        {programs.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                    <button onClick={() => { setSearch(''); setFilters({ year: '', program: '', category: '' }); setPage(1); }}
                        className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 underline">Clear All</button>
                </div>
            )}

            {/* Table */}
            {loading ? (
                <div className="bg-white rounded-xl border border-gray-200 p-8"><Loading text="Loading your capstones..." /></div>
            ) : capstones.length === 0 ? (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
                    <EmptyState title="No capstones found"
                        description={debouncedSearch || filters.year || filters.category ? 'Try adjusting your filters.' : "You haven't submitted any capstones yet."}
                        icon={<HiOutlineDocumentText className="w-12 h-12" />} />
                </div>
            ) : (
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-gray-200 bg-gray-50">
                                    <th className="py-3 px-4 text-left text-xs font-semibold text-gray-600 uppercase">Title</th>
                                    <th className="py-3 px-4 text-left text-xs font-semibold text-gray-600 uppercase">Program / Year</th>
                                    <th className="py-3 px-4 text-left text-xs font-semibold text-gray-600 uppercase">Status</th>
                                    <th className="py-3 px-4 text-left text-xs font-semibold text-gray-600 uppercase">Submitted</th>
                                    <th className="py-3 px-4 text-center text-xs font-semibold text-gray-600 uppercase">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {capstones.map((cap, idx) => (
                                    <tr key={cap.id} className={`border-b border-gray-100 hover:bg-green-50/30 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}`}>
                                        <td className="py-3 px-4 text-sm">
                                            <div className="font-semibold text-gray-900 line-clamp-2 max-w-xs">{cap.title}</div>
                                            <div className="text-xs text-gray-500 mt-0.5">{cap.author || '—'}</div>
                                        </td>
                                        <td className="py-3 px-4 text-sm">
                                            <div className="text-gray-800">{cap.program || '—'}</div>
                                            <div className="text-xs text-gray-500">{cap.year || '—'}</div>
                                        </td>
                                        <td className="py-3 px-4"><StatusBadge status={cap.status} isPublished={cap.is_published} /></td>
                                        <td className="py-3 px-4 text-sm text-gray-600">
                                            {new Date(cap.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                        </td>
                                        <td className="py-3 px-4">
                                            <div className="flex items-center justify-center gap-2">
                                                <button onClick={() => navigate(`/student/capstones/${cap.id}`)} title="View"
                                                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                                                    <HiOutlineEye className="w-4 h-4" />
                                                </button>
                                                {viewing === 'archived' && (
                                                    <button onClick={() => handleDelete(cap)} title="Delete permanently"
                                                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                                                        <HiOutlineTrash className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {lastPage > 1 && (
                        <div className="flex items-center justify-center gap-2 p-4 border-t border-gray-100">
                            <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}
                                className="px-4 py-2 text-sm font-medium rounded-lg bg-[#1B5E20] text-white hover:bg-green-800 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors">Previous</button>
                            <span className="text-sm text-gray-600">Page {page} of {lastPage}</span>
                            <button onClick={() => setPage(Math.min(lastPage, page + 1))} disabled={page === lastPage}
                                className="px-4 py-2 text-sm font-medium rounded-lg bg-[#1B5E20] text-white hover:bg-green-800 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors">Next</button>
                        </div>
                    )}
                </div>
            )}

            <ConfirmDialog open={confirm.open} title={confirm.title} message={confirm.message}
                variant={confirm.variant} onConfirm={confirm.action}
                onCancel={() => setConfirm(p => ({ ...p, open: false }))} />
        </div>
    );
}
