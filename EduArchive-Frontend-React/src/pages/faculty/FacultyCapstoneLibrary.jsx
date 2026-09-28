import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
    HiOutlineSearch, HiOutlineFilter, HiOutlineDocumentText,
    HiOutlineEye, HiOutlinePencil, HiOutlineTrash, HiOutlineUpload,
    HiArrowLeft, HiOutlineViewGrid, HiOutlineViewList, HiOutlineUser,
    HiOutlineTag, HiOutlineCalendar, HiOutlineAcademicCap,
} from 'react-icons/hi';
import { HiOutlineArchiveBoxArrowDown, HiOutlineArchiveBoxXMark } from 'react-icons/hi2';
import {
    getFacultyCapstones,
    getCapstone,
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
    const [displayMode, setDisplayMode] = useState('card'); // 'card' | 'table'
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
    const [fetchingEdit, setFetchingEdit] = useState(false);
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
    const handleEdit = async (capstone) => {
        setFetchingEdit(true);
        try {
            const res = await getCapstone(capstone.id);
            setSelectedCapstone(res.data.data);
            setShowEditModal(true);
        } catch {
            notify.error('Failed to load capstone details.');
        } finally {
            setFetchingEdit(false);
        }
    };

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

    // ── Action Buttons Component ─────────────────────────────────────────────────
    const ActionButtons = ({ cap, size = 'sm' }) => {
        const p = size === 'sm' ? 'p-1.5' : 'p-2';
        return (
            <>
                <button onClick={(e) => { e?.stopPropagation(); handleView(cap); }} title="View" className={`${p} text-blue-600 hover:bg-blue-50 rounded-lg transition-colors`}><HiOutlineEye className="w-4 h-4" /></button>
                {viewing === 'active' ? (
                    <>
                        <button onClick={(e) => { e?.stopPropagation(); handleEdit(cap); }} title="Edit" className={`${p} text-amber-600 hover:bg-amber-50 rounded-lg transition-colors`}><HiOutlinePencil className="w-4 h-4" /></button>
                        <button onClick={(e) => { e?.stopPropagation(); handleArchive(cap); }} title="Archive" className={`${p} text-orange-600 hover:bg-orange-50 rounded-lg transition-colors`}><HiOutlineArchiveBoxArrowDown className="w-4 h-4" /></button>
                    </>
                ) : (
                    <>
                        <button onClick={(e) => { e?.stopPropagation(); handleUnarchive(cap); }} title="Restore" className={`${p} text-green-600 hover:bg-green-50 rounded-lg transition-colors`}><HiOutlineArchiveBoxXMark className="w-4 h-4" /></button>
                        <button onClick={(e) => { e?.stopPropagation(); handleDelete(cap); }} title="Delete" className={`${p} text-red-600 hover:bg-red-50 rounded-lg transition-colors`}><HiOutlineTrash className="w-4 h-4" /></button>
                    </>
                )}
            </>
        );
    };

    // ── Card View ─────────────────────────────────────────────────────────────────
    const CardView = () => (
        <div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-4 lg:p-6">
                {capstones.map((cap) => (
                    <div key={cap.id}
                        onClick={() => handleView(cap)}
                        className="group bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex flex-col overflow-hidden cursor-pointer">
                        <div className="h-1.5 bg-gradient-to-r from-[#1B5E20] to-green-400 w-full" />
                        <div className="p-4 flex flex-col flex-1 gap-3">
                            <h3 className="text-sm font-semibold text-gray-900 leading-snug line-clamp-2 group-hover:text-[#1B5E20] transition-colors">{cap.title}</h3>
                            <div className="flex flex-wrap gap-1.5">
                                {cap.program && (<span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-green-50 text-green-700 rounded-full border border-green-100"><HiOutlineAcademicCap className="w-3 h-3" />{cap.program}</span>)}
                                {cap.year && (<span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-blue-50 text-blue-700 rounded-full border border-blue-100"><HiOutlineCalendar className="w-3 h-3" />{cap.year}</span>)}
                                {cap.category && (<span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-purple-50 text-purple-700 rounded-full border border-purple-100"><HiOutlineTag className="w-3 h-3" />{cap.category}</span>)}
                            </div>
                            <div className="flex items-center gap-1.5 text-xs text-gray-500 mt-auto">
                                <HiOutlineUser className="w-3.5 h-3.5 flex-shrink-0" />
                                <span className="truncate">{cap.author || '—'}</span>
                            </div>
                            <div className="text-xs text-gray-400">{new Date(cap.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                        </div>
                        <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 flex items-center justify-between gap-1.5">
                            <span className="text-[10px] text-gray-400 italic">
                                {cap.is_published ? '🟢 Published' : cap.publication_status === 'in_progress' ? '🟡 In Progress' : '⚫ Unpublished'}
                            </span>
                            <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                                <ActionButtons cap={cap} size="sm" />
                            </div>
                        </div>
                    </div>
                ))}
            </div>
            {lastPage > 1 && (
                <div className="flex items-center justify-center gap-2 p-4 border-t border-gray-100">
                    <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} className="px-4 py-2 text-sm font-medium rounded-lg transition-colors bg-[#1B5E20] text-white hover:bg-green-800 disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed">Previous</button>
                    <span className="text-sm font-medium text-gray-600">Page {page} of {lastPage}</span>
                    <button onClick={() => setPage(Math.min(lastPage, page + 1))} disabled={page === lastPage} className="px-4 py-2 text-sm font-medium rounded-lg transition-colors bg-[#1B5E20] text-white hover:bg-green-800 disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed">Next</button>
                </div>
            )}
        </div>
    );

    // ── Table View ────────────────────────────────────────────────────────────────
    const TableView = () => (
        <div>
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
                            <tr key={cap.id}
                                onClick={() => handleView(cap)}
                                className={`border-b border-gray-100 hover:bg-green-50 transition-colors cursor-pointer ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                                <td className="py-3 px-4 text-sm">
                                    <div className="font-semibold text-gray-900 line-clamp-2 max-w-xs hover:text-[#1B5E20]">{cap.title}</div>
                                    <div className="text-xs text-gray-500 mt-0.5">{cap.author || '—'}</div>
                                </td>
                                <td className="py-3 px-4 text-sm">
                                    <div className="text-gray-800">{cap.program || '—'}</div>
                                    <div className="text-xs text-gray-500">{cap.year || '—'}</div>
                                </td>
                                <td className="py-3 px-4 text-sm text-gray-600">
                                    {new Date(cap.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                </td>
                                <td className="py-3 px-4" onClick={e => e.stopPropagation()}>
                                    <div className="flex items-center justify-center gap-2">
                                        <ActionButtons cap={cap} size="md" />
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {lastPage > 1 && (
                <div className="flex items-center justify-center gap-2 p-4 border-t border-gray-100">
                    <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} className="px-4 py-2 text-sm font-medium rounded-lg transition-colors bg-[#1B5E20] text-white hover:bg-green-800 disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed">Previous</button>
                    <span className="text-sm font-medium text-gray-600">Page {page} of {lastPage}</span>
                    <button onClick={() => setPage(Math.min(lastPage, page + 1))} disabled={page === lastPage} className="px-4 py-2 text-sm font-medium rounded-lg transition-colors bg-[#1B5E20] text-white hover:bg-green-800 disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed">Next</button>
                </div>
            )}
        </div>
    );

    return (
        <div className="flex flex-col h-screen bg-gray-50">
            {/* ── Header ── */}
            <div className="bg-white border-b border-gray-200 shadow-sm">
                <div className="px-4 lg:px-8 py-6 lg:py-8 space-y-4">

                    {/* Desktop Title row */}
                    <div className="hidden sm:flex sm:items-center sm:justify-between gap-3">
                        <div className="flex items-center gap-3">
                            {viewing === 'archived' && (
                                <button onClick={() => { setViewing('active'); setPage(1); }} className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors" title="Back">
                                    <HiArrowLeft className="w-5 h-5" />
                                </button>
                            )}
                            <div>
                                <h1 className="text-3xl font-bold text-gray-900">{viewing === 'archived' ? 'Archived Capstones' : 'Capstone Library'}</h1>
                                <p className="text-sm text-gray-500 mt-2">{viewing === 'archived' ? 'Your archived capstone projects' : 'All capstone projects you have uploaded'}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 flex-wrap">
                            {/* Card / Table toggle */}
                            <div className="flex items-center bg-gray-100 rounded-lg p-1 border border-gray-200">
                                <button onClick={() => setDisplayMode('card')} title="Card View"
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200 ${displayMode === 'card' ? 'bg-white text-[#1B5E20] shadow-sm border border-gray-200' : 'text-gray-500 hover:text-gray-700'}`}>
                                    <HiOutlineViewGrid className="w-4 h-4" /><span>Cards</span>
                                </button>
                                <button onClick={() => setDisplayMode('table')} title="Table View"
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200 ${displayMode === 'table' ? 'bg-white text-[#1B5E20] shadow-sm border border-gray-200' : 'text-gray-500 hover:text-gray-700'}`}>
                                    <HiOutlineViewList className="w-4 h-4" /><span>Table</span>
                                </button>
                            </div>
                            {viewing === 'active' && (
                                <>
                                    <button onClick={() => { setViewing('archived'); setPage(1); }} className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200 transition-colors">
                                        <HiOutlineArchiveBoxArrowDown className="w-4 h-4" />Archive
                                    </button>
                                    <button onClick={() => setUploadOpen(true)} className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-white bg-green-600 border border-green-600 rounded-lg hover:bg-green-700 transition-colors shadow-sm">
                                        <HiOutlineUpload className="w-4 h-4" />Upload Capstone
                                    </button>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Mobile view */}
                    <div className="sm:hidden space-y-3">
                        {/* Title - Mobile */}
                        <div className="flex items-center gap-3">
                            {viewing === 'archived' && (
                                <button onClick={() => { setViewing('active'); setPage(1); }} className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors" title="Back">
                                    <HiArrowLeft className="w-5 h-5" />
                                </button>
                            )}
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900">{viewing === 'archived' ? 'Archived Capstones' : 'Capstone Library'}</h1>
                                <p className="text-xs text-gray-500 mt-1">{viewing === 'archived' ? 'Your archived capstone projects' : 'All capstone projects you have uploaded'}</p>
                            </div>
                        </div>

                        {/* Row 1: Card/Table, Archive, Upload - Aligned Right */}
                        <div className="flex items-center justify-end gap-2">
                            {/* Card / Table toggle */}
                            <div className="flex items-center bg-gray-100 rounded-lg p-1 border border-gray-200">
                                <button onClick={() => setDisplayMode('card')} title="Card View"
                                    className={`flex items-center gap-1 px-2 py-1.5 rounded-md text-sm font-medium transition-all duration-200 ${displayMode === 'card' ? 'bg-white text-[#1B5E20] shadow-sm border border-gray-200' : 'text-gray-500 hover:text-gray-700'}`}>
                                    <HiOutlineViewGrid className="w-4 h-4" />
                                </button>
                                <button onClick={() => setDisplayMode('table')} title="Table View"
                                    className={`flex items-center gap-1 px-2 py-1.5 rounded-md text-sm font-medium transition-all duration-200 ${displayMode === 'table' ? 'bg-white text-[#1B5E20] shadow-sm border border-gray-200' : 'text-gray-500 hover:text-gray-700'}`}>
                                    <HiOutlineViewList className="w-4 h-4" />
                                </button>
                            </div>
                            {viewing === 'active' && (
                                <>
                                    <button onClick={() => { setViewing('archived'); setPage(1); }} className="inline-flex items-center justify-center p-2.5 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200 transition-colors" title="Archive">
                                        <HiOutlineArchiveBoxArrowDown className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => setUploadOpen(true)} className="inline-flex items-center justify-center p-2.5 text-sm font-medium text-white bg-green-600 border border-green-600 rounded-lg hover:bg-green-700 transition-colors shadow-sm" title="Upload Capstone">
                                        <HiOutlineUpload className="w-4 h-4" />
                                    </button>
                                </>
                            )}
                        </div>

                        {/* Row 2: Search and Filters */}
                        <div className="flex gap-2 items-center">
                            <div className="relative flex-1">
                                <HiOutlineSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input type="text" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search..."
                                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 bg-white focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none" />
                            </div>
                            <button onClick={() => setShowFilters(!showFilters)}
                                className={`relative inline-flex items-center justify-center p-2.5 text-sm font-medium rounded-lg border transition-colors flex-shrink-0 ${showFilters ? 'bg-green-50 text-green-700 border-green-200' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
                                title="Filters">
                                <HiOutlineFilter className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {/* Desktop Search + Filters */}
                    <div className="hidden sm:flex gap-3 items-end flex-wrap">
                        <div className="relative flex-1 min-w-[250px]">
                            <HiOutlineSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input type="text" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search by title or author..."
                                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 bg-white focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none" />
                        </div>
                        <button onClick={() => setShowFilters(!showFilters)}
                            className={`relative inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg border transition-colors ${showFilters ? 'bg-green-50 text-green-700 border-green-200' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}>
                            <HiOutlineFilter className="w-4 h-4" />
                            Filters
                        </button>
                    </div>

                    {/* Expanded filter panel */}
                    {showFilters && (
                        <div className="flex flex-wrap gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                            <div>
                                <label className="text-xs text-gray-600 font-semibold uppercase block mb-1">Year</label>
                                <select value={filters.year} onChange={e => setFilter('year', e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none">
                                    <option value="">All Years</option>
                                    {years.map(y => <option key={y} value={y}>{y}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-xs text-gray-600 font-semibold uppercase block mb-1">Program</label>
                                <select value={filters.program} onChange={e => setFilter('program', e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none">
                                    <option value="">All Programs</option>
                                    {programs.map(p => <option key={p} value={p}>{p}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-xs text-gray-600 font-semibold uppercase block mb-1">Category</label>
                                <select value={filters.category} onChange={e => setFilter('category', e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none">
                                    <option value="">All Categories</option>
                                    {categories.map(c => {
                                        const val = typeof c === 'string' ? c : c.name;
                                        return <option key={val} value={val}>{val}</option>;
                                    })}
                                </select>
                            </div>
                            <div className="flex items-end">
                                <button onClick={() => { setSearch(''); setFilters({ year: '', program: '', category: '' }); setPage(1); }}
                                    className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                                    Clear All
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto">
                {loading ? (
                    <div className="flex items-center justify-center h-full">
                        <Loading text="Loading your capstones..." />
                    </div>
                ) : capstones.length === 0 ? (
                    <div className="flex items-center justify-center h-full p-8">
                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 max-w-md w-full">
                            <EmptyState
                                title="No capstones found"
                                description={debouncedSearch || filters.year || filters.category ? 'Try adjusting your filters.' : "You haven't uploaded any capstones yet."}
                                icon={<HiOutlineDocumentText className="w-12 h-12" />}
                            />
                        </div>
                    </div>
                ) : (
                    <div className="bg-white border border-gray-200">
                        {displayMode === 'card' ? <CardView /> : <TableView />}
                    </div>
                )}
            </div>

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

            {fetchingEdit && <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50"><div className="bg-white rounded-xl px-6 py-4 shadow-xl text-sm font-medium text-gray-700">Loading capstone data…</div></div>}

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
