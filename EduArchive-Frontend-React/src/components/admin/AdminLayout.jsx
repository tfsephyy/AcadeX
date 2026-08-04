import { useState, useEffect, useRef } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
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
import ProfileModal from './../../components/ProfileModal';
import { getAdminNotifications, getUnreadNotificationCount, markNotificationRead, markAllNotificationsRead } from '../../api/admin';

const navItems = [
    { to: '/admin/dashboard', label: 'Dashboard', icon: HiOutlineViewGrid },
    { to: '/admin/users', label: 'User Management', icon: HiOutlineUsers },
    { to: '/admin/capstone-library', label: 'Capstone Library', icon: HiOutlineLibrary },
    { to: '/admin/published', label: 'Uploaded Capstones', icon: HiOutlineBookOpen },
    { to: '/admin/activity-logs', label: 'Activity Logs', icon: HiOutlineClipboardList },
];

export default function AdminLayout({ children }) {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [profileOpen, setProfileOpen] = useState(false);
    const [profileModalOpen, setProfileModalOpen] = useState(false);
    const [notificationOpen, setNotificationOpen] = useState(false);
    const [logoutConfirm, setLogoutConfirm] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loadingNotifications, setLoadingNotifications] = useState(false);
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const profileAreaRef = useRef(null);
    const notifDropdownRef = useRef(null);
    const bellRef = useRef(null);

    useEffect(() => {
        fetchNotifications();
    }, []);

    // Click outside handler
    useEffect(() => {
        const handleClickOutside = (e) => {
            // Close profile dropdown
            if (profileOpen && profileAreaRef.current && !profileAreaRef.current.contains(e.target)) {
                setProfileOpen(false);
            }
            // Close notification dropdown — check both the bell button and the dropdown panel
            if (notificationOpen) {
                const clickedBell = bellRef.current && bellRef.current.contains(e.target);
                const clickedDropdown = notifDropdownRef.current && notifDropdownRef.current.contains(e.target);
                if (!clickedBell && !clickedDropdown) {
                    setNotificationOpen(false);
                }
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [profileOpen, notificationOpen]);

    const fetchNotifications = async () => {
        try {
            setLoadingNotifications(true);
            const response = await getAdminNotifications({ per_page: 15 });
            // API returns: { data: { data: [...notifications], current_page, ... } }
            // response.data = { success, message, data: paginatorObj }
            // response.data.data = paginatorObj { data: [...], current_page, ... }
            // response.data.data.data = actual notifications array
            const notifData = response.data?.data?.data || response.data?.data || [];
            setNotifications(Array.isArray(notifData) ? notifData : []);
            const countResponse = await getUnreadNotificationCount();
            setUnreadCount(countResponse.data?.data?.unread_count || 0);
        } catch (error) {
            console.error('Failed to fetch notifications:', error);
        } finally {
            setLoadingNotifications(false);
        }
    };

    const handleMarkAsRead = async (notificationId) => {
        try {
            await markNotificationRead(notificationId);
            setNotifications(notifications.map(n =>
                n.id === notificationId ? { ...n, is_read: true } : n
            ));
            setUnreadCount(Math.max(0, unreadCount - 1));
        } catch (error) {
            console.error('Failed to mark notification as read:', error);
        }
    };

    const handleMarkAllAsRead = async () => {
        try {
            await markAllNotificationsRead();
            setNotifications(notifications.map(n => ({ ...n, is_read: true })));
            setUnreadCount(0);
        } catch (error) {
            console.error('Failed to mark all notifications as read:', error);
        }
    };

    const handleLogout = async () => {
        setLogoutConfirm(false);
        setProfileOpen(false);
        setNotificationOpen(false);
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
                {/* Logo */}
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
                        <span className="text-[10px] text-green-300 uppercase tracking-widest">Admin Panel</span>
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

                {/* Bottom: profile row with bell */}
                <div ref={profileAreaRef} className="relative px-3 pb-4 border-t border-green-800 pt-2">

                    {/* Row: [Avatar] [Name/Email] [🔔] [▼] */}
                    <div className="flex items-center gap-1 px-2 py-2 rounded-lg hover:bg-green-800 transition-colors">

                        {/* Avatar */}
                        <button
                            onClick={() => { setProfileOpen(!profileOpen); setNotificationOpen(false); }}
                            className="w-9 h-9 bg-[#8BC34A] rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                        >
                            {user?.name?.charAt(0) || 'A'}
                        </button>

                        {/* Name & email */}
                        <button
                            onClick={() => { setProfileOpen(!profileOpen); setNotificationOpen(false); }}
                            className="flex-1 text-left px-2 min-w-0"
                        >
                            <p className="text-sm font-medium text-white truncate">{user?.name || 'Admin'}</p>
                            <p className="text-xs text-green-300 truncate">{user?.email?.toLowerCase()}</p>
                        </button>

                        {/* Bell icon */}
                        <button
                            ref={bellRef}
                            onClick={() => { setNotificationOpen(!notificationOpen); setProfileOpen(false); }}
                            className="relative p-1.5 rounded-md text-green-200 hover:text-white hover:bg-green-700 transition-colors shrink-0"
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
                            className="shrink-0 text-green-200 hover:text-white transition-colors"
                        >
                            <HiChevronDown className={`w-4 h-4 transition-transform ${profileOpen ? 'rotate-180' : ''}`} />
                        </button>
                    </div>

                    {/* Profile dropdown — opens upward, inside sidebar */}
                    {profileOpen && (
                        <div className="absolute bottom-full left-3 right-3 mb-1 bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden z-[100]">
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

            {/* ═══ NOTIFICATION DROPDOWN ═══ rendered OUTSIDE sidebar to avoid clipping */}
            {notificationOpen && (
                <div
                    ref={notifDropdownRef}
                    className="fixed bottom-16 left-[17rem] w-80 bg-white rounded-lg shadow-2xl border border-gray-200 max-h-96 overflow-y-auto z-[9999]"
                    style={{ maxWidth: 'calc(100vw - 2rem)' }}
                >
                    <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white rounded-t-lg">
                        <div>
                            <span className="font-semibold text-gray-900">Notifications</span>
                            {unreadCount > 0 && (
                                <span className="ml-2 inline-block bg-red-100 text-red-700 text-xs font-medium px-2 py-0.5 rounded-full">
                                    {unreadCount}
                                </span>
                            )}
                        </div>
                        {unreadCount > 0 && (
                            <button onClick={handleMarkAllAsRead} className="text-xs text-blue-600 hover:text-blue-700 font-medium">
                                Mark all as read
                            </button>
                        )}
                    </div>
                    {loadingNotifications ? (
                        <div className="px-4 py-8 text-center text-gray-500">
                            <p className="text-sm">Loading...</p>
                        </div>
                    ) : notifications.length === 0 ? (
                        <div className="px-4 py-8 text-center text-gray-500">
                            <HiOutlineBell className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                            <p className="text-sm">No notifications yet</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-100">
                            {notifications.map((notif) => (
                                <div
                                    key={notif.id}
                                    onClick={() => !notif.is_read && handleMarkAsRead(notif.id)}
                                    className={`px-4 py-3 cursor-pointer transition-colors ${notif.is_read ? 'bg-white hover:bg-gray-50' : 'bg-blue-50 hover:bg-blue-100'}`}
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex-1">
                                            <p className={`text-sm ${notif.is_read ? 'text-gray-600' : 'font-medium text-gray-900'}`}>
                                                {notif.title}
                                            </p>
                                            <p className="text-xs text-gray-500 mt-1 line-clamp-2">{notif.message}</p>
                                        </div>
                                        {!notif.is_read && (
                                            <span className="w-2 h-2 bg-blue-500 rounded-full mt-1.5 shrink-0"></span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Profile Modal */}
            <ProfileModal open={profileModalOpen} onClose={() => setProfileModalOpen(false)} />

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
