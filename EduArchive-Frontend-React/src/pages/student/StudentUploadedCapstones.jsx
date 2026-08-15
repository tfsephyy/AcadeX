import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    HiOutlineSearch, HiOutlineFilter, HiOutlineDocumentText,
    HiOutlineBookmark, HiOutlineTrash, HiOutlineEye, HiOutlineX,
    HiOutlineViewGrid, HiOutlineViewList,
    HiOutlineTag, HiOutlineCalendar, HiOutlineAcademicCap, HiOutlineChevronDown,
} from 'react-icons/hi';
import {
    getPublishedCapstones, getPublishedYears, getPublishedPrograms,
    getPublishedAdvisers, getPublishedCategories,
    toggleBookmark, getStudentBookmarkedCapstones,
} from '../../api/admin';
import { useNotification } from '../../components/Notification';
import Loading from '../../components/Loading';
import EmptyState from '../../components/EmptyState';
import ConfirmDialog from '../../components/ConfirmDialog';
import CapstoneModal from '../../components/admin/CapstoneModal';

export default function StudentUploadedCapstones() {
    const navigate = useNavigate();
    const notify = useNotification();

    // ── Data state ───────────────────────────────────────────────────────────────
    const [capstones, setCapstones] = useState([]);
    const [savedCapstones, setSavedCapstones] = useState([]);
    const [loading, setLoading] = useState(true);
    const [savedLoading, setSavedLoading] = useState(false);
    const [savedOpen, setSavedOpen] = useState(false);

    // ── UI state ─────────────────────────────────────────────────────────────────
    const [displayMode, setDisplayMode] = useState('card'); // 'card' | 'table'
    const [showFilters, setShowFilters] = useState(false);

    // ── Search & filters ──────────────────────────────────────────────────────────
    const [search, setSearch] = useState('');
    const [filters, setFilters] = useState({ year: '', program: '', category: '', adviser_id: '' });

    // ── Filter option lists (from dedicated DB endpoints) ─────────────────────────
    const [years, setYears] = useState([]);
    const [programs, setPrograms] = useState([]);
    const [categories, setCategories] = useState([]);
    const [adviserOptions, setAdviserOptions] = useState([]);

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
    const [showModal, setShowModal] = useState(false);

    // ── Derived ───────────────────────────────────────────────────────────────────
    const activeFilterCount = [filters.year, filters.program, filters.category, filters.adviser_id].filter(Boolean).length;
    const filteredAdviserOptions = adviserOptions.filter(a => a.name.toLowerCase().includes(adviserSearch.toLowerCase()));

    // ── Effects ───────────────────────────────────────────────────────────────────
    useEffect(() => { loadFilters(); }, []);

    useEffect(() => {
        const handler = (e) => {
            if (adviserDropdownRef.current && !adviserDropdownRef.current.contains(e.target))
                setAdviserDropdownOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    useEffect(() => { fetchCapstones(); }, [search, filters, page]);

    // ── API calls ─────────────────────────────────────────────────────────────────
    /**
     * Load filter options from dedicated DB endpoints — no duplication, always fresh.
     */
    const loadFilters = async () => {
        try {
            const [yRes, pRes, cRes, aRes] = await Promise.all([
                getPublishedYears(),
                getPublishedPrograms(),
                getPublishedCategories(),
                getPublishedAdvisers(),
            ]);
            setYears(yRes.data.data || []);
            setPrograms(pRes.data.data || []);
            setCategories(cRes.data.data || []);
            setAdviserOptions(aRes.data.data || []);
        } catch (err) {
            console.error('Failed to load filters:', err);
        }
    };

    const fetchCapstones = useCallback(async () => {
        try {
            setLoading(true);
            const params = { page, per_page: 12 };
            if (search) params.search = search;
            if (filters.year) params.year = filters.year;
            if (filters.program) params.program = filters.program;
            if (filters.category) params.category = filters.category;
            if (filters.adviser_id) params.adviser_id = filters.adviser_id;
            const res = await getPublishedCapstones(params);
            const data = res.data.data;
            setCapstones(data?.data || data || []);
            setLastPage(data?.last_page || 1);
        } catch (err) {
            notify.error('Failed to load capstones.');
        } finally {
            setLoading(false);
        }
    }, [search, filters, page, notify]);

    const fetchSavedCapstones = useCallback(async () => {
        try {
            setSavedLoading(true);
            const res = await getStudentBookmarkedCapstones({ per_page: 100 });
            const data = res.data.data;
            setSavedCapstones(data?.data || data || []);
        } catch (err) {
            setSavedCapstones([]);
        } finally {
            setSavedLoading(false);
        }
    }, []);

    // ── Handlers ──────────────────────────────────────────────────────────────────
    const openSavedPanel = () => { setSavedOpen(true); fetchSavedCapstones(); };
    const openCapstoneModal = (cap) => { setSelectedCapstone(cap); setShowModal(true); };
    const openCapstoneViewer = (id) => navigate(`/student/capstones/${id}`);

    const handleSearch = (e) => { setSearch(e.target.value); setPage(1); };
    const handleFilterChange = (key, value) => { setFilters(prev => ({ ...prev, [key]: value })); setPage(1); };

    const handleAdviserSelect = (adviser) => {
        setFilters(prev => ({ ...prev, adviser_id: adviser ? adviser.id : '' }));
        setSelectedAdviserName(adviser ? adviser.name : '');
        setAdviserSearch('');
        setAdviserDropdownOpen(false);
        setPage(1);
    };

    const clearFilters = () => {
        setFilters({ year: '', program: '', category: '', adviser_id: '' });
        setSelectedAdviserName('');
        setAdviserSearch('');
        setSearch('');
        setPage(1);
    };

    const handleRemoveBookmark = (cap) => setConfirm({
        open: true, title: 'Remove from Saved',
        message: `Remove "${cap.title}" from saved folder?`,
        variant: 'danger',
        action: async () => {
            try { await toggleBookmark(cap.id); notify.success('Removed from saved folder.'); fetchSavedCapstones(); }
            catch { notify.error('Failed to remove bookmark.'); }
            setConfirm(p => ({ ...p, open: false }));
        },
    });

    // ── Pagination helpers ────────────────────────────────────────────────────────
    const Pagination = () => lastPage > 1 ? (
        <div className="flex items-center justify-center gap-2 pt-8">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="px-4 py-2 text-sm font-medium rounded-lg transition-colors bg-[#1B5E20] text-white hover:bg-green-800 disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed">Previous</button>
            <span className="text-sm font-medium text-gray-600">Page {page} of {lastPage}</span>
            <button onClick={() => setPage(p => Math.min(lastPage, p + 1))} disabled={page === lastPage}
                className="px-4 py-2 text-sm font-medium rounded-lg transition-colors bg-[#1B5E20] text-white hover:bg-green-800 disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed">Next</button>
        </div>
    ) : null;

    // ── Card View ─────────────────────────────────────────────────────────────────
    const CardView = () => (
        <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {capstones.map((cap) => (
                    <div key={cap.id} onClick={() => openCapstoneModal(cap)}
                        className="group bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex flex-col overflow-hidden cursor-pointer">
                        <div className="h-1.5 bg-gradient-to-r from-[#1B5E20] to-green-400 w-full" />
                        <div className="h-36 bg-gradient-to-br from-green-50 to-gray-50 flex items-center justify-center">
                            <HiOutlineDocumentText className="w-14 h-14 text-gray-300 group-hover:text-green-400 transition-colors" />
                        </div>
                        <div className="p-4 flex flex-col flex-1 gap-2">
                            <h3 className="text-sm font-semibold text-gray-800 line-clamp-2 leading-tight group-hover:text-[#1B5E20] transition-colors">{cap.title}</h3>
                            <p className="text-xs text-gray-500">{cap.author}</p>
                            <div className="flex flex-wrap gap-1.5 mt-auto">
                                {cap.program && (<span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-green-50 text-green-700 rounded-full border border-green-100"><HiOutlineAcademicCap className="w-3 h-3" />{cap.program}</span>)}
                                {cap.year && (<span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-blue-50 text-blue-700 rounded-full border border-blue-100"><HiOutlineCalendar className="w-3 h-3" />{cap.year}</span>)}
                                {cap.category && (<span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-purple-50 text-purple-700 rounded-full border border-purple-100"><HiOutlineTag className="w-3 h-3" />{cap.category}</span>)}
                            </div>
                            {cap.keywords?.length > 0 && (
                                <div className="flex flex-wrap gap-1 pt-1">
                                    {cap.keywords.slice(0, 3).map((kw, i) => (
                                        <span key={i} className="px-1.5 py-0.5 text-[10px] font-medium bg-gray-100 text-gray-500 rounded">{kw.name || kw}</span>
                                    ))}
                                    {cap.keywords.length > 3 && <span className="px-1.5 py-0.5 text-[10px] font-medium bg-gray-100 text-gray-500 rounded">+{cap.keywords.length - 3}</span>}
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
            <Pagination />
        </>
    );

    // ── Table View ────────────────────────────────────────────────────────────────
    const TableView = () => (
        <>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-gray-200 bg-gray-50">
                                <th className="py-3 px-4 text-left text-xs font-semibold text-gray-600 uppercase">Title</th>
                                <th className="py-3 px-4 text-left text-xs font-semibold text-gray-600 uppercase">Author</th>
                                <th className="py-3 px-4 text-left text-xs font-semibold text-gray-600 uppercase">Program</th>
                                <th className="py-3 px-4 text-left text-xs font-semibold text-gray-600 uppercase">Category</th>
                                <th className="py-3 px-4 text-left text-xs font-semibold text-gray-600 uppercase">Year</th>
                                <th className="py-3 px-4 text-center text-xs font-semibold text-gray-600 uppercase">View</th>
                            </tr>
                        </thead>
                        <tbody>
                            {capstones.map((cap, idx) => (
                                <tr key={cap.id} onClick={() => openCapstoneModal(cap)}
                                    className={`border-b border-gray-100 hover:bg-green-50 cursor-pointer transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                                    <td className="py-3 px-4 text-sm font-medium text-gray-900">{cap.title}</td>
                                    <td className="py-3 px-4 text-sm text-gray-600">{cap.author || '—'}</td>
                                    <td className="py-3 px-4 text-sm text-gray-600">{cap.program || '—'}</td>
                                    <td className="py-3 px-4 text-sm text-gray-600">
                                        {cap.category ? <span className="px-2 py-0.5 bg-purple-50 text-purple-700 rounded-full text-xs font-medium border border-purple-100">{cap.category}</span> : '—'}
                                    </td>
                                    <td className="py-3 px-4 text-sm text-gray-600">{cap.year || '—'}</td>
                                    <td className="py-3 px-4 text-center">
                                        <button onClick={e => { e.stopPropagation(); openCapstoneModal(cap); }}
                                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="View">
                                            <HiOutlineEye className="w-4 h-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
            <Pagination />
        </>
    );

    // ── Render ────────────────────────────────────────────────────────────────────
    return (
        <div className="h-full overflow-y-auto">

            {/* ── Title ── */}
            <div className="px-4 lg:px-8 pt-6 lg:pt-8 pb-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">Uploaded Capstones</h1>
                        <p className="text-sm text-gray-500 mt-2">Browse approved capstone projects.</p>
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
                        <button onClick={openSavedPanel}
                            className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors">
                            <HiOutlineBookmark className="w-4 h-4" />Saved Folder
                        </button>
                    </div>
                </div>
            </div>

            {/* ── Search & Filter Bar (sticky) ── */}
            <div className="sticky top-0 z-20 bg-white border-b border-gray-200 shadow-sm px-4 lg:px-8 py-3">
                <div className="flex flex-col sm:flex-row gap-3 items-end flex-wrap">
                    <div className="relative flex-1 min-w-[250px]">
                        <HiOutlineSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input type="text" value={search} onChange={handleSearch} placeholder="Search by title, author, keyword..."
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
                    <div className="flex flex-wrap gap-4 p-4 mt-3 bg-gray-50 rounded-lg border border-gray-200">
                        {/* Year */}
                        <div>
                            <label className="text-xs text-gray-600 font-semibold uppercase block mb-1">Year</label>
                            <select value={filters.year} onChange={e => handleFilterChange('year', e.target.value)}
                                className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none">
                                <option value="">All Years</option>
                                {years.map(y => <option key={y} value={y}>{y}</option>)}
                            </select>
                        </div>
                        {/* Program */}
                        <div>
                            <label className="text-xs text-gray-600 font-semibold uppercase block mb-1">Program</label>
                            <select value={filters.program} onChange={e => handleFilterChange('program', e.target.value)}
                                className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none">
                                <option value="">All Programs</option>
                                {programs.map(p => <option key={p} value={p}>{p}</option>)}
                            </select>
                        </div>
                        {/* Adviser (searchable — only shows advisers with published capstones) */}
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
                                                className={`w-full text-left px-3 py-2 text-sm hover:bg-green-50 transition-colors ${String(filters.adviser_id) === String(a.id) ? 'font-medium text-[#1B5E20] bg-green-50' : 'text-gray-700'}`}>
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
                            <select value={filters.category} onChange={e => handleFilterChange('category', e.target.value)}
                                className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none">
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

            {/* ── Content Area ── */}
            <div className="px-4 lg:px-8 py-6">
                {loading ? (
                    <Loading text="Loading capstones..." />
                ) : capstones.length === 0 ? (
                    <EmptyState
                        title="No capstones found"
                        description={search || Object.values(filters).some(Boolean) ? 'Try adjusting your search or filters.' : 'No approved capstones available yet.'}
                        icon={<HiOutlineDocumentText className="w-12 h-12" />}
                    />
                ) : displayMode === 'table' ? (
                    <TableView />
                ) : (
                    <CardView />
                )}
            </div>

            {/* ── Capstone modal ── */}
            {showModal && selectedCapstone && (
                <CapstoneModal capstone={selectedCapstone} open={true}
                    onClose={() => { setShowModal(false); setSelectedCapstone(null); }}
                    onViewFull={() => { setShowModal(false); openCapstoneViewer(selectedCapstone.id); }} />
            )}

            {/* ── Saved Folder slide-over ── */}
            {savedOpen && (
                <div className="fixed inset-0 z-50 flex justify-end">
                    <div className="absolute inset-0 bg-black/30" onClick={() => setSavedOpen(false)} />
                    <div className="relative w-full max-w-md bg-white shadow-xl flex flex-col animate-in slide-in-from-right">
                        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                            <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                                <HiOutlineBookmark className="w-4 h-4 text-amber-500" />Saved Capstones
                            </h2>
                            <button onClick={() => setSavedOpen(false)} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                                <HiOutlineX className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-3">
                            {savedLoading ? (
                                <Loading text="Loading saved..." />
                            ) : savedCapstones.length === 0 ? (
                                <div className="text-center py-12">
                                    <HiOutlineBookmark className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                                    <p className="text-sm text-gray-400">No saved capstones yet.</p>
                                </div>
                            ) : savedCapstones.map((cap) => (
                                <div key={cap.id} className="bg-white rounded-lg border border-gray-100 p-3 hover:border-amber-200 hover:shadow-sm transition-all">
                                    <h4 className="text-sm font-semibold text-gray-800 line-clamp-2 leading-tight">{cap.title}</h4>
                                    <p className="text-xs text-gray-500 mt-1">{cap.author}</p>
                                    <div className="flex items-center gap-2 mt-1.5">
                                        <span className="text-xs text-gray-400">{cap.year || '—'}</span>
                                        {cap.program && <span className="px-1.5 py-0.5 text-[10px] font-medium bg-green-50 text-green-600 rounded-full">{cap.program}</span>}
                                        <span className="ml-auto px-1.5 py-0.5 text-[10px] font-bold bg-amber-50 text-amber-600 rounded-full flex items-center gap-0.5">
                                            <HiOutlineBookmark className="w-2.5 h-2.5" />{cap.bookmarks_count ?? cap.bookmark_count ?? 0}
                                        </span>
                                    </div>
                                    {cap.keywords?.length > 0 && (
                                        <div className="flex flex-wrap gap-1 mt-2">
                                            {cap.keywords.slice(0, 3).map((kw, i) => (
                                                <span key={i} className="px-1.5 py-0.5 text-[10px] font-medium bg-gray-100 text-gray-500 rounded">{kw.name || kw}</span>
                                            ))}
                                        </div>
                                    )}
                                    <div className="flex gap-2 mt-2.5 pt-2 border-t border-gray-50">
                                        <button onClick={() => { openCapstoneModal(cap); setSavedOpen(false); }}
                                            className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1 text-xs font-medium text-blue-700 bg-blue-50 rounded hover:bg-blue-100 transition-colors">
                                            <HiOutlineEye className="w-3 h-3" />View
                                        </button>
                                        <button onClick={() => handleRemoveBookmark(cap)}
                                            className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1 text-xs font-medium text-red-700 bg-red-50 rounded hover:bg-red-100 transition-colors">
                                            <HiOutlineTrash className="w-3 h-3" />Remove
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            <ConfirmDialog open={confirm.open} title={confirm.title} message={confirm.message} variant={confirm.variant}
                onConfirm={confirm.action} onCancel={() => setConfirm(p => ({ ...p, open: false }))} />
        </div>
    );
}
