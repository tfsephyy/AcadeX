import { useState, useEffect, useCallback } from 'react';
import {
    HiOutlineSearch,
    HiOutlineFilter,
    HiOutlineRefresh,
    HiOutlineUpload,
    HiOutlineTrash,
    HiOutlinePencil,
    HiOutlineDownload,
    HiOutlineLogin,
    HiOutlineUserAdd,
    HiOutlineShieldCheck,
    HiOutlineChevronLeft,
    HiOutlineChevronRight,
    HiOutlineCalendar,
} from 'react-icons/hi';
import { getActivityLogs } from '../../api/admin';
import Loading from '../../components/Loading';
import { useNotification } from '../../components/Notification';

const CATEGORY_CONFIG = {
    upload:   { label: 'Upload',    color: 'bg-blue-100 text-blue-700',   icon: HiOutlineUpload },
    delete:   { label: 'Delete',    color: 'bg-red-100 text-red-700',     icon: HiOutlineTrash },
    edit:     { label: 'Edit',      color: 'bg-amber-100 text-amber-700', icon: HiOutlinePencil },
    download: { label: 'Download',  color: 'bg-green-100 text-green-700', icon: HiOutlineDownload },
    login:    { label: 'Login',     color: 'bg-purple-100 text-purple-700', icon: HiOutlineLogin },
    account:  { label: 'Account',   color: 'bg-teal-100 text-teal-700',   icon: HiOutlineUserAdd },
    other:    { label: 'Other',     color: 'bg-gray-100 text-gray-600',   icon: HiOutlineShieldCheck },
};

const ROLE_OPTIONS = ['admin', 'faculty', 'student'];
const CATEGORY_OPTIONS = ['upload', 'edit', 'delete', 'download', 'login', 'account'];

export default function ActivityLogs() {
    const notify = useNotification();
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [pagination, setPagination] = useState({ current_page: 1, last_page: 1, total: 0 });

    // Filters
    const [search, setSearch] = useState('');
    const [roleFilter, setRoleFilter] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [showFilters, setShowFilters] = useState(false);
    const [page, setPage] = useState(1);

    const fetchLogs = useCallback(async () => {
        setLoading(true);
        try {
            const params = { page, per_page: 20 };
            if (search) params.search = search;
            if (roleFilter) params.role = roleFilter;
            if (categoryFilter) params.category = categoryFilter;
            if (dateFrom) params.date_from = dateFrom;
            if (dateTo) params.date_to = dateTo;

            const res = await getActivityLogs(params);
            const data = res.data.data;
            setLogs(data.data || []);
            setPagination({
                current_page: data.current_page,
                last_page: data.last_page,
                total: data.total,
                from: data.from,
                to: data.to,
            });
        } catch (err) {
            notify.error('Failed to load activity logs.');
        } finally {
            setLoading(false);
        }
    }, [page, search, roleFilter, categoryFilter, dateFrom, dateTo]);

    useEffect(() => {
        fetchLogs();
    }, [fetchLogs]);

    const handleSearch = (e) => {
        e.preventDefault();
        setPage(1);
        fetchLogs();
    };

    const handleClearFilters = () => {
        setSearch('');
        setRoleFilter('');
        setCategoryFilter('');
        setDateFrom('');
        setDateTo('');
        setPage(1);
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '—';
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric',
            hour: '2-digit', minute: '2-digit',
        });
    };

    const getCategoryBadge = (category) => {
        const config = CATEGORY_CONFIG[category] || CATEGORY_CONFIG.other;
        const Icon = config.icon;
        return (
            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${config.color}`}>
                <Icon className="w-3 h-3" />
                {config.label}
            </span>
        );
    };

    const getRoleBadge = (role) => {
        const colors = {
            admin: 'bg-red-50 text-red-700 border-red-200',
            faculty: 'bg-blue-50 text-blue-700 border-blue-200',
            student: 'bg-green-50 text-green-700 border-green-200',
            unknown: 'bg-gray-50 text-gray-600 border-gray-200',
        };
        const color = colors[role] || colors.unknown;
        return (
            <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium border ${color}`}>
                {role ? role.charAt(0).toUpperCase() + role.slice(1) : 'Unknown'}
            </span>
        );
    };

    const hasActiveFilters = roleFilter || categoryFilter || dateFrom || dateTo;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Activity Logs</h1>
                    <p className="text-sm text-gray-500 mt-0.5">Monitor all system activities for security and transparency</p>
                </div>
                <button
                    onClick={fetchLogs}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                    <HiOutlineRefresh className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                </button>
            </div>

            {/* Search & Filters Bar */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
                <div className="p-4 flex flex-wrap items-center gap-3">
                    {/* Search */}
                    <form onSubmit={handleSearch} className="flex-1 min-w-[240px]">
                        <div className="relative">
                            <HiOutlineSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search by user, project, or activity..."
                                className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                            />
                        </div>
                    </form>

                    {/* Toggle Filters */}
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className={`inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
                            showFilters || hasActiveFilters
                                ? 'bg-green-50 text-green-700 border-green-300'
                                : 'text-gray-700 bg-white border-gray-300 hover:bg-gray-50'
                        }`}
                    >
                        <HiOutlineFilter className="w-4 h-4" />
                        Filters
                        {hasActiveFilters && (
                            <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                        )}
                    </button>
                </div>

                {/* Expanded Filters */}
                {showFilters && (
                    <div className="px-4 pb-4 border-t border-gray-100 pt-3">
                        <div className="flex flex-wrap items-end gap-3">
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Role</label>
                                <select
                                    value={roleFilter}
                                    onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
                                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none min-w-[120px]"
                                >
                                    <option value="">All Roles</option>
                                    {ROLE_OPTIONS.map(r => (
                                        <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Category</label>
                                <select
                                    value={categoryFilter}
                                    onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
                                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none min-w-[140px]"
                                >
                                    <option value="">All Categories</option>
                                    {CATEGORY_OPTIONS.map(c => (
                                        <option key={c} value={c}>{CATEGORY_CONFIG[c]?.label || c}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Date From</label>
                                <div className="relative">
                                    <HiOutlineCalendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <input
                                        type="date"
                                        value={dateFrom}
                                        onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
                                        className="pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Date To</label>
                                <div className="relative">
                                    <HiOutlineCalendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <input
                                        type="date"
                                        value={dateTo}
                                        onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
                                        className="pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none"
                                    />
                                </div>
                            </div>
                            {hasActiveFilters && (
                                <button
                                    onClick={handleClearFilters}
                                    className="px-3 py-2 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                                >
                                    Clear All
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                {loading ? (
                    <div className="py-20">
                        <Loading text="Loading activity logs..." />
                    </div>
                ) : logs.length === 0 ? (
                    <div className="py-20 text-center text-gray-400">
                        <HiOutlineShieldCheck className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                        <p className="text-sm font-medium">No activity logs found</p>
                        <p className="text-xs mt-1">Try adjusting your filters or search terms</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead>
                                <tr className="bg-gray-50 border-b border-gray-200">
                                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Activity Type</th>
                                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">User</th>
                                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider min-w-[300px]">Description</th>
                                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Role</th>
                                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Date & Time</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {logs.map((log, i) => (
                                    <tr key={`${log.source}-${log.id}-${i}`} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="px-4 py-3">
                                            {getCategoryBadge(log.category)}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div>
                                                <p className="font-medium text-gray-900 text-sm">{log.user_name || '—'}</p>
                                                <p className="text-xs text-gray-400">{log.user_email || ''}</p>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <p className="text-sm text-gray-700 leading-relaxed">{log.description}</p>
                                            {log.ip_address && (
                                                <p className="text-xs text-gray-400 mt-0.5">IP: {log.ip_address}</p>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            {getRoleBadge(log.user_role)}
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap">
                                            <p className="text-sm text-gray-600">{formatDate(log.activity_date)}</p>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Pagination */}
                {!loading && pagination.total > 0 && (
                    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-gray-200 bg-gray-50/50">
                        <p className="text-xs text-gray-500">
                            Showing <span className="font-medium text-gray-700">{pagination.from || 0}</span> to{' '}
                            <span className="font-medium text-gray-700">{pagination.to || 0}</span> of{' '}
                            <span className="font-medium text-gray-700">{pagination.total}</span> logs
                        </p>
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={pagination.current_page <= 1}
                                className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            >
                                <HiOutlineChevronLeft className="w-4 h-4" />
                            </button>
                            {/* Page numbers */}
                            {Array.from({ length: Math.min(5, pagination.last_page) }, (_, i) => {
                                let pageNum;
                                if (pagination.last_page <= 5) {
                                    pageNum = i + 1;
                                } else if (pagination.current_page <= 3) {
                                    pageNum = i + 1;
                                } else if (pagination.current_page >= pagination.last_page - 2) {
                                    pageNum = pagination.last_page - 4 + i;
                                } else {
                                    pageNum = pagination.current_page - 2 + i;
                                }
                                return (
                                    <button
                                        key={pageNum}
                                        onClick={() => setPage(pageNum)}
                                        className={`w-8 h-8 text-xs font-medium rounded-lg transition-colors ${
                                            pageNum === pagination.current_page
                                                ? 'bg-green-600 text-white shadow-sm'
                                                : 'text-gray-600 hover:bg-gray-100'
                                        }`}
                                    >
                                        {pageNum}
                                    </button>
                                );
                            })}
                            <button
                                onClick={() => setPage(p => Math.min(pagination.last_page, p + 1))}
                                disabled={pagination.current_page >= pagination.last_page}
                                className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            >
                                <HiOutlineChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
