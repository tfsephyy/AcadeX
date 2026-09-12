import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    HiOutlineSearch, HiOutlineFilter, HiOutlineDocumentText,
    HiOutlineEye, HiOutlineViewGrid, HiOutlineViewList,
    HiOutlineCalendar, HiOutlineAcademicCap, HiOutlineX,
    HiOutlineBookmark, HiOutlineUser, HiBookmark, HiLockClosed,
    HiOutlineTag,
} from 'react-icons/hi';
import {
    getVisitorCapstones, getVisitorYears, getVisitorPrograms,
    getVisitorCategories, getVisitorAdvisers,
    toggleVisitorBookmark, getVisitorBookmarks,
} from '../../api/visitor';
import Loading from '../../components/Loading';
import EmptyState from '../../components/EmptyState';
import SearchWithSuggestions from '../../components/SearchWithSuggestions';

export default function VisitorCapstones() {
    const navigate = useNavigate();

    const [capstones, setCapstones]     = useState([]);
    const [loading, setLoading]         = useState(true);
    const [displayMode, setDisplayMode] = useState('card');
    const [showFilters, setShowFilters] = useState(false);
    const [savedOpen, setSavedOpen]     = useState(false);

    const [search, setSearch]   = useState('');
    const [filters, setFilters] = useState({ year: '', program: '', category: '', adviser_id: '' });
    const [selectedCategory, setSelectedCategory] = useState('');

    const [years, setYears]         = useState([]);
    const [programs, setPrograms]   = useState([]);
    const [categories, setCategories] = useState([]);
    const [advisers, setAdvisers]   = useState([]);

    const [page, setPage]         = useState(1);
    const [lastPage, setLastPage] = useState(1);

    // Bookmarks
    const [bookmarks, setBookmarks]   = useState([]);
    const [savedIds, setSavedIds]     = useState(new Set());
    const [savedLoading, setSavedLoading] = useState(false);

    const activeFilterCount = Object.values(filters).filter(Boolean).length;

    // ── Load filter options ────────────────────────────────
    useEffect(() => {
        Promise.all([
            getVisitorYears(), getVisitorPrograms(),
            getVisitorCategories(), getVisitorAdvisers(),
        ]).then(([y, p, c, a]) => {
            setYears(y.data.data || []);
            setPrograms(p.data.data || []);
            setCategories(c.data.data || []);
            setAdvisers(a.data.data || []);
        }).catch(console.error);
    }, []);

    // ── Fetch capstones ────────────────────────────────────
    const fetchCapstones = useCallback(async () => {
        try {
            setLoading(true);
            const params = { page, per_page: 12 };
            if (search)              params.search     = search;
            if (filters.year)        params.year       = filters.year;
            if (filters.program)     params.program    = filters.program;
            if (filters.category)    params.category   = filters.category;
            if (filters.adviser_id)  params.adviser_id = filters.adviser_id;
            const res  = await getVisitorCapstones(params);
            const data = res.data.data;
            setCapstones(data?.data || data || []);
            setLastPage(data?.last_page || 1);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [search, filters, page]);

    useEffect(() => { fetchCapstones(); }, [fetchCapstones]);

    // ── Fetch bookmarks ────────────────────────────────────
    const fetchBookmarks = async () => {
        try {
            setSavedLoading(true);
            const res = await getVisitorBookmarks();
            const data = res.data.data || [];
            setBookmarks(data);
            setSavedIds(new Set(data.map(b => b.id)));
        } catch (err) {
            console.error(err);
        } finally {
            setSavedLoading(false);
        }
    };

    useEffect(() => { fetchBookmarks(); }, []);

    // ── Handlers ───────────────────────────────────────────
    const handleSearch       = (val) => { setSearch(val); setPage(1); };
    const handleFilterChange = (key, val) => { setFilters(p => ({ ...p, [key]: val })); setPage(1); };
    const clearFilters       = () => { setSearch(''); setFilters({ year: '', program: '', category: '', adviser_id: '' }); setSelectedCategory(''); setPage(1); };

    const handleCategoryTab = (cat) => {
        const val = cat === selectedCategory ? '' : cat;
        setSelectedCategory(val);
        setFilters(p => ({ ...p, category: val }));
        setPage(1);
    };

    const handleToggleBookmark = async (e, capId) => {
        e.stopPropagation();
        try {
            await toggleVisitorBookmark(capId);
            setSavedIds(prev => {
                const next = new Set(prev);
                if (next.has(capId)) { next.delete(capId); } else { next.add(capId); }
                return next;
            });
            fetchBookmarks();
        } catch (err) {
            console.error(err);
        }
    };

    // ── Access badge ───────────────────────────────────────
    const AccessBadge = ({ cap }) => {
        if (cap.visitor_imrad_only) {
            return (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full bg-cyan-50 text-cyan-700 border border-cyan-200">
                    IMRAD Only
                </span>
            );
        }
        if (cap.is_published) return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full bg-green-50 text-green-700 border border-green-200">Published</span>
        );
        if (cap.copyright_status === 'copyrighted') return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full bg-purple-50 text-purple-700 border border-purple-200">Copyrighted</span>
        );
        return null;
    };

    // ── Pagination ─────────────────────────────────────────
    const Pagination = () => lastPage > 1 ? (
        <div className="flex items-center justify-center gap-2 pt-8">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-[#1B5E20] text-white hover:bg-green-800 disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed transition-colors">
                Previous
            </button>
            <span className="text-sm font-medium" style={{ color: 'var(--color-text-muted)' }}>Page {page} of {lastPage}</span>
            <button onClick={() => setPage(p => Math.min(lastPage, p + 1))} disabled={page === lastPage}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-[#1B5E20] text-white hover:bg-green-800 disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed transition-colors">
                Next
            </button>
        </div>
    ) : null;

    // ── Card View ──────────────────────────────────────────
    const CardView = () => (
        <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {capstones.map((cap) => (
                    <div key={cap.id}
                        onClick={() => navigate(`/visitor/capstones/${cap.id}`)}
                        className="group bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex flex-col overflow-hidden cursor-pointer">
                        {/* Green gradient top bar */}
                        <div className="h-1.5 bg-gradient-to-r from-[#1B5E20] to-green-400 w-full" />
                        {/* Icon area */}
                        <div className="h-36 bg-gradient-to-br from-green-50 to-gray-50 flex items-center justify-center relative">
                            <HiOutlineDocumentText className="w-14 h-14 text-gray-300 group-hover:text-green-400 transition-colors" />
                            {/* Bookmark button */}
                            <button
                                onClick={(e) => handleToggleBookmark(e, cap.id)}
                                className="absolute top-2 right-2 p-1.5 rounded-full bg-white/80 hover:bg-white shadow-sm transition-colors"
                                title={savedIds.has(cap.id) ? 'Remove from Saved' : 'Save'}
                            >
                                {savedIds.has(cap.id)
                                    ? <HiBookmark className="w-4 h-4 text-amber-500" />
                                    : <HiOutlineBookmark className="w-4 h-4 text-gray-400 hover:text-amber-500" />
                                }
                            </button>
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

    // ── Table View ─────────────────────────────────────────
    const TableView = () => (
        <>
            <div className="rounded-xl shadow-sm border overflow-hidden"
                style={{ background: 'var(--color-bg-secondary)', borderColor: 'var(--color-border)' }}>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b" style={{ background: 'var(--color-bg-tertiary)', borderColor: 'var(--color-border)' }}>
                                {['Title','Author','Programme','Year','Access',''].map(h => (
                                    <th key={h} className="py-3 px-4 text-left text-xs font-semibold uppercase" style={{ color: 'var(--color-text-muted)' }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {capstones.map((cap, idx) => (
                                <tr key={cap.id} onClick={() => navigate(`/visitor/capstones/${cap.id}`)}
                                    className="border-b cursor-pointer transition-colors hover:bg-green-50/30"
                                    style={{ background: idx % 2 === 0 ? 'transparent' : 'var(--color-bg-tertiary)', borderColor: 'var(--color-border)' }}>
                                    <td className="py-3 px-4 text-sm font-medium max-w-xs truncate" style={{ color: 'var(--color-text)' }}>{cap.title}</td>
                                    <td className="py-3 px-4 text-sm" style={{ color: 'var(--color-text-muted)' }}>{cap.author || '—'}</td>
                                    <td className="py-3 px-4 text-sm" style={{ color: 'var(--color-text-muted)' }}>{cap.program || '—'}</td>
                                    <td className="py-3 px-4 text-sm" style={{ color: 'var(--color-text-muted)' }}>{cap.year || '—'}</td>
                                    <td className="py-3 px-4"><AccessBadge cap={cap} /></td>
                                    <td className="py-3 px-4 flex items-center gap-2">
                                        <button onClick={(e) => { e.stopPropagation(); navigate(`/visitor/capstones/${cap.id}`); }} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg">
                                            <HiOutlineEye className="w-4 h-4" />
                                        </button>
                                        <button onClick={(e) => handleToggleBookmark(e, cap.id)} className="p-1.5 hover:bg-amber-50 rounded-lg">
                                            {savedIds.has(cap.id)
                                                ? <HiBookmark className="w-4 h-4 text-amber-500" />
                                                : <HiOutlineBookmark className="w-4 h-4 text-gray-400" />
                                            }
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

    // ── Render ─────────────────────────────────────────────
    return (
        <div className="h-full overflow-y-auto">
            {/* Saved Folder Side Panel */}
            {savedOpen && (
                <div className="fixed inset-0 z-50 flex">
                    <div className="flex-1 bg-black/40" onClick={() => setSavedOpen(false)} />
                    <div className="w-full max-w-md flex flex-col shadow-2xl"
                        style={{ background: 'var(--color-bg-secondary)', borderLeft: '1px solid var(--color-border)' }}>
                        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
                            <h2 className="font-bold text-lg flex items-center gap-2" style={{ color: 'var(--color-text)' }}>
                                <HiBookmark className="w-5 h-5 text-amber-500" /> Saved Capstones
                            </h2>
                            <button onClick={() => setSavedOpen(false)} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                                <HiOutlineX className="w-5 h-5" style={{ color: 'var(--color-text-muted)' }} />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-3">
                            {savedLoading ? (
                                <Loading text="Loading saved..." />
                            ) : bookmarks.length === 0 ? (
                                <div className="text-center py-16">
                                    <HiOutlineBookmark className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                                    <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>No saved capstones yet.</p>
                                    <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>Click the bookmark icon on any capstone.</p>
                                </div>
                            ) : bookmarks.map((b) => (
                                <div key={b.id}
                                    className="flex items-start gap-3 p-3 rounded-xl border cursor-pointer hover:shadow-sm transition-all"
                                    style={{ background: 'var(--color-bg-tertiary)', borderColor: 'var(--color-border)' }}
                                    onClick={() => { setSavedOpen(false); navigate(`/visitor/capstones/${b.id}`); }}>
                                    <HiOutlineDocumentText className="w-8 h-8 text-green-400 flex-shrink-0 mt-0.5" />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold line-clamp-2" style={{ color: 'var(--color-text)' }}>{b.title}</p>
                                        <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--color-text-muted)' }}>{b.author || '—'}</p>
                                        <div className="flex gap-1.5 mt-1.5 flex-wrap">
                                            {b.program && <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-50 text-green-700">{b.program}</span>}
                                            {b.year && <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">{b.year}</span>}
                                        </div>
                                    </div>
                                    <button onClick={(e) => { e.stopPropagation(); handleToggleBookmark(e, b.id); }}
                                        className="p-1 rounded-lg hover:bg-amber-50 flex-shrink-0">
                                        <HiBookmark className="w-4 h-4 text-amber-500" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Title */}
            <div className="px-4 lg:px-8 pt-6 lg:pt-8 pb-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                        <h1 className="text-3xl font-bold" style={{ color: 'var(--color-text)' }}>Uploaded Capstones</h1>
                        <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>Browse published and available capstone projects</p>
                    </div>
                    <div className="flex items-center gap-2">
                        {/* Saved button */}
                        <button onClick={() => setSavedOpen(true)}
                            className="relative inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border transition-colors"
                            style={{ background: 'var(--color-bg-secondary)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}>
                            <HiOutlineBookmark className="w-4 h-4" />
                            Saved
                            {savedIds.size > 0 && (
                                <span className="absolute -top-1.5 -right-1.5 flex items-center justify-center w-4 h-4 text-[10px] font-bold text-white bg-amber-500 rounded-full">{savedIds.size}</span>
                            )}
                        </button>
                        {/* Card/Table toggle */}
                        <div className="flex items-center rounded-lg p-1 border" style={{ background: 'var(--color-bg-tertiary)', borderColor: 'var(--color-border)' }}>
                            <button onClick={() => setDisplayMode('card')} title="Card View"
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${displayMode === 'card' ? 'bg-[#1B5E20] text-white shadow-sm' : ''}`}
                                style={displayMode !== 'card' ? { color: 'var(--color-text-muted)' } : {}}>
                                <HiOutlineViewGrid className="w-4 h-4" /><span className="hidden sm:inline">Cards</span>
                            </button>
                            <button onClick={() => setDisplayMode('table')} title="Table View"
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${displayMode === 'table' ? 'bg-[#1B5E20] text-white shadow-sm' : ''}`}
                                style={displayMode !== 'table' ? { color: 'var(--color-text-muted)' } : {}}>
                                <HiOutlineViewList className="w-4 h-4" /><span className="hidden sm:inline">Table</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Search & Filter Bar */}
            <div className="sticky top-0 z-20 border-b shadow-sm px-4 lg:px-8 py-3"
                style={{ background: 'var(--color-bg-secondary)', borderColor: 'var(--color-border)' }}>
                <div className="flex flex-col sm:flex-row gap-3 items-end flex-wrap">
                    <SearchWithSuggestions
                        id="visitor-capstone-search"
                        value={search}
                        onChange={handleSearch}
                        placeholder="Search by title, author, keyword…"
                        className="flex-1 min-w-[250px]"
                    />
                    <button onClick={() => setShowFilters(!showFilters)}
                        className={`relative inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg border transition-colors ${showFilters ? 'bg-green-50 text-green-700 border-green-200' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}>
                        <HiOutlineFilter className="w-4 h-4" />
                        Filters
                        {activeFilterCount > 0 && (
                            <span className="absolute -top-1.5 -right-1.5 flex items-center justify-center w-4 h-4 text-[10px] font-bold text-white bg-[#1B5E20] rounded-full">{activeFilterCount}</span>
                        )}
                    </button>
                </div>

                {showFilters && (
                    <div className="flex flex-wrap gap-4 p-4 mt-3 rounded-lg border"
                        style={{ background: 'var(--color-bg-tertiary)', borderColor: 'var(--color-border)' }}>
                        {[
                            { label: 'Year', key: 'year', options: years.map(y => ({ v: y, l: y })) },
                            { label: 'Program', key: 'program', options: programs.map(p => ({ v: p, l: p })) },
                            { label: 'Adviser', key: 'adviser_id', options: advisers.map(a => ({ v: a.id, l: a.name })) },
                        ].map(({ label, key, options }) => (
                            <div key={key}>
                                <label className="text-xs font-semibold uppercase block mb-1" style={{ color: 'var(--color-text-muted)' }}>{label}</label>
                                <select value={filters[key]} onChange={(e) => handleFilterChange(key, e.target.value)}
                                    className="px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-green-500"
                                    style={{ background: 'var(--color-bg-secondary)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}>
                                    <option value="">All {label}s</option>
                                    {options.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                                </select>
                            </div>
                        ))}
                        <div className="flex items-end">
                            <button onClick={clearFilters} className="px-3 py-2 text-sm underline" style={{ color: 'var(--color-text-muted)' }}>Clear All</button>
                        </div>
                    </div>
                )}
            </div>

            {/* Content area with category sidebar */}
            <div className="flex gap-0">
                {/* Category sidebar */}
                <aside className="hidden lg:flex flex-col w-52 flex-shrink-0 sticky top-[57px] self-start max-h-[calc(100vh-8rem)] overflow-y-auto border-r px-3 py-5"
                    style={{ background: 'var(--color-bg-secondary)', borderColor: 'var(--color-border)' }}>
                    <p className="text-xs font-semibold uppercase tracking-wider mb-3 px-2" style={{ color: 'var(--color-text-muted)' }}>Category</p>
                    <button onClick={() => handleCategoryTab('')}
                        className={`w-full text-left flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium mb-1 transition-colors border-l-2 ${selectedCategory === '' ? 'border-[#1B5E20] bg-green-50 text-[#1B5E20]' : 'border-transparent hover:bg-gray-50'}`}
                        style={selectedCategory !== '' ? { color: 'var(--color-text-muted)' } : {}}>
                        <span>All Categories</span>
                    </button>
                    {categories.map((cat) => (
                        <button key={cat.name} onClick={() => handleCategoryTab(cat.name)}
                            className={`w-full text-left flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium mb-1 transition-colors border-l-2 ${selectedCategory === cat.name ? 'border-[#1B5E20] bg-green-50 text-[#1B5E20]' : 'border-transparent hover:bg-gray-50'}`}
                            style={selectedCategory !== cat.name ? { color: 'var(--color-text-muted)' } : {}}>
                            <span className="truncate">{cat.name}</span>
                            <span className={`ml-1 flex-shrink-0 text-xs font-semibold px-1.5 py-0.5 rounded-full ${selectedCategory === cat.name ? 'bg-green-200 text-green-800' : 'bg-gray-100 text-gray-500'}`}>{cat.count}</span>
                        </button>
                    ))}
                </aside>

                {/* Main content */}
                <div className="flex-1 min-w-0 px-4 lg:px-8 py-6">
                    {loading ? (
                        <Loading text="Loading capstones..." />
                    ) : capstones.length === 0 ? (
                        <EmptyState
                            title="No capstones available"
                            description={search || Object.values(filters).some(Boolean)
                                ? 'Try adjusting your search or filters.'
                                : 'No published or available capstones found.'}
                            icon={<HiOutlineDocumentText className="w-12 h-12" />}
                        />
                    ) : displayMode === 'table' ? <TableView /> : <CardView />}
                </div>
            </div>
        </div>
    );
}
