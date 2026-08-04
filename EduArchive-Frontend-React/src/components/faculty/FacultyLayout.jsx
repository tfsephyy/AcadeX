import { useState, useEffect, useRef } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
    HiOutlineLibrary,
    HiOutlineBookOpen,
    HiOutlineMenu,
    HiOutlineX,
    HiOutlineLogout,
    HiOutlineUser,
    HiChevronDown,
} from 'react-icons/hi';
import ConfirmDialog from '../ConfirmDialog';
import ProfileModal from './../../components/ProfileModal';

const navItems = [
    { to: '/faculty/capstone-library', label: 'Capstone Library', icon: HiOutlineLibrary },
    { to: '/faculty/uploads', label: 'Uploaded Capstones', icon: HiOutlineBookOpen },
];

export default function FacultyLayout({ children }) {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [profileOpen, setProfileOpen] = useState(false);
    const [profileModalOpen, setProfileModalOpen] = useState(false);
    const [logoutConfirm, setLogoutConfirm] = useState(false);
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const profileRef = useRef(null);

    // Click outside to close profile dropdown
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
        <div className="flex h-screen bg-white overflow-hidden">
            {/* Mobile overlay */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside className={`
                fixed lg:static inset-y-0 left-0 z-50
                w-64 flex flex-col
                bg-[#1B5E20] text-white
                transform transition-transform duration-300 ease-in-out
                ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
            `}>
                {/* Logo — matches Login page */}
                <div className="flex items-center gap-3 px-6 py-5 border-b border-green-800">
                    <div className="w-10 h-10 bg-[#8BC34A] rounded-lg flex items-center justify-center shrink-0">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-[#0f2f1b]" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M4 6H2v14a2 2 0 002 2h14v-2H4V6zm16-4H8a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V4a2 2 0 00-2-2zm-1 9H9V9h10v2zm-4 4H9v-2h6v2zm4-8H9V5h10v2z" />
                        </svg>
                    </div>
                    <div>
                        <h1 className="font-bold text-lg leading-tight">
                            Edu<span className="text-[#8BC34A]">Archive</span>
                        </h1>
                        <span className="text-[10px] text-green-300 uppercase tracking-widest">Faculty Panel</span>
                    </div>
                    <button className="lg:hidden ml-auto" onClick={() => setSidebarOpen(false)}>
                        <HiOutlineX className="w-5 h-5" />
                    </button>
                </div>

                {/* Navigation */}
                <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
                    {navItems.map((item) => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            onClick={() => setSidebarOpen(false)}
                            className={({ isActive }) => `
                                flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200
                                ${isActive
                                    ? 'bg-[#8BC34A] text-white shadow-md'
                                    : 'text-green-100 hover:bg-green-800 hover:text-white'
                                }
                            `}
                        >
                            <item.icon className="w-5 h-5 shrink-0" />
                            {item.label}
                        </NavLink>
                    ))}
                </nav>

                {/* Profile section */}
                <div ref={profileRef} className="px-3 pb-4 relative">
                    <button
                        onClick={() => setProfileOpen(!profileOpen)}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-green-800 transition-colors"
                    >
                        <div className="w-9 h-9 bg-[#8BC34A] rounded-full flex items-center justify-center text-sm font-bold shrink-0" style={{ aspectRatio: '1 / 1' }}>
                            {user?.name?.charAt(0) || 'F'}
                        </div>
                        <div className="flex-1 text-left">
                            <p className="text-sm font-medium truncate">{user?.name || 'Faculty'}</p>
                            <p className="text-xs text-green-300 truncate">{user?.email}</p>
                        </div>
                        <HiChevronDown className={`w-4 h-4 transition-transform ${profileOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {/* Dropdown */}
                    {profileOpen && (
                        <div className="absolute bottom-full left-3 right-3 mb-1 bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden z-10">
                            <button
                                onClick={() => { setProfileOpen(false); setProfileModalOpen(true); }}
                                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50"
                            >
                                <HiOutlineUser className="w-4 h-4" />
                                Profile
                            </button>
                            <button
                                onClick={() => { setProfileOpen(false); setLogoutConfirm(true); }}
                                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-600 hover:bg-red-50 border-t border-gray-100"
                            >
                                <HiOutlineLogout className="w-4 h-4" />
                                Logout
                            </button>
                        </div>
                    )}
                </div>
            </aside>

            {/* Main content */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                {/* Top bar */}
                <header className="flex items-center gap-4 px-4 lg:px-8 py-3 bg-white border-b border-gray-200 shrink-0">
                    <button
                        className="lg:hidden p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                        onClick={() => setSidebarOpen(true)}
                    >
                        <HiOutlineMenu className="w-5 h-5" />
                    </button>
                    <div className="flex-1" />
                    <span className="text-sm text-gray-500 hidden sm:block">
                        Welcome, <span className="font-medium text-gray-700">{user?.name}</span>
                    </span>
                </header>

                {/* Page content */}
                <main className="flex-1 overflow-y-auto bg-gray-50 p-4 lg:p-8 admin-scroll">
                    {children}
                </main>
            </div>

            {/* Profile Modal */}
            <ProfileModal open={profileModalOpen} onClose={() => setProfileModalOpen(false)} />

            {/* Logout Confirmation Modal */}
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
