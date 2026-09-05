import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
    HiOutlineSearch, HiOutlineFilter, HiOutlineDocumentText,
    HiOutlineEye, HiOutlinePencil, HiOutlineTrash, HiOutlineUpload,
} from 'react-icons/hi';
import { HiOutlineArchiveBoxArrowDown, HiOutlineArchiveBoxXMark } from 'react-icons/hi2';
import {
    getFacultyCapstones,
    getPublishedYears, getPublishedPrograms,
    getPublishedCategories,
    deleteFacultyCapstone,
    updateFacultyCapstone,
    getArchivedFacultyCapstones,
    archiveFacultyCapstone,
    unarchiveFacultyCapstone,
} from '../../api/admin';
import { useNotification } from '../../components/Notification';
import Loading from '../../components/Loading';
import EmptyState from '../../components/EmptyState';
import ConfirmDialog from '../../components/ConfirmDialog';
import CapstoneModal from '../../components/admin/CapstoneModal';
import EditCapstoneModal from '../../components/admin/EditCapstoneModal';
import FacultyUploadCapstoneModal from '../../components/faculty/FacultyUploadCapstoneModal';

export default function FacultyCapstoneLibrary() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const notify = useNotification();
    const [capstones, setCapstones] = useState([]);
    const [loading, setLoading] = useState(true);
    const [uploadOpen, setUploadOpen] = useState(false);
    const [viewing, setViewing] = useState('active'); // 'active' | 'archived'
    const [search, setSearch] = useState('');
    const [filters, setFilters] = useState({ year: '', program: '', category: '' });
    const [years, setYears] = useState([]);
    const [programs, setPrograms] = useState([]);
    const [categories, setCategories] = useState([]);
    const [showFilters, setShowFilters] = useState(false);
    const [page, setPage] = useState(1);
    const [lastPage, setLastPage] = useState(1);
    const [confirm, setConfirm] = useState({ open: false, title: '', message: '', action: null, variant: 'danger' });
    const [selectedCapstone, setSelectedCapstone] = useState(null);
    const [showViewModal, setShowViewModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const searchTimer = useRef(null);
    const [debouncedSearch, setDebouncedSearch] = useState('');

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
            const [yRes, pRes, cRes] = await Promise.all([
                getPublishedYears(),
                getPublishedPrograms(),
                getPublishedCategories(),
            ]);
            setYears(yRes.data.data || []);
            setPrograms(pRes.data.data || []);
            setCategories(cRes.data.data || []);
        } catch (err) {
            console.error('Failed to load filters:', err);
        }
    };

    const fetchCapstones = useCallback(async () => {
        try {
            setLoading(true);
            const params = { page, per_page: 20 };
            if (debouncedSearch) params.search = debouncedSearch;
            if (filters.year) params.year = filters.year;
            if (filters.program) params.program = filters.program;
            if (filters.category) params.category = filters.category;

            // Library shows only the faculty's own uploaded capstones
            const res = viewing === 'archived'
                ? await getArchivedFacultyCapstones(params)
                : await getFacultyCapstones(params);
            const data = res.data.data;
            setCapstones(data?.data || data || []);
            setLastPage(data?.last_page || 1);
        } catch (err) {
            notify.error('Failed to load capstones.');
        } finally {
            setLoading(false);
        }
    }, [debouncedSearch, filters, page, viewing, notify]);

    const setFilter = (k, v) => { setFilters(p => ({ ...p, [k]: v })); setPage(1); };

    const handleView = (capstone) => { setSelectedCapstone(capstone); setShowViewModal(true); };
    const openCapstoneViewer = (capId) => navigate(`/faculty/capstones/${capId}`);
    const handleEdit = (capstone) => { setSelectedCapstone(capstone); setShowEditModal(true); };

    const handleDelete = (capstone) => setConfirm({
        open: true,
        title: 'Delete Capstone',
        message: `Permanently delete "${capstone.title}"? This cannot be undone.`,
        variant: 'danger',
        action: async () => {
            try { await deleteFacultyCapstone(capstone.id); notify.success('Capstone deleted.'); fetchCapstones(); }
            catch { notify.error('Failed to delete capstone.'); }
            setConfirm(p => ({ ...p, open: false }));
        },
    });

    const handleArchive = (capstone) => setConfirm({
        open: true,
        title: 'Archive Capstone',
        message: `Archive "${capstone.title}"? You can restore it later from the Archive tab.`,
        variant: 'warning',
        action: async () => {
            try { await archiveFacultyCapstone(capstone.id); notify.success('Capstone archived.'); fetchCapstones(); }
            catch { notify.error('Failed to archive capstone.'); }
            setConfirm(p => ({ ...p, open: false }));
        },
    });

    const handleUnarchive = (capstone) => setConfirm({
        open: true,
        title: 'Restore Capstone',
        message: `Restore "${capstone.title}" to active capstones?`,
        variant: 'info',
        action: async () => {
            try { await unarchiveFacultyCapstone(capstone.id); notify.success('Capstone restored.'); fetchCapstones(); }
            catch { notify.error('Failed to restore capstone.'); }
            setConfirm(p => ({ ...p, open: false }));
        },
    });

    return (
        <div className="flex flex-col gap-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">
                        {viewing === 'archived' ? 'Archived Capstones' : 'Capstone Library'}
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">
                        {viewing === 'archived' ? 'Your archived capstone projects' : 'All capstone projects you have uploaded'}
                    </p>
                </div>
                <div className="flex gap-2">
                    {viewing === 'active' && (
                        <>
                            <button
                                onClick={() => setUploadOpen(true)}
                                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-[#1B5E20] rounded-lg hover:bg-green-800 shadow-sm transition-colors"
                            >
                                <HiOutlineUpload className="w-4 h-4" />
                                Upload
                            </button>
                            <button
                                onClick={() => { setViewing('archived'); setPage(1); }}
                                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 shadow-sm transition-colors inline-flex items-center gap-1.5"
                            >
                                <HiOutlineArchiveBoxArrowDown className="w-4 h-4" />
                                View Archived
                            </button>
                        </>
                    )}
                    {viewing === 'archived' && (
                        <button
                            onClick={() => { setViewing('active'); setPage(1); }}
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 shadow-sm transition-colors"
                        >
                            ← Back to Active
                        </button>
                    )}
                </div>
            </div>

            {/* Search + Filters */}
            <div className="flex flex-wrap gap-3 items-center">
                <div className="relative flex-1 min-w-[200px]">
                    <HiOutlineSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        value={search}
                        onChange={e => { setSearch(e.target.value); setPage(1); }}
                        placeholder="Search by title or author..."
                        className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm placeholder-gray-400 bg-white focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                    />
                </div>
                <select
                    value={filters.category}
                    onChange={e => setFilter('category', e.target.value)}
                    className="px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-green-500 outline-none"
                >
                    <option value="">All Categories</option>
                    {categories.map(c => {
                        const val = typeof c === 'string' ? c : c.name;
                        return <option key={val} value={val}>{val}</option>;
                    })}
                </select>
                <button
                    onClick={() => setShowFilters(!showFilters)}
                    className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg border transition-colors ${showFilters ? 'bg-green-50 text-green-700 border-green-200' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
                >
                    <HiOutlineFilter className="w-4 h-4" /> Filters
                </button>
            </div>

            {showFilters && (
                <div className="flex flex-wrap gap-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <select
                        value={filters.year}
                        onChange={e => setFilter('year', e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-green-500 outline-none"
                    >
                        <option value="">All Years</option>
                        {years.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                    <select
                        value={filters.program}
                        onChange={e => setFilter('program', e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-green-500 outline-none"
                    >
                        <option value="">All Programs</option>
                        {programs.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                    <button
                        onClick={() => { setSearch(''); setFilters({ year: '', program: '', category: '' }); setPage(1); }}
                        className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 underline"
                    >
                        Clear All
                    </button>
                </div>
            )}

            {/* Table */}
            {loading ? (
                <div className="bg-white rounded-xl border border-gray-200 p-8">
                    <Loading text="Loading your capstones..." />
                </div>
            ) : capstones.length === 0 ? (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
                    <EmptyState
                        title="No capstones found"
                        description={debouncedSearch || filters.year || filters.category ? 'Try adjusting your filters.' : "You haven't uploaded any capstones yet."}
                        icon={<HiOutlineDocumentText className="w-12 h-12" />}
                    />
                </div>
            ) : (
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-gray-200 bg-gray-50">
                                    <th className="py-3 px-4 text-left text-xs font-semibold text-gray-600 uppercase">Title</th>
                                    <th className="py-3 px-4 text-left text-xs font-semibold text-gray-600 uppercase">Program / Year</th>
                                    <th className="py-3 px-4 text-left text-xs font-semibold text-gray-600 uppercase">Uploaded</th>
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
                                        <td className="py-3 px-4 text-sm text-gray-600">
                                            {new Date(cap.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                        </td>
                                        <td className="py-3 px-4">
                                            <div className="flex items-center justify-center gap-2">
                                                <button onClick={() => handleView(cap)} title="View"
                                                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                                                    <HiOutlineEye className="w-4 h-4" />
                                                </button>
                                                {viewing === 'active' && (
                                                    <>
                                                        <button onClick={() => handleEdit(cap)} title="Edit"
                                                            className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors">
                                                            <HiOutlinePencil className="w-4 h-4" />
                                                        </button>
                                                        <button onClick={() => handleArchive(cap)} title="Archive"
                                                            className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors">
                                                            <HiOutlineArchiveBoxArrowDown className="w-4 h-4" />
                                                        </button>
                                                    </>
                                                )}
                                                {viewing === 'archived' && (
                                                    <>
                                                        <button onClick={() => handleUnarchive(cap)} title="Restore"
                                                            className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors">
                                                            <HiOutlineArchiveBoxXMark className="w-4 h-4" />
                                                        </button>
                                                        <button onClick={() => handleDelete(cap)} title="Delete permanently"
                                                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                                                            <HiOutlineTrash className="w-4 h-4" />
                                                        </button>
                                                    </>
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
                                className="px-4 py-2 text-sm font-medium rounded-lg bg-[#1B5E20] text-white hover:bg-green-800 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors">
                                Previous
                            </button>
                            <span className="text-sm text-gray-600">Page {page} of {lastPage}</span>
                            <button onClick={() => setPage(Math.min(lastPage, page + 1))} disabled={page === lastPage}
                                className="px-4 py-2 text-sm font-medium rounded-lg bg-[#1B5E20] text-white hover:bg-green-800 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors">
                                Next
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Modals */}
            {showViewModal && selectedCapstone && (
                <CapstoneModal
                    capstone={selectedCapstone}
                    open={true}
                    onClose={() => { setShowViewModal(false); setSelectedCapstone(null); }}
                    onViewFull={() => { setShowViewModal(false); openCapstoneViewer(selectedCapstone.id); }}
                />
            )}

            {showEditModal && selectedCapstone && (
                <EditCapstoneModal
                    capstone={selectedCapstone}
                    onClose={() => { setShowEditModal(false); setSelectedCapstone(null); }}
                    onSuccess={() => { setShowEditModal(false); setSelectedCapstone(null); fetchCapstones(); }}
                    updateFn={updateFacultyCapstone}
                />
            )}

            {uploadOpen && (
                <FacultyUploadCapstoneModal
                    open={uploadOpen}
                    onClose={() => setUploadOpen(false)}
                />
            )}

            <ConfirmDialog
                open={confirm.open}
                title={confirm.title}
                message={confirm.message}
                variant={confirm.variant}
                onConfirm={confirm.action}
                onCancel={() => setConfirm(p => ({ ...p, open: false }))}
            />
        </div>
    );
}
