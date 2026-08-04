import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    HiOutlineSearch, HiOutlineFilter, HiOutlineDocumentText,
    HiOutlineBookmark, HiOutlineTrash, HiOutlineEye, HiOutlineX,
    HiArrowRight, HiDownload, HiShare, HiArrowLeft,
} from 'react-icons/hi';
import {
    getCapstones, getPublishedYears, getPublishedPrograms,
    toggleBookmark, getAdminBookmarkedCapstones,
} from '../../api/admin';
import { useNotification } from '../../components/Notification';
import Loading from '../../components/Loading';
import EmptyState from '../../components/EmptyState';
import ConfirmDialog from '../../components/ConfirmDialog';
import CapstoneModal from '../../components/admin/CapstoneModal';

export default function UploadedCapstones() {
    const navigate = useNavigate();
    const notify = useNotification();
    const [capstones, setCapstones] = useState([]);
    const [savedCapstones, setSavedCapstones] = useState([]);
    const [loading, setLoading] = useState(true);
    const [savedLoading, setSavedLoading] = useState(false);
    const [savedOpen, setSavedOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [filters, setFilters] = useState({ year: '', program: '', category: '' });
    const [years, setYears] = useState([]);
    const [programs, setPrograms] = useState([]);
    const [categories, setCategories] = useState([]);
    const [showFilters, setShowFilters] = useState(false);
    const [page, setPage] = useState(1);
    const [lastPage, setLastPage] = useState(1);
    const [confirm, setConfirm] = useState({ open: false, title: '', message: '', action: null, variant: 'danger' });
    
    // Modal state
    const [selectedCapstone, setSelectedCapstone] = useState(null);
    const [showModal, setShowModal] = useState(false);

    useEffect(() => {
        loadFilters();
    }, []);

    useEffect(() => {
        fetchCapstones();
    }, [search, filters, page]);

    const loadFilters = async () => {
        try {
            const [yRes, pRes] = await Promise.all([getPublishedYears(), getPublishedPrograms()]);
            setYears(yRes.data.data || []);
            setPrograms(pRes.data.data || []);
            
            // Load categories from all capstones
            const cRes = await getCapstones({ per_page: 500 });
            const capsData = cRes.data.data;
            const allCapstones = capsData?.data || [];
            const uniqueCategories = [...new Set(allCapstones.map(c => c.category).filter(Boolean))].sort();
            setCategories(uniqueCategories);
        } catch (err) {
            console.error(err);
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

            const res = await getCapstones(params);
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
            const res = await getAdminBookmarkedCapstones({ per_page: 100 });
            const data = res.data.data;
            setSavedCapstones(data?.data || data || []);
        } catch (err) {
            console.error('Failed to load bookmarked capstones:', err);
            setSavedCapstones([]);
        } finally {
            setSavedLoading(false);
        }
    }, []);

    const openSavedPanel = () => {
        setSavedOpen(true);
        fetchSavedCapstones();
    };

    const handleRemoveBookmark = (cap) => {
        setConfirm({
            open: true,
            title: 'Remove from Saved',
            message: `Remove "${cap.title}" from saved folder?`,
            variant: 'danger',
            action: async () => {
                try {
                    await toggleBookmark(cap.id);
                    notify.success('Removed from saved.');
                    fetchSavedCapstones();
                } catch (err) {
                    notify.error('Failed to remove bookmark.');
                }
                setConfirm(prev => ({ ...prev, open: false }));
            },
        });
    };

    const handleSearch = (e) => {
        setSearch(e.target.value);
        setPage(1);
    };

    const handleFilterChange = (key, value) => {
        setFilters(prev => ({ ...prev, [key]: value }));
        setPage(1);
    };

    const clearFilters = () => {
        setFilters({ year: '', program: '' });
        setSearch('');
        setPage(1);
    };

    const openCapstoneModal = (cap) => {
        setSelectedCapstone(cap);
        setShowModal(true);
    };

    const openCapstoneViewer = (capId) => {
        navigate(`/admin/capstones/${capId}`);
    };

    const closeViewer = () => {
        // Not needed anymore since we're navigating
    };

    return (
        <div className="h-full overflow-y-auto">
            {/* ── Title (scrolls with page) ── */}
            <div className="px-4 lg:px-8 pt-6 lg:pt-8 pb-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">Uploaded Capstones</h1>
                        <p className="text-sm text-gray-500 mt-2">Browse all uploaded capstone projects</p>
                    </div>
                    <button
                        onClick={openSavedPanel}
                        className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors"
                    >
                        <HiOutlineBookmark className="w-4 h-4" />
                        Saved Folder
                    </button>
                </div>
            </div>

            {/* ── Search & Filter Bar (sticky) ── */}
            <div className="sticky top-0 z-20 bg-white border-b border-gray-200 shadow-sm px-4 lg:px-8 py-3">
                <div className="flex flex-col sm:flex-row gap-3 items-end flex-wrap">
                    <div className="relative flex-1 min-w-[250px]">
                        <HiOutlineSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            value={search}
                            onChange={handleSearch}
                            placeholder="Search by title, author, keyword..."
                            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 bg-white focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                        />
                    </div>
                    <div>
                        <label className="text-xs text-gray-600 font-semibold uppercase block mb-1">Category</label>
                        <select
                            value={filters.category}
                            onChange={(e) => handleFilterChange('category', e.target.value)}
                            className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                        >
                            <option value="">All Categories</option>
                            {categories.map((c) => (
                                <option key={c} value={c}>{c}</option>
                            ))}
                        </select>
                    </div>
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg border transition-colors
                            ${showFilters ? 'bg-green-50 text-green-700 border-green-200' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
                    >
                        <HiOutlineFilter className="w-4 h-4" />
                        Filters
                    </button>
                </div>

                {/* Filter Dropdowns */}
                {showFilters && (
                    <div className="flex flex-wrap gap-3 p-4 mt-3 bg-gray-50 rounded-lg border border-gray-200">
                        <select
                            value={filters.year}
                            onChange={(e) => handleFilterChange('year', e.target.value)}
                            className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                        >
                            <option value="">All Years</option>
                            {years.map((y) => (
                                <option key={y} value={y}>{y}</option>
                            ))}
                        </select>
                        <select
                            value={filters.program}
                            onChange={(e) => handleFilterChange('program', e.target.value)}
                            className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                        >
                            <option value="">All Programs</option>
                            {programs.map((p) => (
                                <option key={p} value={p}>{p}</option>
                            ))}
                        </select>
                        <button onClick={clearFilters} className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 underline">
                            Clear All
                        </button>
                    </div>
                )}
            </div>

            {/* ── Content Area ── */}
            <div className="px-4 lg:px-8 py-6">
                {/* Published Cards */}
                {loading ? (
                    <Loading text="Loading published capstones..." />
                ) : capstones.length === 0 ? (
                    <EmptyState
                        title="No uploaded capstones"
                        description={search || filters.year || filters.program ? 'Try adjusting your search or filters.' : 'Upload capstones to get started.'}
                        icon={<HiOutlineDocumentText className="w-12 h-12" />}
                    />
                ) : (
                    <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {capstones.map((cap) => (
                                <div
                                    key={cap.id}
                                    onClick={() => openCapstoneModal(cap)}
                                    className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden cursor-pointer hover:shadow-md hover:border-green-200 transition-all group"
                                >
                                    <div className="h-40 bg-gradient-to-br from-green-50 to-gray-50 flex items-center justify-center">
                                        <HiOutlineDocumentText className="w-16 h-16 text-gray-300 group-hover:text-green-400 transition-colors" />
                                    </div>
                                    <div className="p-4 space-y-2">
                                        <h3 className="text-sm font-semibold text-gray-800 line-clamp-2 leading-tight">{cap.title}</h3>
                                        <p className="text-xs text-gray-500">{cap.author}</p>
                                        <div className="flex flex-wrap items-center justify-between gap-1">
                                            <span className="text-xs text-gray-400">{cap.year || '—'}</span>
                                            {cap.program && (
                                                <span className="px-2 py-0.5 text-xs font-medium bg-green-50 text-green-600 rounded-full">{cap.program}</span>
                                            )}
                                        </div>
                                        {cap.category && (
                                            <div className="px-2 py-1 text-xs font-medium bg-blue-50 text-blue-600 rounded w-fit">
                                                {cap.category}
                                            </div>
                                        )}
                                        {cap.keywords?.length > 0 && (
                                            <div className="flex flex-wrap gap-1 pt-1">
                                                {cap.keywords.slice(0, 3).map((kw, i) => (
                                                    <span key={i} className="px-1.5 py-0.5 text-[10px] font-medium bg-gray-100 text-gray-500 rounded">
                                                        {kw.name || kw}
                                                    </span>
                                                ))}
                                                {cap.keywords.length > 3 && (
                                                    <span className="px-1.5 py-0.5 text-[10px] font-medium bg-gray-100 text-gray-500 rounded">
                                                        +{cap.keywords.length - 3}
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Pagination */}
                        {lastPage > 1 && (
                            <div className="flex items-center justify-center gap-2 pt-8">
                                <button
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    disabled={page === 1}
                                    className="px-4 py-2 text-sm font-medium rounded-lg transition-colors bg-[#1B5E20] text-white hover:bg-green-800 disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed"
                                >
                                    Previous
                                </button>
                                <span className="text-sm font-medium text-gray-600">Page {page} of {lastPage}</span>
                                <button
                                    onClick={() => setPage(p => Math.min(lastPage, p + 1))}
                                    disabled={page === lastPage}
                                    className="px-4 py-2 text-sm font-medium rounded-lg transition-colors bg-[#1B5E20] text-white hover:bg-green-800 disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed"
                                >
                                    Next
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* ──── CAPSTONE MODAL ──── */}
            {showModal && selectedCapstone && (
                <CapstoneModal
                    capstone={selectedCapstone}
                    open={true}
                    onClose={() => { setShowModal(false); setSelectedCapstone(null); }}
                    onViewFull={() => openCapstoneViewer(selectedCapstone.id)}
                />
            )}

            {/* ──── SAVED SLIDE-OVER PANEL ──── */}
            {savedOpen && (
                <div className="fixed inset-0 z-50 flex justify-end">
                    {/* Backdrop */}
                    <div className="absolute inset-0 bg-black/30" onClick={() => setSavedOpen(false)} />
                    {/* Panel */}
                    <div className="relative w-full max-w-md bg-white shadow-xl flex flex-col animate-in slide-in-from-right">
                        {/* Panel Header */}
                        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                            <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                                <HiOutlineBookmark className="w-4 h-4 text-amber-500" />
                                Saved Capstones
                            </h2>
                            <button
                                onClick={() => setSavedOpen(false)}
                                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                <HiOutlineX className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Panel Body */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-3">
                            {savedLoading ? (
                                <Loading text="Loading saved..." />
                            ) : savedCapstones.length === 0 ? (
                                <div className="text-center py-12">
                                    <HiOutlineBookmark className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                                    <p className="text-sm text-gray-400">No saved capstones yet.</p>
                                </div>
                            ) : (
                                savedCapstones.map((cap) => (
                                    <div
                                        key={cap.id}
                                        className="bg-white rounded-lg border border-gray-100 p-3 hover:border-amber-200 hover:shadow-sm transition-all"
                                    >
                                        <h4 className="text-sm font-semibold text-gray-800 line-clamp-2 leading-tight">{cap.title}</h4>
                                        <p className="text-xs text-gray-500 mt-1">{cap.author}</p>
                                        <div className="flex items-center gap-2 mt-1.5">
                                            <span className="text-xs text-gray-400">{cap.year || '—'}</span>
                                            {cap.program && (
                                                <span className="px-1.5 py-0.5 text-[10px] font-medium bg-green-50 text-green-600 rounded-full">{cap.program}</span>
                                            )}
                                            <span className="ml-auto px-1.5 py-0.5 text-[10px] font-bold bg-amber-50 text-amber-600 rounded-full flex items-center gap-0.5">
                                                <HiOutlineBookmark className="w-2.5 h-2.5" />
                                                {cap.bookmarks_count ?? cap.bookmark_count ?? 0}
                                            </span>
                                        </div>
                                        {cap.keywords?.length > 0 && (
                                            <div className="flex flex-wrap gap-1 mt-2">
                                                {cap.keywords.slice(0, 3).map((kw, i) => (
                                                    <span key={i} className="px-1.5 py-0.5 text-[10px] font-medium bg-gray-100 text-gray-500 rounded">
                                                        {kw.name || kw}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                        <div className="flex gap-2 mt-2.5 pt-2 border-t border-gray-50">
                                            <button
                                                onClick={() => { openCapstoneModal(cap); setSavedOpen(false); }}
                                                className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1 text-xs font-medium text-blue-700 bg-blue-50 rounded hover:bg-blue-100 transition-colors"
                                            >
                                                <HiOutlineEye className="w-3 h-3" />
                                                View
                                            </button>
                                            <button
                                                onClick={() => handleRemoveBookmark(cap)}
                                                className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1 text-xs font-medium text-red-700 bg-red-50 rounded hover:bg-red-100 transition-colors"
                                            >
                                                <HiOutlineTrash className="w-3 h-3" />
                                                Remove
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}

            <ConfirmDialog
                open={confirm.open}
                title={confirm.title}
                message={confirm.message}
                variant={confirm.variant}
                onConfirm={confirm.action}
                onCancel={() => setConfirm(prev => ({ ...prev, open: false }))}
            />
        </div>
    );
}

// ────── END OF FILE ──────
