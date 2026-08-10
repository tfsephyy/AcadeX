import { useState, useEffect, useRef } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import {
    HiOutlineViewGrid,
    HiOutlineUsers,
    HiOutlineBookOpen,
    HiOutlineLibrary,
    HiOutlineMenu,
    HiOutlineX,
    HiOutlineLogout,
    HiOutlineUser,
    HiChevronDown,
    HiOutlineBell,
    HiOutlineClipboardList,
} from 'react-icons/hi';
import ConfirmDialog from '../ConfirmDialog';
import { getAdminNotifications, getUnreadNotificationCount, markNotificationRead, markAllNotificationsRead } from '../../api/admin';

const navItems = [
    { to: '/admin/dashboard',      label: 'Dashboard',         icon: HiOutlineViewGrid },
    { to: '/admin/users',          label: 'User Management',   icon: HiOutlineUsers },
    { to: '/admin/capstone-library',label: 'Capstone Library', icon: HiOutlineLibrary },
    { to: '/admin/published',      label: 'Uploaded Capstones',icon: HiOutlineBookOpen },
    { to: '/admin/activity-logs',  label: 'Activity Logs',     icon: HiOutlineClipboardList },
];

export default function AdminLayout({ children }) {
    const [sidebarOpen, setSidebarOpen]           = useState(false);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [profileOpen, setProfileOpen]           = useState(false);
    const [notificationOpen, setNotificationOpen] = useState(false);
    const [logoutConfirm, setLogoutConfirm]       = useState(false);
    const [notifications, setNotifications]       = useState([]);
    const [unreadCount, setUnreadCount]           = useState(0);
    const [loadingNotif, setLoadingNotif]         = useState(false);
    const { user, logout } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const navigate = useNavigate();

    const profileAreaRef  = useRef(null);
    const notifDropdownRef = useRef(null);
    const bellRef          = useRef(null);

    useEffect(() => { fetchNotifications(); }, []);

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
            const res   = await getAdminNotifications({ per_page: 15 });
            const data  = res.data?.data?.data || res.data?.data || [];
            setNotifications(Array.isArray(data) ? data : []);
            const cRes  = await getUnreadNotificationCount();
            setUnreadCount(cRes.data?.data?.unread_count || 0);
        } catch {
            // silent
        } finally {
            setLoadingNotif(false);
        }
    };

    const handleMarkAsRead = async (id) => {
        try {
            await markNotificationRead(id);
            setNotifications(notifications.map(n => n.id === id ? { ...n, is_read: true } : n));
            setUnreadCount(Math.max(0, unreadCount - 1));
        } catch { /* silent */ }
    };

    const handleMarkAllAsRead = async () => {
        try {
            await markAllNotificationsRead();
            setNotifications(notifications.map(n => ({ ...n, is_read: true })));
            setUnreadCount(0);
        } catch { /* silent */ }
    };

    const handleLogout = async () => {
        setLogoutConfirm(false);
        setProfileOpen(false);
        setNotificationOpen(false);
        await logout();
        navigate('/', { replace: true });
    };

    return (
        <div className="flex h-screen overflow-hidden panel-content-bg">
            {/* Mobile overlay */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 z-40 lg:hidden"
                    style={{ background: 'var(--panel-mobile-overlay, rgba(0,0,0,0.6))' }}
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* ── Sidebar ──────────────────────────────────────────── */}
            <aside className={`
                fixed lg:static inset-y-0 left-0 z-50
                flex flex-col flex-shrink-0
                panel-sidebar overflow-hidden
                transition-all duration-300 ease-in-out
                ${sidebarCollapsed ? 'lg:w-0' : 'lg:w-64'}
                ${sidebarOpen ? 'w-64 translate-x-0' : 'w-64 -translate-x-full lg:translate-x-0'}
            `}>
                {/* Logo */}
                <div className="flex items-center gap-3 px-6 py-5 panel-logo-border flex-shrink-0">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                         style={{ background: 'var(--panel-logo-icon-bg)' }}>
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24"
                             fill="var(--color-primary)">
                            <path d="M4 6H2v14a2 2 0 002 2h14v-2H4V6zm16-4H8a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V4a2 2 0 00-2-2zm-1 9H9V9h10v2zm-4 4H9v-2h6v2zm4-8H9V5h10v2z" />
                        </svg>
                    </div>
                    <div>
                        <h1 className="font-bold text-lg leading-tight"
                            style={{ color: 'var(--panel-profile-text)' }}>
                            Edu<span style={{ color: 'var(--color-primary)' }}>Archive</span>
                        </h1>
                        <span className="text-[10px] uppercase tracking-widest"
                              style={{ color: 'var(--panel-profile-muted)' }}>Admin</span>
                    </div>
                    <button
                        className="lg:hidden ml-auto p-1 rounded-lg panel-profile-btn transition-colors"
                        onClick={() => setSidebarOpen(false)}
                    >
                        <HiOutlineX className="w-5 h-5" />
                    </button>
                </div>

                {/* Navigation */}
                <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto panel-scroll">
                    {navItems.map((item) => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            onClick={() => setSidebarOpen(false)}
                            className={({ isActive }) =>
                                `flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                                    isActive ? 'panel-nav-active' : 'panel-nav-item'
                                }`
                            }
                        >
                            <item.icon className="w-5 h-5 shrink-0" />
                            {item.label}
                        </NavLink>
                    ))}
                </nav>

                {/* Profile + Bell row */}
                <div ref={profileAreaRef} className="relative px-3 py-3 panel-profile-border">
                    {/* Row */}
                    <div className="flex items-center gap-1 px-2 py-2 rounded-xl transition-colors panel-profile-btn">
                        {/* Avatar */}
                        <button
                            onClick={() => { setProfileOpen(!profileOpen); setNotificationOpen(false); }}
                            className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 text-white"
                            style={{ background: 'var(--color-primary)' }}
                        >
                            {user?.name?.charAt(0)?.toUpperCase() || 'A'}
                        </button>

                        {/* Name & email */}
                        <button
                            onClick={() => { setProfileOpen(!profileOpen); setNotificationOpen(false); }}
                            className="flex-1 text-left px-2 min-w-0"
                        >
                            <p className="text-sm font-semibold truncate"
                               style={{ color: 'var(--panel-profile-text)' }}>
                                {user?.name || 'Admin'}
                            </p>
                            <p className="text-xs truncate"
                               style={{ color: 'var(--panel-profile-muted)' }}>
                                {user?.email?.toLowerCase()}
                            </p>
                        </button>

                        {/* Bell */}
                        <button
                            ref={bellRef}
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
                            onClick={() => { setProfileOpen(!profileOpen); setNotificationOpen(false); }}
                            className="shrink-0 transition-colors"
                            style={{ color: 'var(--panel-profile-muted)' }}
                        >
                            <HiChevronDown className={`w-4 h-4 transition-transform ${profileOpen ? 'rotate-180' : ''}`} />
                        </button>
                    </div>

                    {/* Profile dropdown */}
                    {profileOpen && (
                        <div className="absolute bottom-full left-3 right-3 mb-1 rounded-xl overflow-hidden z-[100] panel-dropdown">
                            <button
                                onClick={() => { setProfileOpen(false); navigate('/admin/profile'); }}
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
            </aside>

            {/* ── Desktop sidebar toggle tab ───────────────────────── */}
            <button
                className="hidden lg:flex fixed top-4 z-[60] items-center justify-center w-5 h-10 rounded-r-lg shadow-lg transition-all duration-300 panel-arrow-tab"
                style={{ left: sidebarCollapsed ? 0 : '16rem' }}
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none"
                     viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    {sidebarCollapsed
                        ? <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        : <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    }
                </svg>
            </button>

            {/* ── Main content ─────────────────────────────────────── */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                {/* Top bar */}
                <header className="flex items-center gap-3 px-4 py-2.5 shrink-0 panel-header">
                    {/* Mobile hamburger */}
                    <button
                        className="lg:hidden p-2 rounded-lg transition-colors panel-topbar-btn"
                        onClick={() => setSidebarOpen(true)}
                    >
                        <HiOutlineMenu className="w-5 h-5" />
                    </button>

                    <div className="flex-1" />

                    {/* Theme toggle */}
                    <button
                        onClick={toggleTheme}
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
                <main className="flex-1 overflow-y-auto p-4 lg:p-8 admin-scroll panel-content-bg">
                    {children}
                </main>
            </div>

            {/* ── Notification dropdown (outside sidebar to avoid clip) */}
            {notificationOpen && (
                <div
                    ref={notifDropdownRef}
                    className={`fixed bottom-16 w-80 rounded-xl max-h-96 overflow-y-auto z-[9999] transition-all duration-300 panel-scroll panel-dropdown ${
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
                        {unreadCount > 0 && (
                            <button
                                onClick={handleMarkAllAsRead}
                                className="text-xs font-medium transition-colors"
                                style={{ color: 'var(--color-primary)' }}
                            >
                                Mark all as read
                            </button>
                        )}
                    </div>

                    {/* Body */}
                    {loadingNotif ? (
                        <div className="px-4 py-8 text-center">
                            <p className="text-sm" style={{ color: 'var(--panel-profile-muted)' }}>Loading…</p>
                        </div>
                    ) : notifications.length === 0 ? (
                        <div className="px-4 py-8 text-center">
                            <HiOutlineBell className="w-8 h-8 mx-auto mb-2"
                                           style={{ color: 'var(--panel-nav-text)' }} />
                            <p className="text-sm" style={{ color: 'var(--panel-profile-muted)' }}>
                                No notifications yet
                            </p>
                        </div>
                    ) : (
                        <div className="panel-notif-divide">
                            {notifications.map((notif) => (
                                <div
                                    key={notif.id}
                                    onClick={() => !notif.is_read && handleMarkAsRead(notif.id)}
                                    className={`px-4 py-3 cursor-pointer transition-colors ${
                                        notif.is_read ? 'panel-notif-read' : 'panel-notif-unread'
                                    }`}
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex-1">
                                            <p className={`text-sm ${notif.is_read ? '' : 'font-semibold'}`}
                                               style={{ color: notif.is_read
                                                   ? 'var(--panel-profile-muted)'
                                                   : 'var(--panel-dropdown-text)' }}>
                                                {notif.title}
                                            </p>
                                            <p className="text-xs mt-1 line-clamp-2"
                                               style={{ color: 'var(--panel-profile-muted)' }}>
                                                {notif.message}
                                            </p>
                                        </div>
                                        {!notif.is_read && (
                                            <span className="w-2 h-2 rounded-full mt-1.5 shrink-0"
                                                  style={{ background: 'var(--color-primary)' }} />
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
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
        </div>
    );
}
