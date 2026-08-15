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
    HiOutlineClipboardList,
    HiOutlineLockClosed,
    HiOutlineExclamationCircle,
} from 'react-icons/hi';
import { getActivityLogs } from '../../api/admin';
import Loading from '../../components/Loading';
import { useNotification } from '../../components/Notification';

// â”€â”€ Category configs (Activity tab) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const CATEGORY_CONFIG = {
    upload:   { label: 'Upload',    color: 'bg-blue-100 text-blue-700',     icon: HiOutlineUpload },
    delete:   { label: 'Delete',    color: 'bg-red-100 text-red-700',       icon: HiOutlineTrash },
    edit:     { label: 'Edit',      color: 'bg-amber-100 text-amber-700',   icon: HiOutlinePencil },
    download: { label: 'Download',  color: 'bg-green-100 text-green-700',   icon: HiOutlineDownload },
    login:    { label: 'Login',     color: 'bg-purple-100 text-purple-700', icon: HiOutlineLogin },
    account:  { label: 'Account',   color: 'bg-teal-100 text-teal-700',     icon: HiOutlineUserAdd },
    other:    { label: 'Other',     color: 'bg-gray-100 text-gray-600',     icon: HiOutlineShieldCheck },
};

const ACTIVITY_CATEGORIES = ['upload', 'edit', 'delete', 'download', 'account'];
const ROLE_OPTIONS = ['admin', 'faculty', 'student'];

// â”€â”€ Tabs config â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const TABS = [
    { key: 'activity', label: 'Activity Logs',  icon: HiOutlineClipboardList },
    { key: 'session',  label: 'Session Logs',   icon: HiOutlineLogin },
    { key: 'attempt',  label: 'Attempt Logs',   icon: HiOutlineExclamationCircle },
];

// Map each tab to what category params to pass to the API
const TAB_PARAMS = {
    activity: { excludeLogin: true },  // no login category
    session:  { category: 'login' },   // login category only
    attempt:  { category: 'login' },   // login category only (filtered client-side)
};

export default function ActivityLogs() {
    const notify = useNotification();
    const [activeTab, setActiveTab] = useState('activity');

    // Per-tab state
    const [tabState, setTabState] = useState({
        activity: { logs: [], pagination: { current_page: 1, last_page: 1, total: 0 }, loading: true, page: 1, search: '', role: '', category: '', dateFrom: '', dateTo: '', showFilters: false },
        session:  { logs: [], pagination: { current_page: 1, last_page: 1, total: 0 }, loading: true, page: 1, search: '', role: '', dateFrom: '', dateTo: '', showFilters: false },
        attempt:  { logs: [], pagination: { current_page: 1, last_page: 1, total: 0 }, loading: true, page: 1, search: '', role: '', dateFrom: '', dateTo: '', showFilters: false },
    });

    const updateTab = (tab, updates) =>
        setTabState(prev => ({ ...prev, [tab]: { ...prev[tab], ...updates } }));

    const fetchTabLogs = useCallback(async (tab) => {
        updateTab(tab, { loading: true });
        const s = tabState[tab];
        try {
            const params = { page: s.page, per_page: 20 };
            if (s.search)   params.search   = s.search;
            if (s.role)     params.role     = s.role;
            if (s.dateFrom) params.date_from = s.dateFrom;
            if (s.dateTo)   params.date_to   = s.dateTo;

            // Activity tab: exclude login logs by passing all non-login categories
            if (tab === 'activity') {
                if (s.category) {
                    params.category = s.category;
                }
                // If no category selected, we'll filter client-side to exclude 'login' source
            } else {
                // Session and attempt both need login category
                params.category = 'login';
            }

            const res = await getActivityLogs(params);
            let data = res.data.data;
            let items = data.data || [];

            // Client-side filtering for source separation
            if (tab === 'activity' && !s.category) {
                items = items.filter(l => l.source === 'audit');
            } else if (tab === 'session') {
                items = items.filter(l => l.activity_type === 'login_success');
            } else if (tab === 'attempt') {
                items = items.filter(l => l.activity_type === 'login_failed' || l.activity_type === 'login_locked');
            }

            updateTab(tab, {
                logs: items,
                loading: false,
                pagination: {
                    current_page: data.current_page,
                    last_page:    data.last_page,
                    total:        items.length,  // use filtered count
                    from:         data.from,
                    to:           data.to,
                },
            });
        } catch {
            notify.error(`Failed to load ${tab} logs.`);
            updateTab(tab, { loading: false });
        }
    }, [tabState]);

    // Fetch on mount + when activeTab changes
    useEffect(() => {
        fetchTabLogs(activeTab);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab, tabState[activeTab].page, tabState[activeTab].search, tabState[activeTab].role,
        tabState[activeTab].category, tabState[activeTab].dateFrom, tabState[activeTab].dateTo]);

    // â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const formatDate = (dateStr) => {
        if (!dateStr) return 'â€”';
        return new Date(dateStr).toLocaleDateString('en-US', {
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
            admin:   'bg-red-50 text-red-700 border-red-200',
            faculty: 'bg-blue-50 text-blue-700 border-blue-200',
            student: 'bg-green-50 text-green-700 border-green-200',
            unknown: 'bg-gray-50 text-gray-600 border-gray-200',
        };
        return (
            <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium border ${colors[role] || colors.unknown}`}>
                {role ? role.charAt(0).toUpperCase() + role.slice(1) : 'Unknown'}
            </span>
        );
    };

    const getStatusBadge = (activityType) => {
        if (activityType === 'login_success') return (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                <HiOutlineLogin className="w-3 h-3" /> Success
            </span>
        );
        if (activityType === 'login_failed') return (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                <HiOutlineExclamationCircle className="w-3 h-3" /> Failed
            </span>
        );
        if (activityType === 'login_locked') return (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
                <HiOutlineLockClosed className="w-3 h-3" /> Locked
            </span>
        );
        return null;
    };

    // â”€â”€ Shared sub-components â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const Pagination = ({ tab, pagination }) => {
        if (pagination.total === 0) return null;
        const s = tabState[tab];
        return (
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-gray-200 bg-gray-50/50">
                <p className="text-xs text-gray-500">
                    Showing <span className="font-medium text-gray-700">{pagination.from || 1}</span> to{' '}
                    <span className="font-medium text-gray-700">{pagination.to || Math.min(20, s.logs.length)}</span> of{' '}
                    <span className="font-medium text-gray-700">{pagination.total}</span> entries
                </p>
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => updateTab(tab, { page: Math.max(1, s.page - 1) })}
                        disabled={s.page <= 1}
                        className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                        <HiOutlineChevronLeft className="w-4 h-4" />
                    </button>
                    {Array.from({ length: Math.min(5, pagination.last_page) }, (_, i) => {
                        let pageNum;
                        if (pagination.last_page <= 5) pageNum = i + 1;
                        else if (s.page <= 3) pageNum = i + 1;
                        else if (s.page >= pagination.last_page - 2) pageNum = pagination.last_page - 4 + i;
                        else pageNum = s.page - 2 + i;
                        return (
                            <button
                                key={pageNum}
                                onClick={() => updateTab(tab, { page: pageNum })}
                                className={`w-8 h-8 text-xs font-medium rounded-lg transition-colors ${
                                    pageNum === s.page
                                        ? 'bg-green-600 text-white shadow-sm'
                                        : 'text-gray-600 hover:bg-gray-100'
                                }`}
                            >
                                {pageNum}
                            </button>
                        );
                    })}
                    <button
                        onClick={() => updateTab(tab, { page: Math.min(pagination.last_page, s.page + 1) })}
                        disabled={s.page >= pagination.last_page}
                        className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                        <HiOutlineChevronRight className="w-4 h-4" />
                    </button>
                </div>
            </div>
        );
    };

    const FilterBar = ({ tab, showCategory = false }) => {
        const s = tabState[tab];
        const hasActive = s.role || s.category || s.dateFrom || s.dateTo;
        return (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm mb-4">
                <div className="p-4 flex flex-wrap items-center gap-3">
                    <form onSubmit={(e) => { e.preventDefault(); updateTab(tab, { page: 1 }); }} className="flex-1 min-w-[240px]">
                        <div className="relative">
                            <HiOutlineSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                value={s.search}
                                onChange={(e) => updateTab(tab, { search: e.target.value, page: 1 })}
                                placeholder="Search by user, email or description..."
                                className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                            />
                        </div>
                    </form>
                    <button
                        onClick={() => updateTab(tab, { showFilters: !s.showFilters })}
                        className={`inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
                            s.showFilters || hasActive
                                ? 'bg-green-50 text-green-700 border-green-300'
                                : 'text-gray-700 bg-white border-gray-300 hover:bg-gray-50'
                        }`}
                    >
                        <HiOutlineFilter className="w-4 h-4" />
                        Filters
                        {hasActive && <span className="w-2 h-2 bg-green-500 rounded-full" />}
                    </button>
                </div>
                {s.showFilters && (
                    <div className="px-4 pb-4 border-t border-gray-100 pt-3">
                        <div className="flex flex-wrap items-end gap-3">
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Role</label>
                                <select
                                    value={s.role}
                                    onChange={(e) => updateTab(tab, { role: e.target.value, page: 1 })}
                                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none min-w-[120px]"
                                >
                                    <option value="">All Roles</option>
                                    {ROLE_OPTIONS.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                                </select>
                            </div>
                            {showCategory && (
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1">Category</label>
                                    <select
                                        value={s.category}
                                        onChange={(e) => updateTab(tab, { category: e.target.value, page: 1 })}
                                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none min-w-[140px]"
                                    >
                                        <option value="">All Categories</option>
                                        {ACTIVITY_CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_CONFIG[c]?.label || c}</option>)}
                                    </select>
                                </div>
                            )}
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Date From</label>
                                <div className="relative">
                                    <HiOutlineCalendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <input type="date" value={s.dateFrom} onChange={(e) => updateTab(tab, { dateFrom: e.target.value, page: 1 })}
                                        className="pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Date To</label>
                                <div className="relative">
                                    <HiOutlineCalendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <input type="date" value={s.dateTo} onChange={(e) => updateTab(tab, { dateTo: e.target.value, page: 1 })}
                                        className="pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none" />
                                </div>
                            </div>
                            {hasActive && (
                                <button
                                    onClick={() => updateTab(tab, { role: '', category: '', dateFrom: '', dateTo: '', page: 1 })}
                                    className="px-3 py-2 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                                >
                                    Clear All
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    // â”€â”€ Render â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const s = tabState[activeTab];

    return (
        <div className="space-y-5">
            {/* Page header */}
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Logs</h1>
                    <p className="text-sm text-gray-500 mt-0.5">Monitor system activity, sessions, and login attempts</p>
                </div>
                <button
                    onClick={() => fetchTabLogs(activeTab)}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                    <HiOutlineRefresh className={`w-4 h-4 ${s.loading ? 'animate-spin' : ''}`} />
                    Refresh
                </button>
            </div>

            {/* Tab switcher */}
            <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-xl p-1 shadow-sm w-fit">
                {TABS.map(({ key, label, icon: Icon }) => (
                    <button
                        key={key}
                        onClick={() => setActiveTab(key)}
                        className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                            activeTab === key
                                ? 'bg-[#1B5E20] text-white shadow-sm'
                                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                        }`}
                    >
                        <Icon className="w-4 h-4" />
                        {label}
                    </button>
                ))}
            </div>

            {/* â”€â”€ Activity Logs Tab â”€â”€ */}
            {activeTab === 'activity' && (
                <>
                    <FilterBar tab="activity" showCategory />
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                        {s.loading ? (
                            <div className="py-20"><Loading text="Loading activity logs..." /></div>
                        ) : s.logs.length === 0 ? (
                            <EmptyState icon={HiOutlineClipboardList} text="No activity logs found" sub="Try adjusting your filters or search terms" />
                        ) : (
                            <>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-left">
                                        <thead>
                                            <tr className="bg-gray-50 border-b border-gray-200">
                                                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Category</th>
                                                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">User</th>
                                                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider min-w-[300px]">Description</th>
                                                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Role</th>
                                                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Date & Time</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {s.logs.map((log, i) => (
                                                <tr key={`${log.source}-${log.id}-${i}`} className="hover:bg-gray-50/50 transition-colors">
                                                    <td className="px-4 py-3">{getCategoryBadge(log.category)}</td>
                                                    <td className="px-4 py-3">
                                                        <p className="font-medium text-gray-900">{log.user_name || 'â€”'}</p>
                                                        <p className="text-xs text-gray-400">{log.user_email}</p>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <p className="text-sm text-gray-700 leading-relaxed">{log.description}</p>
                                                        {log.ip_address && <p className="text-xs text-gray-400 mt-0.5">IP: {log.ip_address}</p>}
                                                    </td>
                                                    <td className="px-4 py-3">{getRoleBadge(log.user_role)}</td>
                                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{formatDate(log.activity_date)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <Pagination tab="activity" pagination={s.pagination} />
                            </>
                        )}
                    </div>
                </>
            )}

            {/* â”€â”€ Session Logs Tab â”€â”€ */}
            {activeTab === 'session' && (
                <>
                    <FilterBar tab="session" />
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                        {s.loading ? (
                            <div className="py-20"><Loading text="Loading session logs..." /></div>
                        ) : s.logs.length === 0 ? (
                            <EmptyState icon={HiOutlineLogin} text="No session logs found" sub="Successful logins will appear here" />
                        ) : (
                            <>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-left">
                                        <thead>
                                            <tr className="bg-gray-50 border-b border-gray-200">
                                                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                                                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">User</th>
                                                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Role</th>
                                                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">IP Address</th>
                                                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Date & Time</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {s.logs.map((log, i) => (
                                                <tr key={`${log.source}-${log.id}-${i}`} className="hover:bg-gray-50/50 transition-colors">
                                                    <td className="px-4 py-3">{getStatusBadge(log.activity_type)}</td>
                                                    <td className="px-4 py-3">
                                                        <p className="font-medium text-gray-900">{log.user_name || 'â€”'}</p>
                                                        <p className="text-xs text-gray-400">{log.user_email}</p>
                                                    </td>
                                                    <td className="px-4 py-3">{getRoleBadge(log.user_role)}</td>
                                                    <td className="px-4 py-3 text-sm text-gray-600 font-mono">{log.ip_address || 'â€”'}</td>
                                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{formatDate(log.activity_date)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <Pagination tab="session" pagination={s.pagination} />
                            </>
                        )}
                    </div>
                </>
            )}

            {/* â”€â”€ Attempt Logs Tab â”€â”€ */}
            {activeTab === 'attempt' && (
                <>
                    <FilterBar tab="attempt" />
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                        {s.loading ? (
                            <div className="py-20"><Loading text="Loading attempt logs..." /></div>
                        ) : s.logs.length === 0 ? (
                            <EmptyState icon={HiOutlineLockClosed} text="No login attempt logs found" sub="Failed and locked login attempts will appear here" />
                        ) : (
                            <>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-left">
                                        <thead>
                                            <tr className="bg-gray-50 border-b border-gray-200">
                                                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                                                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Email</th>
                                                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Role</th>
                                                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Description</th>
                                                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">IP Address</th>
                                                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Date & Time</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {s.logs.map((log, i) => (
                                                <tr key={`${log.source}-${log.id}-${i}`} className="hover:bg-gray-50/50 transition-colors">
                                                    <td className="px-4 py-3">{getStatusBadge(log.activity_type)}</td>
                                                    <td className="px-4 py-3">
                                                        <p className="font-medium text-gray-900">{log.user_email || 'â€”'}</p>
                                                        {log.user_name && log.user_name !== log.user_email && (
                                                            <p className="text-xs text-gray-400">{log.user_name}</p>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3">{getRoleBadge(log.user_role)}</td>
                                                    <td className="px-4 py-3 text-sm text-gray-700 max-w-xs">{log.description}</td>
                                                    <td className="px-4 py-3 text-sm text-gray-600 font-mono">{log.ip_address || 'â€”'}</td>
                                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{formatDate(log.activity_date)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <Pagination tab="attempt" pagination={s.pagination} />
                            </>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}

function EmptyState({ icon: Icon, text, sub }) {
    return (
        <div className="py-20 text-center text-gray-400">
            <Icon className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="text-sm font-medium">{text}</p>
            {sub && <p className="text-xs mt-1">{sub}</p>}
        </div>
    );
}
