import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    HiOutlineSearch, HiOutlineFilter, HiOutlineDocumentText,
    HiOutlineEye, HiOutlinePencil, HiOutlineTrash, HiOutlineUpload,
    HiArrowLeft, HiOutlineViewGrid, HiOutlineViewList, HiOutlineUser,
    HiOutlineTag, HiOutlineCalendar, HiOutlineAcademicCap, HiOutlineChevronDown,
} from 'react-icons/hi';
import {
    HiOutlineArchiveBoxArrowDown, HiOutlineArchiveBoxXMark,
} from 'react-icons/hi2';
import {
    getCapstones, deleteCapstone, archiveCapstone, unarchiveCapstone, getArchivedCapstones,
} from '../../api/admin';
import { useNotification } from '../../components/Notification';
import Loading from '../../components/Loading';
import EmptyState from '../../components/EmptyState';
import ConfirmDialog from '../../components/ConfirmDialog';
import CapstoneModal from '../../components/admin/CapstoneModal';
import UploadCapstoneModal from '../../components/admin/UploadCapstoneModal';
import EditCapstoneModal from '../../components/admin/EditCapstoneModal';

export default function CapstoneLibrary() {
    const navigate = useNavigate();
    const notify = useNotification();

    // ── Data state ───────────────────────────────────────────────────────────────
    const [capstones, setCapstones] = useState([]);
    const [loading, setLoading] = useState(true);

    // ── UI state ─────────────────────────────────────────────────────────────────
    const [uploadOpen, setUploadOpen] = useState(false);
    const [viewing, setViewing] = useState('active');       // 'active' | 'archived'
    const [displayMode, setDisplayMode] = useState('card'); // 'card' | 'table'
    const [showFilters, setShowFilters] = useState(false);

    // ── Search & filters ──────────────────────────────────────────────────────────
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const searchTimer = useRef(null);
    const [filters, setFilters] = useState({ year: '', program: '', category: '', adviser_id: '' });

    // ── Filter option lists (extracted from real DB data) ─────────────────────────
    const [years, setYears] = useState([]);
    const [programs, setPrograms] = useState([]);
    const [categories, setCategories] = useState([]);
    const [adviserOptions, setAdviserOptions] = useState([]); // only advisers WITH capstones

    // ── Adviser dropdown ──────────────────────────────────────────────────────────
    const [adviserSearch, setAdviserSearch] = useState('');
    const [adviserDropdownOpen, setAdviserDropdownOpen] = useState(false);
    const [selectedAdviserName, setSelectedAdviserName] = useState('');
    const adviserDropdownRef = useRef(null);

    // ── Pagination ────────────────────────────────────────────────────────────────
    const [page, setPage] = useState(1);
    const [lastPage, setLastPage] = useState(1);

    // ── Modal / confirm state ─────────────────────────────────────────────────────
    const [confirm, setConfirm] = useState({ open: false, title: '', message: '', action: null, variant: 'danger' });
    const [selectedCapstone, setSelectedCapstone] = useState(null);
    const [showViewModal, setShowViewModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);

    // ── Derived ───────────────────────────────────────────────────────────────────
    const activeFilterCount = [filters.year, filters.program, filters.category, filters.adviser_id].filter(Boolean).length;
    const filteredAdviserOptions = adviserOptions.filter(a => a.name.toLowerCase().includes(adviserSearch.toLowerCase()));

    // ── Effects ───────────────────────────────────────────────────────────────────
    useEffect(() => {
        clearTimeout(searchTimer.current);
        searchTimer.current = setTimeout(() => setDebouncedSearch(search), 350);
        return () => clearTimeout(searchTimer.current);
    }, [search]);

    useEffect(() => { loadFilters(); }, []);

    useEffect(() => {
        const handler = (e) => {
            if (adviserDropdownRef.current && !adviserDropdownRef.current.contains(e.target))
                setAdviserDropdownOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    useEffect(() => { fetchCapstones(); }, [debouncedSearch, filters, page, viewing]);

    // ── API calls ─────────────────────────────────────────────────────────────────
    /**
     * Loads all filter options from the real capstone data in the database.
     * Years, programs, categories, and advisers are all derived from actual capstones
     * so no phantom options appear.
     */
    const loadFilters = async () => {
        try {
            const res = await getCapstones({ per_page: 1000 });
            const all = res.data.data?.data || res.data.data || [];

            setYears([...new Set(all.map(c => c.year).filter(Boolean))].sort((a, b) => b - a));
            setPrograms([...new Set(all.map(c => c.program).filter(Boolean))].sort());
            setCategories([...new Set(all.map(c => c.category).filter(Boolean))].sort());

            // Advisers = uploaders who actually have at least one capstone
            const adviserMap = new Map();
            all.forEach(c => {
                if (c.uploader?.id && c.uploader?.name)
                    adviserMap.set(c.uploader.id, c.uploader.name);
            });
            setAdviserOptions(
                [...adviserMap.entries()]
                    .map(([id, name]) => ({ id, name }))
                    .sort((a, b) => a.name.localeCompare(b.name))
            );
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
            if (filters.adviser_id) params.adviser_id = filters.adviser_id;
            const api = viewing === 'archived' ? getArchivedCapstones : getCapstones;
            const res = await api(params);
            const data = res.data.data;
            setCapstones(data?.data || data || []);
            setLastPage(data?.last_page || 1);
        } catch (err) {
            notify.error('Failed to load capstones.');
        } finally {
            setLoading(false);
        }
    }, [debouncedSearch, filters, page, viewing, notify]);

    // ── Handlers ──────────────────────────────────────────────────────────────────
    const handleSearch = (e) => { setSearch(e.target.value); setPage(1); };
    const handleFilterChange = (key, value) => { setFilters(prev => ({ ...prev, [key]: value })); setPage(1); };
    const handleView = (cap) => { setSelectedCapstone(cap); setShowViewModal(true); };
    const handleEdit = (cap) => { setSelectedCapstone(cap); setShowEditModal(true); };

    const handleAdviserSelect = (adviser) => {
        setFilters(prev => ({ ...prev, adviser_id: adviser ? adviser.id : '' }));
        setSelectedAdviserName(adviser ? adviser.name : '');
        setAdviserSearch('');
        setAdviserDropdownOpen(false);
        setPage(1);
    };

    const clearFilters = () => {
        setSearch('');
        setFilters({ year: '', program: '', category: '', adviser_id: '' });
        setSelectedAdviserName('');
        setAdviserSearch('');
        setPage(1);
    };

    const handleArchive = (cap) => setConfirm({
        open: true, title: 'Archive Capstone',
        message: `Archive "${cap.title}"? You can restore it later from the Archive folder.`,
        variant: 'warning',
        action: async () => {
            try { await archiveCapstone(cap.id); notify.success('Capstone archived.'); fetchCapstones(); }
            catch { notify.error('Failed to archive capstone.'); }
            setConfirm(p => ({ ...p, open: false }));
        },
    });

    const handleUnarchive = (cap) => setConfirm({
        open: true, title: 'Restore Capstone',
        message: `Restore "${cap.title}" to active capstones?`,
        variant: 'info',
        action: async () => {
            try { await unarchiveCapstone(cap.id); notify.success('Capstone restored.'); fetchCapstones(); }
            catch { notify.error('Failed to restore capstone.'); }
            setConfirm(p => ({ ...p, open: false }));
        },
    });

    const handleDelete = (cap) => setConfirm({
        open: true, title: 'Delete Capstone',
        message: `Permanently delete "${cap.title}"? This cannot be undone.`,
        variant: 'danger',
        action: async () => {
            try { await deleteCapstone(cap.id); notify.success('Capstone deleted.'); fetchCapstones(); }
            catch { notify.error('Failed to delete capstone.'); }
            setConfirm(p => ({ ...p, open: false }));
        },
    });

    // ── Shared card actions ───────────────────────────────────────────────────────
    const ActionButtons = ({ cap, size = 'sm' }) => {
        const p = size === 'sm' ? 'p-1.5' : 'p-2';
        return (
            <>
                <button onClick={(e) => { e.stopPropagation(); handleView(cap); }} title="View" className={`${p} text-blue-600 hover:bg-blue-50 rounded-lg transition-colors`}><HiOutlineEye className="w-4 h-4" /></button>
                {viewing === 'active' ? (
                    <>
                        <button onClick={(e) => { e.stopPropagation(); handleEdit(cap); }} title="Edit" className={`${p} text-amber-600 hover:bg-amber-50 rounded-lg transition-colors`}><HiOutlinePencil className="w-4 h-4" /></button>
                        <button onClick={(e) => { e.stopPropagation(); handleArchive(cap); }} title="Archive" className={`${p} text-orange-600 hover:bg-orange-50 rounded-lg transition-colors`}><HiOutlineArchiveBoxArrowDown className="w-4 h-4" /></button>
                    </>
                ) : (
                    <>
                        <button onClick={(e) => { e.stopPropagation(); handleUnarchive(cap); }} title="Restore" className={`${p} text-green-600 hover:bg-green-50 rounded-lg transition-colors`}><HiOutlineArchiveBoxXMark className="w-4 h-4" /></button>
                        <button onClick={(e) => { e.stopPropagation(); handleDelete(cap); }} title="Delete" className={`${p} text-red-600 hover:bg-red-50 rounded-lg transition-colors`}><HiOutlineTrash className="w-4 h-4" /></button>
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
                                <span className="truncate">{cap.uploader?.name || '—'}</span>
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
                            <th className="py-3 px-4 text-left text-xs font-semibold text-gray-600 uppercase">Program</th>
                            <th className="py-3 px-4 text-left text-xs font-semibold text-gray-600 uppercase">Category</th>
                            <th className="py-3 px-4 text-left text-xs font-semibold text-gray-600 uppercase">Uploaded By</th>
                            <th className="py-3 px-4 text-left text-xs font-semibold text-gray-600 uppercase">Year</th>
                            <th className="py-3 px-4 text-left text-xs font-semibold text-gray-600 uppercase">Date</th>
                            <th className="py-3 px-4 text-center text-xs font-semibold text-gray-600 uppercase">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {capstones.map((cap, idx) => (
                            <tr key={cap.id}
                                onClick={() => handleView(cap)}
                                className={`border-b border-gray-100 hover:bg-green-50 transition-colors cursor-pointer ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                                <td className="py-3 px-4 text-sm font-medium text-gray-900 hover:text-[#1B5E20] max-w-xs">
                                    <span className="line-clamp-2">{cap.title}</span>
                                </td>
                                <td className="py-3 px-4 text-sm text-gray-600">{cap.program || '—'}</td>
                                <td className="py-3 px-4 text-sm text-gray-600">
                                    {cap.category ? <span className="px-2 py-0.5 bg-purple-50 text-purple-700 rounded-full text-xs font-medium border border-purple-100">{cap.category}</span> : '—'}
                                </td>
                                <td className="py-3 px-4 text-sm text-gray-700">{cap.uploader?.name || '—'}</td>
                                <td className="py-3 px-4 text-sm text-gray-700">{cap.year || '—'}</td>
                                <td className="py-3 px-4 text-sm text-gray-700">{new Date(cap.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                                <td className="py-3 px-4 text-center" onClick={e => e.stopPropagation()}>
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

    // ── Render ────────────────────────────────────────────────────────────────────
    return (
        <div className="flex flex-col h-screen bg-gray-50">

            {/* ── Header ── */}
            <div className="bg-white border-b border-gray-200 shadow-sm">
                <div className="px-4 lg:px-8 py-6 lg:py-8 space-y-4">

                    {/* Title row */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="flex items-center gap-3">
                            {viewing === 'archived' && (
                                <button onClick={() => { setViewing('active'); setPage(1); }} className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors" title="Back">
                                    <HiArrowLeft className="w-5 h-5" />
                                </button>
                            )}
                            <div>
                                <h1 className="text-3xl font-bold text-gray-900">{viewing === 'archived' ? 'Archived Capstones' : 'Capstone Library'}</h1>
                                <p className="text-sm text-gray-500 mt-2">{viewing === 'archived' ? 'Manage archived capstone projects' : 'Manage all capstone projects'}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 flex-wrap">
                            {/* Card / Table toggle */}
                            <div className="flex items-center bg-gray-100 rounded-lg p-1 border border-gray-200">
                                <button onClick={() => setDisplayMode('card')} title="Card View"
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200 ${displayMode === 'card' ? 'bg-white text-[#1B5E20] shadow-sm border border-gray-200' : 'text-gray-500 hover:text-gray-700'}`}>
                                    <HiOutlineViewGrid className="w-4 h-4" /><span className="hidden sm:inline">Cards</span>
                                </button>
                                <button onClick={() => setDisplayMode('table')} title="Table View"
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200 ${displayMode === 'table' ? 'bg-white text-[#1B5E20] shadow-sm border border-gray-200' : 'text-gray-500 hover:text-gray-700'}`}>
                                    <HiOutlineViewList className="w-4 h-4" /><span className="hidden sm:inline">Table</span>
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

                    {/* Search + Filters toggle */}
                    <div className="flex flex-col sm:flex-row gap-3 items-end flex-wrap">
                        <div className="relative flex-1 min-w-[250px]">
                            <HiOutlineSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input type="text" value={search} onChange={handleSearch} placeholder="Search by title or author..."
                                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 bg-white focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none" />
                        </div>
                        <button onClick={() => setShowFilters(!showFilters)}
                            className={`relative inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg border transition-colors ${showFilters ? 'bg-green-50 text-green-700 border-green-200' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}>
                            <HiOutlineFilter className="w-4 h-4" />
                            Filters
                            {activeFilterCount > 0 && (
                                <span className="absolute -top-1.5 -right-1.5 flex items-center justify-center w-4 h-4 text-[10px] font-bold text-white bg-[#1B5E20] rounded-full">{activeFilterCount}</span>
                            )}
                        </button>
                    </div>

                    {/* Expanded filter panel */}
                    {showFilters && (
                        <div className="flex flex-wrap gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                            {/* Year */}
                            <div>
                                <label className="text-xs text-gray-600 font-semibold uppercase block mb-1">Year</label>
                                <select value={filters.year} onChange={(e) => handleFilterChange('year', e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none">
                                    <option value="">All Years</option>
                                    {years.map(y => <option key={y} value={y}>{y}</option>)}
                                </select>
                            </div>
                            {/* Program */}
                            <div>
                                <label className="text-xs text-gray-600 font-semibold uppercase block mb-1">Program</label>
                                <select value={filters.program} onChange={(e) => handleFilterChange('program', e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none">
                                    <option value="">All Programs</option>
                                    {programs.map(p => <option key={p} value={p}>{p}</option>)}
                                </select>
                            </div>
                            {/* Adviser (searchable — only shows advisers with capstones) */}
                            <div ref={adviserDropdownRef} className="relative">
                                <label className="text-xs text-gray-600 font-semibold uppercase block mb-1">Adviser</label>
                                <button type="button" onClick={() => setAdviserDropdownOpen(!adviserDropdownOpen)}
                                    className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-green-500 outline-none min-w-[176px] text-left transition-colors ${filters.adviser_id ? 'border-green-400' : 'border-gray-300'}`}>
                                    <span className="flex-1 truncate text-gray-900">{selectedAdviserName || 'All Advisers'}</span>
                                    <HiOutlineChevronDown className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${adviserDropdownOpen ? 'rotate-180' : ''}`} />
                                </button>
                                {adviserDropdownOpen && (
                                    <div className="absolute z-30 mt-1 w-56 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
                                        <div className="p-2 border-b border-gray-100">
                                            <div className="relative">
                                                <HiOutlineSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                                                <input type="text" value={adviserSearch} onChange={e => setAdviserSearch(e.target.value)}
                                                    placeholder="Search adviser..." autoFocus
                                                    className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-md focus:ring-1 focus:ring-green-400 focus:border-green-400 outline-none" />
                                            </div>
                                        </div>
                                        <div className="max-h-48 overflow-y-auto">
                                            <button type="button" onClick={() => handleAdviserSelect(null)}
                                                className={`w-full text-left px-3 py-2 text-sm hover:bg-green-50 transition-colors ${!filters.adviser_id ? 'font-medium text-[#1B5E20] bg-green-50' : 'text-gray-700'}`}>
                                                All Advisers
                                            </button>
                                            {filteredAdviserOptions.length === 0 ? (
                                                <div className="px-3 py-4 text-xs text-gray-400 text-center">No advisers found</div>
                                            ) : filteredAdviserOptions.map(a => (
                                                <button key={a.id} type="button" onClick={() => handleAdviserSelect(a)}
                                                    className={`w-full text-left px-3 py-2 text-sm hover:bg-green-50 transition-colors ${filters.adviser_id === a.id ? 'font-medium text-[#1B5E20] bg-green-50' : 'text-gray-700'}`}>
                                                    {a.name}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                            {/* Category */}
                            <div>
                                <label className="text-xs text-gray-600 font-semibold uppercase block mb-1">Category</label>
                                <select value={filters.category} onChange={(e) => handleFilterChange('category', e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none">
                                    <option value="">All Categories</option>
                                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                            <div className="flex items-end">
                                <button onClick={clearFilters} className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 underline">Clear All</button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Content ── */}
            <div className="flex-1 min-h-0 overflow-y-auto">
                <div className="px-4 lg:px-8 py-6">
                    {loading ? (
                        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-5"><Loading text="Loading capstones..." /></div>
                    ) : capstones.length === 0 ? (
                        <EmptyState
                            title="No capstones found"
                            description={debouncedSearch || Object.values(filters).some(Boolean) ? 'Try adjusting your search or filters.' : 'Upload capstones to get started.'}
                            icon={<HiOutlineDocumentText className="w-12 h-12" />}
                        />
                    ) : (
                        <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
                            {displayMode === 'card' ? <CardView /> : <TableView />}
                        </div>
                    )}
                </div>
            </div>

            {/* ── Modals ── */}
            {showViewModal && selectedCapstone && (
                <CapstoneModal capstone={selectedCapstone} open={true}
                    onClose={() => { setShowViewModal(false); setSelectedCapstone(null); }}
                    onViewFull={() => navigate(`/admin/capstones/${selectedCapstone.id}`)} />
            )}
            {showEditModal && selectedCapstone && (
                <EditCapstoneModal capstone={selectedCapstone}
                    onClose={() => { setShowEditModal(false); setSelectedCapstone(null); }}
                    onSuccess={() => { setShowEditModal(false); setSelectedCapstone(null); fetchCapstones(); }} />
            )}
            {uploadOpen && <UploadCapstoneModal open={uploadOpen} onClose={() => setUploadOpen(false)} />}

            <ConfirmDialog open={confirm.open} title={confirm.title} message={confirm.message} variant={confirm.variant}
                onConfirm={confirm.action} onCancel={() => setConfirm(p => ({ ...p, open: false }))} />
        </div>
    );
}
