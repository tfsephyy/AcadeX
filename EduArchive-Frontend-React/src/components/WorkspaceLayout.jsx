import { useDialogFocus } from './useDialogFocus';
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import { useTheme } from '../context/useTheme';
import { HiOutlineMenu, HiOutlineLogout, HiOutlineUser, HiChevronDown, HiOutlineBell } from 'react-icons/hi';
import ConfirmDialog from './ConfirmDialog';
import { getNotifications, getUnreadNotificationCount, markNotificationRead, markAllNotificationsRead } from '../api/admin';
import Chatbot from './Chatbot';
import WorkspaceSidebar from './WorkspaceSidebar';
import NotificationItems from './NotificationItems';

export default function WorkspaceLayout({ children, role, navItems }) {
    const [sidebarOpen, setSidebarOpen]           = useState(false);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [profileOpen, setProfileOpen]           = useState(false);
    const [notificationOpen, setNotificationOpen] = useState(false);
    const [logoutConfirm, setLogoutConfirm]       = useState(false);
    const [notifications, setNotifications]       = useState([]);
    const [unreadCount, setUnreadCount]           = useState(0);
    const [loadingNotif, setLoadingNotif]         = useState(false);
    const [notificationError, setNotificationError] = useState(false);
    const { user, logout } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const navigate = useNavigate();

    const profileAreaRef  = useRef(null);
    const notifDropdownRef = useDialogFocus(notificationOpen, () => setNotificationOpen(false));
    const bellRef          = useRef(null);
    const pendingReadIds = useRef(new Set());

    useEffect(() => { fetchNotifications(); }, [notificationOpen]);
    useEffect(() => {
        const refresh = () => { fetchNotifications(); };
        const timer = setInterval(refresh, 30000);
        window.addEventListener("focus", refresh);
        window.addEventListener("acadex:notifications-changed", refresh);
        return () => { clearInterval(timer); window.removeEventListener("focus", refresh); window.removeEventListener("acadex:notifications-changed", refresh); };
    }, []);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (profileOpen && profileAreaRef.current && !profileAreaRef.current.contains(e.target)) {
                setProfileOpen(false);
            }
            if (notificationOpen) {
                const hitBell     = bellRef.current?.contains(e.target);
                const hitDropdown = notifDropdownRef.current?.contains(e.target);
                if (!hitBell && !hitDropdown) setNotificationOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [profileOpen, notificationOpen]);

    const fetchNotifications = async () => {
        try {
            setLoadingNotif(true);
            setNotificationError(false);
            const res   = await getNotifications({ per_page: 15 });
            const data  = res.data?.data?.data || res.data?.data || [];
            setNotifications(Array.isArray(data) ? data : []);
            const cRes  = await getUnreadNotificationCount();
            setUnreadCount(cRes.data?.data?.unread_count || 0);
        } catch {
            setNotificationError(true);
        } finally {
            setLoadingNotif(false);
        }
    };

    const handleMarkAsRead = async (id) => {
        if (pendingReadIds.current.has(id)) return;
        pendingReadIds.current.add(id);
        try {
            await markNotificationRead(id);
            setNotifications(previous => previous.map(n => n.id === id ? { ...n, is_read: true } : n));
            setUnreadCount(count => Math.max(0, count - 1));
        } catch { setNotificationError(true); }
        finally { pendingReadIds.current.delete(id); }
    };

    const handleMarkAllAsRead = async () => {
        try {
            await markAllNotificationsRead();
            setNotifications(previous => previous.map(n => ({ ...n, is_read: true })));
            setUnreadCount(0);
        } catch { setNotificationError(true); }
    };

    const handleLogout = async () => {
        setLogoutConfirm(false);
        setProfileOpen(false);
        setNotificationOpen(false);
        await logout();
        navigate('/', { replace: true });
    };

    return (
        <div className="app-shell flex overflow-hidden panel-content-bg">
            <a className="skip-link" href="#workspace-content">Skip to content</a>
            <WorkspaceSidebar role={role === 'admin' ? 'Admin' : 'Faculty'} items={navItems} open={sidebarOpen} collapsed={sidebarCollapsed}
                onOpenChange={setSidebarOpen} onCollapsedChange={setSidebarCollapsed}>
                {/* Profile + Bell row */}
                <div ref={profileAreaRef} onKeyDown={e => { if (e.key === 'Escape') setProfileOpen(false); }} className="sidebar-account relative px-3 py-3 panel-profile-border">
                    {/* Row */}
                    <div className="sidebar-account-row flex items-center gap-1 px-2 py-2 rounded-xl transition-colors panel-profile-btn">
                        {/* Avatar */}
                        <button
                            aria-label="Account menu" aria-expanded={profileOpen} onClick={() => { setProfileOpen(!profileOpen); setNotificationOpen(false); }}
                            title="Account menu" className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 text-white"
                            style={{ background: 'var(--color-primary)' }}
                        >
                            {user?.name?.charAt(0)?.toUpperCase() || role.charAt(0).toUpperCase()}
                        </button>

                        {/* Name & email */}
                        <button
                            aria-label="Account menu" aria-expanded={profileOpen} onClick={() => { setProfileOpen(!profileOpen); setNotificationOpen(false); }}
                            className="sidebar-account-copy flex-1 text-left px-2 min-w-0"
                        >
                            <p className="text-sm font-semibold truncate"
                               style={{ color: 'var(--panel-profile-text)' }}>
                                {user?.name || (role === 'admin' ? 'Admin' : 'Faculty')}
                            </p>
                            <p className="text-xs truncate"
                               style={{ color: 'var(--panel-profile-muted)' }}>
                                {user?.email?.toLowerCase()}
                            </p>
                        </button>

                        {/* Bell */}
                        <button
                            title="Notifications" aria-label={unreadCount ? "Notifications, " + unreadCount + " unread" : "Notifications"} aria-haspopup="dialog" aria-expanded={notificationOpen} ref={bellRef}
                            onClick={() => { setNotificationOpen(!notificationOpen); setProfileOpen(false); }}
                            className="relative p-1.5 rounded-md transition-colors panel-nav-item"
                        >
                            <HiOutlineBell className="w-5 h-5" />
                            {unreadCount > 0 && (
                                <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 leading-none">
                                    {unreadCount}
                                </span>
                            )}
                        </button>

                        {/* Chevron */}
                        <button
                            aria-label="Account menu" aria-expanded={profileOpen} onClick={() => { setProfileOpen(!profileOpen); setNotificationOpen(false); }}
                            className="sidebar-account-chevron shrink-0 transition-colors"
                            style={{ color: 'var(--panel-profile-muted)' }}
                        >
                            <HiChevronDown className={`w-4 h-4 transition-transform ${profileOpen ? 'rotate-180' : ''}`} />
                        </button>
                    </div>

                    {/* Profile dropdown */}
                    {profileOpen && (
                        <div className="absolute bottom-full left-3 right-3 mb-1 rounded-xl overflow-hidden z-[100] panel-dropdown">
                            <button
                                onClick={() => { setProfileOpen(false); navigate('/' + role + '/profile'); }}
                                className="w-full flex items-center gap-3 px-4 py-3 text-sm transition-colors panel-dropdown-item"
                            >
                                <HiOutlineUser className="w-4 h-4 shrink-0" />
                                Profile
                            </button>
                            <button
                                onClick={() => { setProfileOpen(false); setLogoutConfirm(true); }}
                                className="w-full flex items-center gap-3 px-4 py-3 text-sm transition-colors panel-dropdown-danger"
                            >
                                <HiOutlineLogout className="w-4 h-4 shrink-0" />
                                Logout
                            </button>
                        </div>
                    )}
                </div>
            </WorkspaceSidebar>

            {/* ── Main content ─────────────────────────────────────── */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                {/* Top bar */}
                <header className="flex items-center gap-3 px-4 py-2.5 shrink-0 panel-header">
                    {/* Mobile hamburger */}
                    <button
                        aria-label="Open navigation" aria-controls="workspace-navigation" aria-expanded={sidebarOpen} className="lg:hidden p-2 rounded-lg transition-colors panel-topbar-btn"
                        onClick={() => setSidebarOpen(true)}
                    >
                        <HiOutlineMenu className="w-5 h-5" />
                    </button>

                    <div className="flex-1" />

                    {/* Theme toggle */}
                    <button
                        aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} onClick={toggleTheme}
                        className="p-2 rounded-lg transition-colors panel-topbar-btn"
                        title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                    >
                        {theme === 'dark' ? (
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none"
                                 viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
                                <path strokeLinecap="round" strokeLinejoin="round"
                                    d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364-.707.707M6.343 17.657l-.707.707m12.728 0-.707-.707M6.343 6.343l-.707-.707M12 7a5 5 0 100 10 5 5 0 000-10z" />
                            </svg>
                        ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none"
                                 viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
                                <path strokeLinecap="round" strokeLinejoin="round"
                                    d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
                            </svg>
                        )}
                    </button>

                    {/* Welcome text */}
                    <span className="text-sm hidden sm:block" style={{ color: 'var(--panel-topbar-text)' }}>
                        Welcome,{' '}
                        <span className="font-semibold" style={{ color: 'var(--panel-welcome-accent)' }}>
                            {user?.name}
                        </span>
                    </span>
                </header>

                {/* Page content */}
                <main id="workspace-content" tabIndex={-1} className="app-main flex-1 overflow-y-auto p-4 lg:p-8 admin-scroll panel-content-bg">
                    {children}
                </main>
            </div>

            {/* ── Notification dropdown (outside sidebar to avoid clip) */}
            {notificationOpen && (
                <div
                    ref={notifDropdownRef} role="dialog" aria-modal="true" aria-label="Notifications" tabIndex={-1}
                    className={`admin-notifications fixed bottom-16 w-80 rounded-xl max-h-96 overflow-y-auto z-[9999] transition-all duration-300 panel-scroll panel-dropdown ${
                        sidebarCollapsed ? 'left-4' : 'left-[17rem]'
                    }`}
                    style={{ maxWidth: 'calc(100vw - 2rem)' }}
                >
                    {/* Header */}
                    <div className="px-4 py-3 flex items-center justify-between sticky top-0 panel-dropdown"
                         style={{ borderBottom: '1px solid var(--panel-dropdown-border)' }}>
                        <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm"
                                  style={{ color: 'var(--panel-dropdown-text)' }}>
                                Notifications
                            </span>
                            {unreadCount > 0 && (
                                <span className="inline-block bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                                    {unreadCount}
                                </span>
                            )}
                        </div>
                        {notifications.length > 0 && (
                            <button
                                onClick={handleMarkAllAsRead}
                                className="text-xs font-medium transition-colors hover:opacity-80"
                                style={{ color: 'var(--color-link)' }}
                            >
                                Mark all read
                            </button>
                        )}
                    </div>

                    {notificationError && (
                        <div className="px-4 py-3 text-sm" role="alert" style={{ color: "var(--color-text-secondary)" }}>
                            Notifications could not be updated. <button type="button" className="underline font-semibold" onClick={fetchNotifications}>Retry</button>
                        </div>
                    )}
                    {loadingNotif && !notifications.length ? (
                        <p className="px-4 py-8 text-sm text-center" style={{ color: "var(--color-text-muted)" }}>Loading notifications…</p>
                    ) : !notifications.length && !notificationError ? (
                        <div className="px-4 py-8 text-center" style={{ color: "var(--color-text-muted)" }}>
                            <HiOutlineBell className="w-8 h-8 mx-auto mb-2" />
                            <p className="text-sm">No notifications yet</p>
                        </div>
                    ) : (
                        <NotificationItems items={notifications} role={role} onRead={handleMarkAsRead} onNavigate={() => setNotificationOpen(false)} />
                    )}
                </div>
            )}

            {/* Logout Confirmation */}
            <ConfirmDialog
                open={logoutConfirm}
                title="Confirm Logout"
                message="Are you sure you want to log out?"
                confirmText="Confirm"
                cancelText="Cancel"
                variant="danger"
                onConfirm={handleLogout}
                onCancel={() => setLogoutConfirm(false)}
            />

            {/* Chatbot — floating AI assistant */}
            <Chatbot />
        </div>
    );
}
