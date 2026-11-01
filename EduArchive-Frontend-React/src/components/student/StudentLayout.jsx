import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/useAuth';
import { useTheme } from '../../context/useTheme';
import {
    HiOutlineBookOpen,
    HiOutlineLibrary,
    HiOutlineMenu,
    HiOutlineLogout,
    HiOutlineUser,
    HiChevronDown,
} from 'react-icons/hi';
import ConfirmDialog from '../ConfirmDialog';
import Chatbot from '../Chatbot';
import WorkspaceSidebar from '../WorkspaceSidebar';

const navItems = [
    { to: '/student/uploads', label: 'Uploaded Capstones', icon: HiOutlineBookOpen },
    { to: '/student/capstone-library', label: 'My Capstone Library', icon: HiOutlineLibrary },
];

export default function StudentLayout({ children }) {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [profileOpen, setProfileOpen] = useState(false);
    const [logoutConfirm, setLogoutConfirm] = useState(false);
    const { user, logout } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const navigate = useNavigate();
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
        <div className="app-shell flex overflow-hidden panel-content-bg">
            <a className="skip-link" href="#workspace-content">Skip to content</a>
            <WorkspaceSidebar role="Student" items={navItems} open={sidebarOpen} collapsed={sidebarCollapsed}
                onOpenChange={setSidebarOpen} onCollapsedChange={setSidebarCollapsed}>
                {/* Profile section */}
                <div ref={profileRef} className="sidebar-account px-3 py-3 relative panel-profile-border">
                    <button
                        aria-label="Account menu" aria-expanded={profileOpen} onKeyDown={e => { if (e.key === 'Escape') setProfileOpen(false); }} onClick={() => setProfileOpen(!profileOpen)}
                        title="Account menu" className="sidebar-account-trigger w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors panel-profile-btn"
                    >
                        <div
                            className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 text-white"
                            style={{ background: 'var(--color-primary)', aspectRatio: '1/1' }}
                        >
                            {user?.name?.charAt(0)?.toUpperCase() || 'S'}
                        </div>
                        <div className="sidebar-account-copy flex-1 text-left min-w-0">
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
                            className={`sidebar-account-chevron w-4 h-4 transition-transform shrink-0 ${profileOpen ? 'rotate-180' : ''}`}
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
