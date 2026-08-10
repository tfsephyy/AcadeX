import { useState, useEffect, useRef } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import {
    HiOutlineBookOpen,
    HiOutlineMenu,
    HiOutlineX,
    HiOutlineLogout,
    HiOutlineUser,
    HiChevronDown,
} from 'react-icons/hi';
import ConfirmDialog from '../ConfirmDialog';
import Chatbot from '../Chatbot';

const navItems = [
    { to: '/student/uploads', label: 'Uploaded Capstones', icon: HiOutlineBookOpen },
];

export default function StudentLayout({ children }) {
    const [sidebarOpen, setSidebarOpen]       = useState(false);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [profileOpen, setProfileOpen]       = useState(false);
    const [logoutConfirm, setLogoutConfirm]   = useState(false);
    const { user, logout } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const navigate   = useNavigate();
    const profileRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (profileOpen && profileRef.current && !profileRef.current.contains(e.target)) {
                setProfileOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [profileOpen]);

    const handleLogout = async () => {
        setLogoutConfirm(false);
        setProfileOpen(false);
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
                              style={{ color: 'var(--panel-profile-muted)' }}>Student</span>
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

                {/* Profile section */}
                <div ref={profileRef} className="px-3 py-3 relative panel-profile-border">
                    <button
                        onClick={() => setProfileOpen(!profileOpen)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 panel-profile-btn"
                    >
                        <div
                            className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 text-white"
                            style={{ background: 'var(--color-primary)', aspectRatio: '1/1' }}
                        >
                            {user?.name?.charAt(0)?.toUpperCase() || 'S'}
                        </div>
                        <div className="flex-1 text-left min-w-0">
                            <p className="text-sm font-semibold truncate"
                               style={{ color: 'var(--panel-profile-text)' }}>
                                {user?.name || 'Student'}
                            </p>
                            <p className="text-xs truncate"
                               style={{ color: 'var(--panel-profile-muted)' }}>
                                {user?.email}
                            </p>
                        </div>
                        <HiChevronDown
                            className={`w-4 h-4 transition-transform shrink-0 ${profileOpen ? 'rotate-180' : ''}`}
                            style={{ color: 'var(--panel-profile-muted)' }}
                        />
                    </button>

                    {/* Dropdown */}
                    {profileOpen && (
                        <div className="absolute bottom-full left-3 right-3 mb-1 rounded-xl overflow-hidden z-10 panel-dropdown">
                            <button
                                onClick={() => { setProfileOpen(false); navigate('/student/profile'); }}
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
