import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { HiOutlineSearch, HiOutlineFilter, HiOutlineBookmark, HiBookmark, HiOutlineDownload, HiOutlineEye } from 'react-icons/hi';
import { getPublishedCapstones, getPublishedYears, getPublishedPrograms, getPublishedCategories, toggleBookmark } from '../../api/admin';
import { useNotification } from '../../components/Notification';
import Loading from '../../components/Loading';
import EmptyState from '../../components/EmptyState';

export default function StudentBrowseCapstones() {
    const navigate = useNavigate();
    const notify = useNotification();
    const [capstones, setCapstones] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [filters, setFilters] = useState({ year: '', program: '', category: '' });
    const [showFilters, setShowFilters] = useState(false);
    const [page, setPage] = useState(1);
    const [lastPage, setLastPage] = useState(1);
    const [years, setYears] = useState([]);
    const [programs, setPrograms] = useState([]);
    const [categories, setCategories] = useState([]);
    const searchTimer = useRef(null);

    useEffect(() => {
        clearTimeout(searchTimer.current);
        searchTimer.current = setTimeout(() => setDebouncedSearch(search), 350);
        return () => clearTimeout(searchTimer.current);
    }, [search]);

    useEffect(() => {
        loadFilterOptions();
    }, []);

    useEffect(() => {
        fetchCapstones();
    }, [debouncedSearch, filters, page]);

    const loadFilterOptions = async () => {
        try {
            const [yRes, pRes, cRes] = await Promise.all([
                getPublishedYears(),
                getPublishedPrograms(),
                getPublishedCategories(),
            ]);
            setYears(yRes.data.data || []);
            setPrograms(pRes.data.data || []);
            setCategories(cRes.data.data || []);
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
            const res = await getPublishedCapstones(params);
            const data = res.data.data;
            setCapstones(data?.data || []);
            setLastPage(data?.last_page || 1);
        } catch (err) {
            notify.error('Failed to load capstones.');
        } finally {
            setLoading(false);
        }
    }, [debouncedSearch, filters, page]);

    const handleFilterChange = (key, value) => {
        setFilters(prev => ({ ...prev, [key]: value }));
        setPage(1);
    };

    const clearFilters = () => {
        setFilters({ year: '', program: '', category: '' });
        setPage(1);
    };

    const handleBookmarkToggle = async (capstoneId) => {
        try {
            const res = await toggleBookmark(capstoneId);
            const isBookmarked = res.data.data.bookmarked;
            setCapstones(prev => prev.map(c =>
                c.id === capstoneId
                    ? { ...c, is_bookmarked: isBookmarked, bookmark_count: res.data.data.bookmark_count }
                    : c
            ));
            notify.success(isBookmarked ? 'Saved!' : 'Removed from saved.');
        } catch {
            notify.error('Bookmark action failed.');
        }
    };

    return (
        <div className="space-y-5">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Browse Capstones</h1>
                <p className="text-sm text-gray-500 mt-1">Explore published capstone projects</p>
            </div>

            {/* Search & Category Filter */}
            <div className="flex flex-col sm:flex-row gap-3 items-end flex-wrap">
                <div className="relative flex-1 min-w-[250px]">
                    <HiOutlineSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search by title, author, or keyword..."
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
                        {categories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>
                <button
                    onClick={() => setShowFilters(!showFilters)}
                    className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg border transition-colors
                        ${showFilters ? 'bg-green-50 text-green-700 border-green-200' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
                >
                    <HiOutlineFilter className="w-4 h-4" /> Filters
                </button>
            </div>

            {/* Extra Filters */}
            {showFilters && (
                <div className="flex flex-wrap gap-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <select value={filters.year} onChange={(e) => handleFilterChange('year', e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none">
                        <option value="">All Years</option>
                        {years.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                    <select value={filters.program} onChange={(e) => handleFilterChange('program', e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none">
                        <option value="">All Programs</option>
                        {programs.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                    <button onClick={clearFilters} className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 underline">
                        Clear All
                    </button>
                </div>
            )}

            {/* Results */}
            {loading ? (
                <Loading text="Loading capstones..." />
            ) : capstones.length === 0 ? (
                <EmptyState
                    title="No capstones found"
                    description={debouncedSearch || filters.year || filters.program || filters.category ? 'Try adjusting your search or filters.' : 'Published capstones will appear here.'}
                />
            ) : (
                <div className="space-y-3">
                    {capstones.map(capstone => (
                        <div key={capstone.id}
                            className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow cursor-pointer"
                            onClick={() => navigate(`/student/capstones/${capstone.id}`)}
                        >
                            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                    <h3 className="text-base font-semibold text-gray-900 leading-snug">{capstone.title}</h3>
                                    <p className="text-sm text-gray-500 mt-1">By {capstone.author || '—'}</p>
                                    {capstone.abstract && (
                                        <p className="text-sm text-gray-600 mt-2 line-clamp-2">{capstone.abstract}</p>
                                    )}
                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 text-xs text-gray-500">
                                        {capstone.year && <span>Year: {capstone.year}</span>}
                                        {capstone.program && <span>{capstone.program}</span>}
                                        {capstone.category && (
                                            <span className="px-2 py-0.5 bg-green-50 text-green-700 rounded-full border border-green-200 font-medium">{capstone.category}</span>
                                        )}
                                        <span className="flex items-center gap-1"><HiOutlineEye className="w-3.5 h-3.5" /> {capstone.view_count || 0}</span>
                                        <span className="flex items-center gap-1"><HiOutlineDownload className="w-3.5 h-3.5" /> {capstone.download_count || 0}</span>
                                    </div>
                                    {capstone.keywords?.length > 0 && (
                                        <div className="flex flex-wrap gap-1 mt-2">
                                            {capstone.keywords.slice(0, 5).map((kw, i) => (
                                                <span key={i} className="px-2 py-0.5 text-[10px] font-medium bg-gray-100 text-gray-600 rounded-full">
                                                    {kw.name || kw}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleBookmarkToggle(capstone.id); }}
                                    className={`shrink-0 p-2 rounded-lg transition-colors ${
                                        capstone.is_bookmarked
                                            ? 'bg-amber-50 text-amber-600 border border-amber-200'
                                            : 'bg-gray-50 text-gray-400 hover:text-green-600 hover:bg-green-50 border border-gray-200'
                                    }`}
                                    title={capstone.is_bookmarked ? 'Remove from saved' : 'Save'}
                                >
                                    {capstone.is_bookmarked ? <HiBookmark className="w-5 h-5" /> : <HiOutlineBookmark className="w-5 h-5" />}
                                </button>
                            </div>
                        </div>
                    ))}

                    {/* Pagination */}
                    {lastPage > 1 && (
                        <div className="flex justify-center gap-2 pt-4">
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className="px-4 py-2 text-sm font-medium rounded-lg border transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                style={{ backgroundColor: '#1B5E20', color: '#fff', borderColor: '#1B5E20' }}
                            >
                                Previous
                            </button>
                            <span className="px-4 py-2 text-sm text-gray-600">
                                Page {page} of {lastPage}
                            </span>
                            <button
                                onClick={() => setPage(p => Math.min(lastPage, p + 1))}
                                disabled={page === lastPage}
                                className="px-4 py-2 text-sm font-medium rounded-lg border transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                style={{ backgroundColor: '#1B5E20', color: '#fff', borderColor: '#1B5E20' }}
                            >
                                Next
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
