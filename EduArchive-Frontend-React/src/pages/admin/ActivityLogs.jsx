import { useState, useEffect, useCallback, useRef } from 'react';
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
    HiOutlineChevronDown,
    HiOutlineUser,
    HiOutlineBookOpen,
    HiOutlineCollection,
} from 'react-icons/hi';
import { getActivityLogs, getActivityLogUsers, getActivityLogCapstones } from '../../api/admin';
import Loading from '../../components/Loading';
import { useNotification } from '../../components/Notification';

// ── Category configs ─────────────────────────────────────────────────────────
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

// ── Main tab config ──────────────────────────────────────────────────────────
const TABS = [
    { key: 'activity', label: 'Activity Logs',  icon: HiOutlineClipboardList },
    { key: 'session',  label: 'Session Logs',   icon: HiOutlineLogin },
    { key: 'attempt',  label: 'Attempt Logs',   icon: HiOutlineExclamationCircle },
];

// ── Activity sub-sections (dropdown) ────────────────────────────────────────
const ACTIVITY_SECTIONS = [
    { key: 'all',      label: 'All',      icon: HiOutlineCollection  },
    { key: 'user',     label: 'User',     icon: HiOutlineUser        },
    { key: 'capstone', label: 'Capstone', icon: HiOutlineBookOpen    },
];

const INITIAL_LOG_STATE = {
    logs: [], pagination: { current_page: 1, last_page: 1, total: 0 },
    loading: true, page: 1, search: '', role: '', category: '', dateFrom: '', dateTo: '', showFilters: false,
};

export default function ActivityLogs() {
    const notify = useNotification();
    const [activeTab, setActiveTab] = useState('activity');

    // ── Activity sub-section state ──
    const [activitySection, setActivitySection] = useState('all'); // 'all' | 'user' | 'capstone'
    const [sectionDropdownOpen, setSectionDropdownOpen] = useState(false);
    const sectionDropdownRef = useRef(null);

    // User drill-down state
    const [selectedUser, setSelectedUser] = useState(null);
    const [usersList, setUsersList] = useState([]);
    const [usersLoading, setUsersLoading] = useState(false);
    const [usersSearch, setUsersSearch] = useState('');

    // Capstone drill-down state
    const [selectedCapstone, setSelectedCapstone] = useState(null);
    const [capstonesList, setCapstonesList] = useState([]);
    const [capstonesLoading, setCapstonesLoading] = useState(false);
    const [capstonesSearch, setCapstonesSearch] = useState('');

    // Per-tab log state
    const [tabState, setTabState] = useState({
        activity: { ...INITIAL_LOG_STATE },
        session:  { ...INITIAL_LOG_STATE },
        attempt:  { ...INITIAL_LOG_STATE },
    });

    // Drill-down log state (for user/capstone detail view)
    const [drillState, setDrillState] = useState({
        logs: [], pagination: { current_page: 1, last_page: 1, total: 0 },
        loading: false, page: 1, search: '', category: '', dateFrom: '', dateTo: '', showFilters: false,
    });

    const updateTab = (tab, updates) =>
        setTabState(prev => ({ ...prev, [tab]: { ...prev[tab], ...updates } }));

    const updateDrill = (updates) =>
        setDrillState(prev => ({ ...prev, ...updates }));

    // Close section dropdown when clicking outside
    useEffect(() => {
        const handler = (e) => {
            if (sectionDropdownRef.current && !sectionDropdownRef.current.contains(e.target)) {
                setSectionDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // ── Fetch main tab logs ──────────────────────────────────────────────────
    const fetchTabLogs = useCallback(async (tab) => {
        updateTab(tab, { loading: true });
        const s = tabState[tab];
        try {
            const params = { page: s.page, per_page: 20 };
            if (s.search)   params.search    = s.search;
            if (s.role)     params.role      = s.role;
            if (s.dateFrom) params.date_from = s.dateFrom;
            if (s.dateTo)   params.date_to   = s.dateTo;

            if (tab === 'activity') {
                if (s.category) params.category = s.category;
            } else {
                params.category = 'login';
            }

            const res = await getActivityLogs(params);
            let data  = res.data.data;
            let items = data.data || [];

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
                    total:        items.length,
                    from:         data.from,
                    to:           data.to,
                },
            });
        } catch {
            notify.error(`Failed to load ${tab} logs.`);
            updateTab(tab, { loading: false });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tabState]);

    // Fetch on mount + when active tab / filters change
    useEffect(() => {
        if (activeTab !== 'activity' || activitySection === 'all') {
            fetchTabLogs(activeTab);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab, activitySection,
        tabState[activeTab].page, tabState[activeTab].search, tabState[activeTab].role,
        tabState[activeTab].category, tabState[activeTab].dateFrom, tabState[activeTab].dateTo]);

    // ── Fetch users list ─────────────────────────────────────────────────────
    const fetchUsers = useCallback(async (search = '') => {
        setUsersLoading(true);
        try {
            const res = await getActivityLogUsers({ search });
            setUsersList(res.data.data || []);
        } catch {
            notify.error('Failed to load users.');
        } finally {
            setUsersLoading(false);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (activeTab === 'activity' && activitySection === 'user' && !selectedUser) {
            fetchUsers(usersSearch);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab, activitySection, selectedUser, usersSearch]);

    // ── Fetch capstones list ─────────────────────────────────────────────────
    const fetchCapstones = useCallback(async (search = '') => {
        setCapstonesLoading(true);
        try {
            const res = await getActivityLogCapstones({ search });
            setCapstonesList(res.data.data || []);
        } catch {
            notify.error('Failed to load capstones.');
        } finally {
            setCapstonesLoading(false);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (activeTab === 'activity' && activitySection === 'capstone' && !selectedCapstone) {
            fetchCapstones(capstonesSearch);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab, activitySection, selectedCapstone, capstonesSearch]);

    // ── Fetch drill-down logs (user or capstone detail) ──────────────────────
    // Accepts explicit params to avoid stale-closure issues.
    // filterKey: 'user_id' | 'capstone_id'
    // filterParams: snapshot of drillState fields needed for this fetch
    const fetchDrillLogs = useCallback(async (filterKey, filterId, filterParams) => {
        updateDrill({ loading: true });
        try {
            const params = { page: filterParams.page || 1, per_page: 20 };
            if (filterKey === 'user_id')     params.user_id     = filterId;
            if (filterKey === 'capstone_id') params.capstone_id = filterId;
            if (filterParams.search)   params.search    = filterParams.search;
            if (filterParams.category) params.category  = filterParams.category;
            if (filterParams.dateFrom) params.date_from = filterParams.dateFrom;
            if (filterParams.dateTo)   params.date_to   = filterParams.dateTo;

            const res  = await getActivityLogs(params);
            const data = res.data.data;
            let items  = data.data || [];

            // For capstone drill-down: login logs are never linked to a capstone model,
            // so filter to audit only. For user drill-down: show ALL activity (audit + login)
            // so the count matches what usersWithActivity returns.
            if (filterKey === 'capstone_id') {
                items = items.filter(l => l.source === 'audit');
            }

            updateDrill({
                logs: items,
                loading: false,
                pagination: {
                    current_page: data.current_page,
                    last_page:    data.last_page,
                    total:        items.length,
                    from:         data.from,
                    to:           data.to,
                },
            });
        } catch {
            notify.error('Failed to load logs.');
            updateDrill({ loading: false });
        }
    // No drillState in deps — params are passed explicitly to avoid stale closure.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (selectedUser) {
            fetchDrillLogs('user_id', selectedUser.id, {
                page:     drillState.page,
                search:   drillState.search,
                category: drillState.category,
                dateFrom: drillState.dateFrom,
                dateTo:   drillState.dateTo,
            });
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedUser, drillState.page, drillState.search, drillState.category,
        drillState.dateFrom, drillState.dateTo]);

    useEffect(() => {
        if (selectedCapstone) {
            fetchDrillLogs('capstone_id', selectedCapstone.id, {
                page:     drillState.page,
                search:   drillState.search,
                category: drillState.category,
                dateFrom: drillState.dateFrom,
                dateTo:   drillState.dateTo,
            });
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedCapstone, drillState.page, drillState.search, drillState.category,
        drillState.dateFrom, drillState.dateTo]);

    // ── Helpers ──────────────────────────────────────────────────────────────
    const formatDate = (dateStr) => {
        if (!dateStr) return '—';
        return new Date(dateStr).toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric',
            hour: '2-digit', minute: '2-digit',
        });
    };

    const timeAgo = (dateStr) => {
        if (!dateStr) return '—';
        const diff = Date.now() - new Date(dateStr).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1)  return 'just now';
        if (mins < 60) return `${mins}m ago`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24)  return `${hrs}h ago`;
        const days = Math.floor(hrs / 24);
        if (days < 7)  return `${days}d ago`;
        return formatDate(dateStr);
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

    const getRoleInitials = (name) => {
        if (!name) return '?';
        return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    };

    const getRoleAvatarColor = (role) => {
        if (role === 'admin')   return 'bg-red-100 text-red-700';
        if (role === 'faculty') return 'bg-blue-100 text-blue-700';
        return 'bg-green-100 text-green-700';
    };

    // ── Sub-components ────────────────────────────────────────────────────────
    const Pagination = ({ paginationData, page, onPageChange }) => {
        if (!paginationData || paginationData.total === 0) return null;
        return (
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-gray-200 bg-gray-50/50">
                <p className="text-xs text-gray-500">
                    Showing <span className="font-medium text-gray-700">{paginationData.from || 1}</span> to{' '}
                    <span className="font-medium text-gray-700">{paginationData.to || Math.min(20, paginationData.total)}</span> of{' '}
                    <span className="font-medium text-gray-700">{paginationData.total}</span> entries
                </p>
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => onPageChange(Math.max(1, page - 1))}
                        disabled={page <= 1}
                        className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                        <HiOutlineChevronLeft className="w-4 h-4" />
                    </button>
                    {Array.from({ length: Math.min(5, paginationData.last_page) }, (_, i) => {
                        let pageNum;
                        if (paginationData.last_page <= 5) pageNum = i + 1;
                        else if (page <= 3) pageNum = i + 1;
                        else if (page >= paginationData.last_page - 2) pageNum = paginationData.last_page - 4 + i;
                        else pageNum = page - 2 + i;
                        return (
                            <button
                                key={pageNum}
                                onClick={() => onPageChange(pageNum)}
                                className={`w-8 h-8 text-xs font-medium rounded-lg transition-colors ${
                                    pageNum === page
                                        ? 'bg-green-600 text-white shadow-sm'
                                        : 'text-gray-600 hover:bg-gray-100'
                                }`}
                            >
                                {pageNum}
                            </button>
                        );
                    })}
                    <button
                        onClick={() => onPageChange(Math.min(paginationData.last_page, page + 1))}
                        disabled={page >= paginationData.last_page}
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

    // Drill-down filter bar (for user/capstone detail)
    const DrillFilterBar = () => {
        const hasActive = drillState.category || drillState.dateFrom || drillState.dateTo;
        return (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm mb-4">
                <div className="p-4 flex flex-wrap items-center gap-3">
                    <form onSubmit={(e) => { e.preventDefault(); updateDrill({ page: 1 }); }} className="flex-1 min-w-[240px]">
                        <div className="relative">
                            <HiOutlineSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                value={drillState.search}
                                onChange={(e) => updateDrill({ search: e.target.value, page: 1 })}
                                placeholder="Search description..."
                                className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                            />
                        </div>
                    </form>
                    <button
                        onClick={() => updateDrill({ showFilters: !drillState.showFilters })}
                        className={`inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
                            drillState.showFilters || hasActive
                                ? 'bg-green-50 text-green-700 border-green-300'
                                : 'text-gray-700 bg-white border-gray-300 hover:bg-gray-50'
                        }`}
                    >
                        <HiOutlineFilter className="w-4 h-4" />
                        Filters
                        {hasActive && <span className="w-2 h-2 bg-green-500 rounded-full" />}
                    </button>
                </div>
                {drillState.showFilters && (
                    <div className="px-4 pb-4 border-t border-gray-100 pt-3">
                        <div className="flex flex-wrap items-end gap-3">
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Category</label>
                                <select
                                    value={drillState.category}
                                    onChange={(e) => updateDrill({ category: e.target.value, page: 1 })}
                                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none min-w-[140px]"
                                >
                                    <option value="">All Categories</option>
                                    {ACTIVITY_CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_CONFIG[c]?.label || c}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Date From</label>
                                <div className="relative">
                                    <HiOutlineCalendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <input type="date" value={drillState.dateFrom} onChange={(e) => updateDrill({ dateFrom: e.target.value, page: 1 })}
                                        className="pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Date To</label>
                                <div className="relative">
                                    <HiOutlineCalendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <input type="date" value={drillState.dateTo} onChange={(e) => updateDrill({ dateTo: e.target.value, page: 1 })}
                                        className="pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none" />
                                </div>
                            </div>
                            {hasActive && (
                                <button
                                    onClick={() => updateDrill({ category: '', dateFrom: '', dateTo: '', page: 1 })}
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

    // ── Logs table (reusable) ─────────────────────────────────────────────────
    const LogsTable = ({ logs, loading, pagination, page, onPageChange, showUser = true, showStatus = false, emptyText = 'No activity logs found' }) => {
        if (loading) return <div className="py-20"><Loading text="Loading logs..." /></div>;
        if (!logs.length) return <EmptyState icon={HiOutlineClipboardList} text={emptyText} sub="Try adjusting your filters or search terms" />;
        return (
            <>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-200">
                                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Category</th>
                                {showUser && <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">User</th>}
                                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider min-w-[300px]">Description</th>
                                {showUser && <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Role</th>}
                                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Date & Time</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {logs.map((log, i) => (
                                <tr key={`${log.source}-${log.id}-${i}`} className="hover:bg-gray-50/50 transition-colors">
                                    <td className="px-4 py-3">
                                        <div className="flex flex-col gap-1">
                                            {getCategoryBadge(log.category)}
                                            {/* Show login status badge for login entries in mixed views */}
                                            {showStatus && log.source === 'login' && getStatusBadge(log.activity_type)}
                                        </div>
                                    </td>
                                    {showUser && (
                                        <td className="px-4 py-3">
                                            <p className="font-medium text-gray-900">{log.user_name || '—'}</p>
                                            <p className="text-xs text-gray-400">{log.user_email}</p>
                                        </td>
                                    )}
                                    <td className="px-4 py-3">
                                        <p className="text-sm text-gray-700 leading-relaxed">{log.description}</p>
                                        {log.ip_address && <p className="text-xs text-gray-400 mt-0.5">IP: {log.ip_address}</p>}
                                    </td>
                                    {showUser && <td className="px-4 py-3">{getRoleBadge(log.user_role)}</td>}
                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{formatDate(log.activity_date)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <Pagination paginationData={pagination} page={page} onPageChange={onPageChange} />
            </>
        );
    };


    // ── Handlers ──────────────────────────────────────────────────────────────
    const handleSelectUser = (user) => {
        setSelectedUser(user);
        setDrillState({ logs: [], pagination: { current_page: 1, last_page: 1, total: 0 }, loading: true, page: 1, search: '', category: '', dateFrom: '', dateTo: '', showFilters: false });
    };

    const handleSelectCapstone = (capstone) => {
        setSelectedCapstone(capstone);
        setDrillState({ logs: [], pagination: { current_page: 1, last_page: 1, total: 0 }, loading: true, page: 1, search: '', category: '', dateFrom: '', dateTo: '', showFilters: false });
    };

    const handleBackFromUser = () => {
        setSelectedUser(null);
        setDrillState({ logs: [], pagination: { current_page: 1, last_page: 1, total: 0 }, loading: false, page: 1, search: '', category: '', dateFrom: '', dateTo: '', showFilters: false });
    };

    const handleBackFromCapstone = () => {
        setSelectedCapstone(null);
        setDrillState({ logs: [], pagination: { current_page: 1, last_page: 1, total: 0 }, loading: false, page: 1, search: '', category: '', dateFrom: '', dateTo: '', showFilters: false });
    };

    const handleSectionChange = (key) => {
        setActivitySection(key);
        setSectionDropdownOpen(false);
        setSelectedUser(null);
        setSelectedCapstone(null);
        setUsersSearch('');
        setCapstonesSearch('');
        setDrillState({ logs: [], pagination: { current_page: 1, last_page: 1, total: 0 }, loading: false, page: 1, search: '', category: '', dateFrom: '', dateTo: '', showFilters: false });
    };

    // ── Render ────────────────────────────────────────────────────────────────
    const s = tabState[activeTab];
    const currentSection = ACTIVITY_SECTIONS.find(sec => sec.key === activitySection) || ACTIVITY_SECTIONS[0];

    return (
        <div className="space-y-5">
            {/* Page header */}
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Logs</h1>
                    <p className="text-sm text-gray-500 mt-0.5">Monitor system activity, sessions, and login attempts</p>
                </div>
                <button
                    onClick={() => {
                        if (activeTab !== 'activity' || activitySection === 'all') {
                            fetchTabLogs(activeTab);
                        } else if (activitySection === 'user') {
                            if (selectedUser) fetchDrillLogs('user_id', selectedUser.id);
                            else fetchUsers(usersSearch);
                        } else if (activitySection === 'capstone') {
                            if (selectedCapstone) fetchDrillLogs('capstone_id', selectedCapstone.id);
                            else fetchCapstones(capstonesSearch);
                        }
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                    <HiOutlineRefresh className={`w-4 h-4 ${s.loading || usersLoading || capstonesLoading || drillState.loading ? 'animate-spin' : ''}`} />
                    Refresh
                </button>
            </div>

            {/* Tab switcher */}
            <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-xl p-1 shadow-sm w-fit">
                {TABS.map(({ key, label, icon: Icon }) => (
                    <button
                        key={key}
                        onClick={() => {
                            setActiveTab(key);
                            // Reset section when switching tabs
                            if (key !== 'activity') {
                                setActivitySection('all');
                                setSelectedUser(null);
                                setSelectedCapstone(null);
                            }
                        }}
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

            {/* ── Activity Logs Tab ── */}
            {activeTab === 'activity' && (
                <>
                    {/* Section Dropdown */}
                    <div className="flex items-center gap-3">
                        <span className="text-sm text-gray-500 font-medium">View by:</span>
                        <div className="relative" ref={sectionDropdownRef}>
                            <button
                                onClick={() => setSectionDropdownOpen(prev => !prev)}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 shadow-sm transition-colors min-w-[150px] justify-between"
                            >
                                <span className="flex items-center gap-2">
                                    <currentSection.icon className="w-4 h-4 text-[#1B5E20]" />
                                    {currentSection.label}
                                </span>
                                <HiOutlineChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${sectionDropdownOpen ? 'rotate-180' : ''}`} />
                            </button>
                            {sectionDropdownOpen && (
                                <div className="absolute top-full left-0 mt-1 w-48 bg-white border border-gray-200 rounded-xl shadow-lg z-20 overflow-hidden">
                                    {ACTIVITY_SECTIONS.map(({ key, label, icon: Icon }) => (
                                        <button
                                            key={key}
                                            onClick={() => handleSectionChange(key)}
                                            className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors text-left ${
                                                activitySection === key
                                                    ? 'bg-green-50 text-[#1B5E20] font-medium'
                                                    : 'text-gray-700 hover:bg-gray-50'
                                            }`}
                                        >
                                            <Icon className="w-4 h-4" />
                                            {label}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Breadcrumb for drill-down */}
                        {(selectedUser || selectedCapstone) && (
                            <div className="flex items-center gap-2 text-sm text-gray-500">
                                <span>›</span>
                                <span className="font-medium text-gray-800">
                                    {selectedUser ? selectedUser.name : selectedCapstone?.title}
                                </span>
                            </div>
                        )}
                    </div>

                    {/* ── All Section ── */}
                    {activitySection === 'all' && (
                        <>
                            <FilterBar tab="activity" showCategory />
                            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                                <LogsTable
                                    logs={s.logs}
                                    loading={s.loading}
                                    pagination={s.pagination}
                                    page={s.page}
                                    onPageChange={(p) => updateTab('activity', { page: p })}
                                />
                            </div>
                        </>
                    )}

                    {/* ── User Section ── */}
                    {activitySection === 'user' && !selectedUser && (
                        <>
                            {/* User list search */}
                            <div className="bg-white rounded-xl border border-gray-200 shadow-sm mb-4">
                                <div className="p-4">
                                    <div className="relative">
                                        <HiOutlineSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                        <input
                                            type="text"
                                            value={usersSearch}
                                            onChange={(e) => setUsersSearch(e.target.value)}
                                            placeholder="Search users by name or email..."
                                            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                                {usersLoading ? (
                                    <div className="py-20"><Loading text="Loading users..." /></div>
                                ) : usersList.length === 0 ? (
                                    <EmptyState icon={HiOutlineUser} text="No users with activity found" sub="No activity logs have been recorded yet" />
                                ) : (
                                    <div className="divide-y divide-gray-100">
                                        {usersList.map((user) => (
                                            <button
                                                key={user.id}
                                                onClick={() => handleSelectUser(user)}
                                                className="w-full flex items-center gap-4 px-5 py-4 hover:bg-gray-50/60 transition-colors text-left group"
                                            >
                                                {/* Avatar */}
                                                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${getRoleAvatarColor(user.role)}`}>
                                                    {getRoleInitials(user.name)}
                                                </div>
                                                {/* Info */}
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <p className="font-semibold text-gray-900 text-sm">{user.name}</p>
                                                        {getRoleBadge(user.role)}
                                                    </div>
                                                    <p className="text-xs text-gray-400 mt-0.5 truncate">{user.email}</p>
                                                </div>
                                                {/* Stats */}
                                                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                                    <span className="text-xs font-semibold text-[#1B5E20] bg-green-50 border border-green-100 rounded-full px-2.5 py-0.5">
                                                        {user.activity_count} {user.activity_count === 1 ? 'activity' : 'activities'}
                                                    </span>
                                                    <span className="text-xs text-gray-400">{timeAgo(user.last_activity)}</span>
                                                </div>
                                                <HiOutlineChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition-colors flex-shrink-0" />
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </>
                    )}

                    {/* ── User Detail ── */}
                    {activitySection === 'user' && selectedUser && (
                        <>
                            {/* Back button + user info header */}
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={handleBackFromUser}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                                >
                                    <HiOutlineChevronLeft className="w-4 h-4" />
                                    Back to Users
                                </button>
                            </div>

                            {/* User card */}
                            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex items-center gap-4">
                                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-base font-bold flex-shrink-0 ${getRoleAvatarColor(selectedUser.role)}`}>
                                    {getRoleInitials(selectedUser.name)}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <p className="font-bold text-gray-900">{selectedUser.name}</p>
                                        {getRoleBadge(selectedUser.role)}
                                    </div>
                                    <p className="text-sm text-gray-400">{selectedUser.email}</p>
                                </div>
                                <div className="text-right flex-shrink-0">
                                    <p className="text-2xl font-bold text-[#1B5E20]">{selectedUser.activity_count}</p>
                                    <p className="text-xs text-gray-400">total activities</p>
                                </div>
                            </div>

                            <DrillFilterBar />

                            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                                <LogsTable
                                    logs={drillState.logs}
                                    loading={drillState.loading}
                                    pagination={drillState.pagination}
                                    page={drillState.page}
                                    onPageChange={(p) => updateDrill({ page: p })}
                                    showUser={false}
                                    showStatus={true}
                                    emptyText={`No activity logs found for ${selectedUser.name}`}
                                />
                            </div>
                        </>
                    )}

                    {/* ── Capstone Section (list) ── */}
                    {activitySection === 'capstone' && !selectedCapstone && (
                        <>
                            {/* Capstone search */}
                            <div className="bg-white rounded-xl border border-gray-200 shadow-sm mb-4">
                                <div className="p-4">
                                    <div className="relative">
                                        <HiOutlineSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                        <input
                                            type="text"
                                            value={capstonesSearch}
                                            onChange={(e) => setCapstonesSearch(e.target.value)}
                                            placeholder="Search capstones by title, author, or program..."
                                            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                                {capstonesLoading ? (
                                    <div className="py-20"><Loading text="Loading capstones..." /></div>
                                ) : capstonesList.length === 0 ? (
                                    <EmptyState icon={HiOutlineBookOpen} text="No capstones with activity found" sub="No capstone activity logs have been recorded yet" />
                                ) : (
                                    <div className="divide-y divide-gray-100">
                                        {capstonesList.map((capstone) => (
                                            <button
                                                key={capstone.id}
                                                onClick={() => handleSelectCapstone(capstone)}
                                                className="w-full flex items-start gap-4 px-5 py-4 hover:bg-gray-50/60 transition-colors text-left group"
                                            >
                                                {/* Capstone icon */}
                                                <div className="w-10 h-10 rounded-lg bg-green-50 border border-green-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                                                    <HiOutlineBookOpen className="w-5 h-5 text-[#1B5E20]" />
                                                </div>
                                                {/* Info */}
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-semibold text-gray-900 text-sm leading-snug line-clamp-1">{capstone.title}</p>
                                                    <p className="text-xs text-gray-500 mt-0.5">{capstone.author}</p>
                                                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                                                        {capstone.program && (
                                                            <span className="text-xs text-gray-400 bg-gray-100 rounded px-1.5 py-0.5">{capstone.program}</span>
                                                        )}
                                                        {capstone.year && (
                                                            <span className="text-xs text-gray-400 bg-gray-100 rounded px-1.5 py-0.5">{capstone.year}</span>
                                                        )}
                                                    </div>
                                                </div>
                                                {/* Stats */}
                                                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                                    <span className="text-xs font-semibold text-[#1B5E20] bg-green-50 border border-green-100 rounded-full px-2.5 py-0.5">
                                                        {capstone.activity_count} {capstone.activity_count === 1 ? 'activity' : 'activities'}
                                                    </span>
                                                    <span className="text-xs text-gray-400">{timeAgo(capstone.last_activity)}</span>
                                                </div>
                                                <HiOutlineChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition-colors flex-shrink-0 mt-1" />
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </>
                    )}

                    {/* ── Capstone Detail ── */}
                    {activitySection === 'capstone' && selectedCapstone && (
                        <>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={handleBackFromCapstone}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                                >
                                    <HiOutlineChevronLeft className="w-4 h-4" />
                                    Back to Capstones
                                </button>
                            </div>

                            {/* Capstone card */}
                            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex items-start gap-4">
                                <div className="w-12 h-12 rounded-lg bg-green-50 border border-green-100 flex items-center justify-center flex-shrink-0">
                                    <HiOutlineBookOpen className="w-6 h-6 text-[#1B5E20]" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-bold text-gray-900 leading-snug">{selectedCapstone.title}</p>
                                    <p className="text-sm text-gray-500 mt-0.5">{selectedCapstone.author}</p>
                                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                        {selectedCapstone.program && (
                                            <span className="text-xs text-gray-500 bg-gray-100 rounded px-2 py-0.5">{selectedCapstone.program}</span>
                                        )}
                                        {selectedCapstone.year && (
                                            <span className="text-xs text-gray-500 bg-gray-100 rounded px-2 py-0.5">{selectedCapstone.year}</span>
                                        )}
                                    </div>
                                </div>
                                <div className="text-right flex-shrink-0">
                                    <p className="text-2xl font-bold text-[#1B5E20]">{selectedCapstone.activity_count}</p>
                                    <p className="text-xs text-gray-400">total activities</p>
                                </div>
                            </div>

                            <DrillFilterBar />

                            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                                <LogsTable
                                    logs={drillState.logs}
                                    loading={drillState.loading}
                                    pagination={drillState.pagination}
                                    page={drillState.page}
                                    onPageChange={(p) => updateDrill({ page: p })}
                                    showUser={true}
                                    emptyText={`No activity logs found for "${selectedCapstone.title}"`}
                                />
                            </div>
                        </>
                    )}
                </>
            )}

            {/* ── Session Logs Tab ── */}
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
                                                        <p className="font-medium text-gray-900">{log.user_name || '—'}</p>
                                                        <p className="text-xs text-gray-400">{log.user_email}</p>
                                                    </td>
                                                    <td className="px-4 py-3">{getRoleBadge(log.user_role)}</td>
                                                    <td className="px-4 py-3 text-sm text-gray-600 font-mono">{log.ip_address || '—'}</td>
                                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{formatDate(log.activity_date)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <Pagination
                                    paginationData={s.pagination}
                                    page={s.page}
                                    onPageChange={(p) => updateTab('session', { page: p })}
                                />
                            </>
                        )}
                    </div>
                </>
            )}

            {/* ── Attempt Logs Tab ── */}
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
                                                        <p className="font-medium text-gray-900">{log.user_email || '—'}</p>
                                                        {log.user_name && log.user_name !== log.user_email && (
                                                            <p className="text-xs text-gray-400">{log.user_name}</p>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3">{getRoleBadge(log.user_role)}</td>
                                                    <td className="px-4 py-3 text-sm text-gray-700 max-w-xs">{log.description}</td>
                                                    <td className="px-4 py-3 text-sm text-gray-600 font-mono">{log.ip_address || '—'}</td>
                                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{formatDate(log.activity_date)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <Pagination
                                    paginationData={s.pagination}
                                    page={s.page}
                                    onPageChange={(p) => updateTab('attempt', { page: p })}
                                />
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
