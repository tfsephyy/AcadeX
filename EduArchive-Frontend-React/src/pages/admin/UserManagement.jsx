import { useState, useEffect, useRef, useCallback } from 'react';
import { HiOutlineUserAdd, HiOutlineAcademicCap, HiOutlineBriefcase, HiOutlineEye, HiOutlineCheck, HiOutlineX, HiOutlineTrash, HiOutlineSearch, HiOutlineGlobe, HiOutlineWifi } from 'react-icons/hi';
import { HiOutlineArchiveBoxArrowDown, HiOutlineArchiveBoxXMark } from 'react-icons/hi2';
import { getNewUsers, getStudents, getFaculty, getVisitors, approveUser, denyUser, removeUser, archiveUser, unarchiveUser, getArchivedUsers, getOnlineUsers } from '../../api/admin';
import { useNotification } from '../../components/Notification';
import ConfirmDialog from '../../components/ConfirmDialog';
import Loading, { TableSkeleton } from '../../components/Loading';
import EmptyState from '../../components/EmptyState';
import Modal from '../../components/Modal';

export default function UserManagement() {
    const notify = useNotification();
    const [activeTab, setActiveTab] = useState('new');
    const [newUsers, setNewUsers] = useState([]);
    const [students, setStudents] = useState([]);
    const [faculty, setFaculty] = useState([]);
    const [visitors, setVisitors] = useState([]);
    const [archivedList, setArchivedList] = useState([]);
    const [onlineUsers, setOnlineUsers] = useState([]);
    const [newTotal, setNewTotal] = useState(0);
    const [studentsTotal, setStudentsTotal] = useState(0);
    const [facultyTotal, setFacultyTotal] = useState(0);
    const [visitorsTotal, setVisitorsTotal] = useState(0);
    const [archivedTotal, setArchivedTotal] = useState(0);
    const [onlineTotal, setOnlineTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [viewUser, setViewUser] = useState(null);
    const [confirm, setConfirm] = useState({ open: false, title: '', message: '', action: null, variant: 'danger' });

    // Search & filter
    const [search, setSearch] = useState('');
    const [roleFilter, setRoleFilter] = useState('');
    const [programFilter, setProgramFilter] = useState('');
    const searchTimer = useRef(null);
    const [debouncedSearch, setDebouncedSearch] = useState('');

    useEffect(() => {
        clearTimeout(searchTimer.current);
        searchTimer.current = setTimeout(() => setDebouncedSearch(search), 350);
        return () => clearTimeout(searchTimer.current);
    }, [search]);

    useEffect(() => {
        fetchTotals();
    }, []);

    useEffect(() => {
        fetchTabData();
    }, [activeTab, debouncedSearch, roleFilter, programFilter]);

    const fetchTotals = async () => {
        try {
            const [newRes, stuRes, facRes, visRes, archRes] = await Promise.all([
                getNewUsers({ per_page: 1 }),
                getStudents({ per_page: 1 }),
                getFaculty({ per_page: 1 }),
                getVisitors({ per_page: 1 }),
                getArchivedUsers({ per_page: 1 }),
            ]);
            setNewTotal(newRes.data.data?.total ?? 0);
            setStudentsTotal(stuRes.data.data?.total ?? 0);
            setFacultyTotal(facRes.data.data?.total ?? 0);
            setVisitorsTotal(visRes.data.data?.total ?? 0);
            setArchivedTotal(archRes.data.data?.total ?? 0);
        } catch {}
    };

    const fetchTabData = useCallback(async () => {
        try {
            setLoading(true);
            const params = { per_page: 100 };
            if (debouncedSearch) params.search = debouncedSearch;

            if (activeTab === 'new') {
                if (roleFilter) params.role = roleFilter;
                const res = await getNewUsers(params);
                const data = res.data.data;
                setNewUsers(data?.data || data || []);
            } else if (activeTab === 'students') {
                if (programFilter) params.program = programFilter;
                const res = await getStudents(params);
                const data = res.data.data;
                setStudents(data?.data || data || []);
            } else if (activeTab === 'faculty') {
                const res = await getFaculty(params);
                const data = res.data.data;
                let list = data?.data || data || [];
                if (programFilter) list = list.filter(u => u.faculty_program === programFilter);
                setFaculty(list);
            } else if (activeTab === 'visitors') {
                const res = await getVisitors(params);
                const data = res.data.data;
                setVisitors(data?.data || data || []);
            } else if (activeTab === 'archived') {
                const res = await getArchivedUsers(params);
                const data = res.data.data;
                setArchivedList(data?.data || data || []);
            } else if (activeTab === 'online') {
                const res = await getOnlineUsers(params);
                const data = res.data.data;
                const list = Array.isArray(data) ? data : [];
                setOnlineUsers(list);
                setOnlineTotal(list.length);
            }
        } catch (err) {
            notify.error('Failed to fetch users.');
        } finally {
            setLoading(false);
        }
    }, [activeTab, debouncedSearch, roleFilter, programFilter]);

    const refreshAll = () => { fetchTotals(); fetchTabData(); };

    const handleAcceptUser = (user) => {
        setConfirm({
            open: true,
            title: 'Accept User',
            message: `Accept "${user.name}" as ${user.role?.name || 'user'}?`,
            variant: 'success',
            action: async () => {
                try {
                    await approveUser(user.id);
                    notify.success('User accepted!');
                    refreshAll();
                } catch (err) {
                    notify.error('Failed to accept user.');
                }
                setConfirm(prev => ({ ...prev, open: false }));
            },
        });
    };

    const handleDenyUser = (user) => {
        setConfirm({
            open: true,
            title: 'Deny User',
            message: `Deny and remove "${user.name}"? This action cannot be undone.`,
            variant: 'danger',
            action: async () => {
                try {
                    await denyUser(user.id);
                    notify.success('User denied and removed.');
                    refreshAll();
                } catch (err) {
                    notify.error('Failed to deny user.');
                }
                setConfirm(prev => ({ ...prev, open: false }));
            },
        });
    };

    const handleArchiveUser = (user) => {
        setConfirm({
            open: true,
            title: 'Archive Account',
            message: `Archive "${user.name}"? You can restore them later from the Archive tab.`,
            variant: 'warning',
            action: async () => {
                try {
                    await archiveUser(user.id);
                    notify.success('User archived successfully.');
                    refreshAll();
                } catch (err) {
                    notify.error('Failed to archive user.');
                }
                setConfirm(prev => ({ ...prev, open: false }));
            },
        });
    };

    const handleUnarchiveUser = (user) => {
        setConfirm({
            open: true,
            title: 'Restore Account',
            message: `Restore "${user.name}" to active users?`,
            variant: 'info',
            action: async () => {
                try {
                    await unarchiveUser(user.id);
                    notify.success('User restored successfully.');
                    refreshAll();
                } catch (err) {
                    notify.error('Failed to restore user.');
                }
                setConfirm(prev => ({ ...prev, open: false }));
            },
        });
    };

    const handleDeleteUser = (user) => {
        setConfirm({
            open: true,
            title: 'Delete Account Permanently',
            message: `Permanently delete "${user.name}"'s account? This action cannot be undone.`,
            variant: 'danger',
            action: async () => {
                try {
                    await removeUser(user.id);
                    notify.success('User account permanently deleted.');
                    refreshAll();
                } catch (err) {
                    notify.error('Failed to delete user.');
                }
                setConfirm(prev => ({ ...prev, open: false }));
            },
        });
    };

    const tabs = [
        { id: 'new',      label: 'New Users', icon: HiOutlineUserAdd,            count: newTotal },
        { id: 'students', label: 'Students',  icon: HiOutlineAcademicCap,        count: studentsTotal },
        { id: 'faculty',  label: 'Faculty',   icon: HiOutlineBriefcase,          count: facultyTotal },
        { id: 'visitors', label: 'Visitors',  icon: HiOutlineGlobe,              count: visitorsTotal },
        { id: 'online',   label: 'Online',    icon: HiOutlineWifi,               count: onlineTotal,  dot: true },
        { id: 'archived', label: 'Archive',   icon: HiOutlineArchiveBoxArrowDown, count: archivedTotal },
    ];

    const currentList = activeTab === 'new' ? newUsers
        : activeTab === 'students' ? students
        : activeTab === 'faculty'  ? faculty
        : activeTab === 'visitors' ? visitors
        : activeTab === 'online'   ? onlineUsers
        : archivedList;

    return (
        <div className="flex flex-col h-full">
            {/* ── Sticky Header ── */}
            <div className="sticky top-0 z-40 bg-gray-50 pb-4 space-y-4 -mx-4 lg:-mx-8 px-4 lg:px-8 -mt-4 lg:-mt-8 pt-4 lg:pt-8 border-b border-gray-200 shadow-sm">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
                    <p className="text-sm text-gray-500 mt-1">Manage system users and registrations</p>
                </div>

                {/* Tabs */}
                <div className="flex gap-2 border-b border-gray-200">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => { setActiveTab(tab.id); setSearch(''); setRoleFilter(''); setProgramFilter(''); }}
                            className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px
                                ${activeTab === tab.id
                                    ? 'border-green-600 text-green-700'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                }`}
                        >
                            <tab.icon className="w-4 h-4" />
                            {tab.label}
                            {tab.dot && tab.count > 0 ? (
                                <span className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-emerald-100 text-emerald-700">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                    {tab.count}
                                </span>
                            ) : (
                                <span className={`px-2 py-0.5 text-xs font-medium rounded-full
                                    ${activeTab === tab.id ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                    {tab.count}
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                {/* Search & Filter */}
                <div className="flex flex-col sm:flex-row gap-2">
                    <div className="relative flex-1">
                        <HiOutlineSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search by name, email, or ID number..."
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 bg-white focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                        />
                    </div>
                    {activeTab === 'new' && (
                        <select
                            value={roleFilter}
                            onChange={(e) => setRoleFilter(e.target.value)}
                            className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                        >
                            <option value="">All Roles</option>
                            <option value="student">Student</option>
                            <option value="faculty">Faculty</option>
                            <option value="visitor">Visitor</option>
                        </select>
                    )}
                    {(activeTab === 'students' || activeTab === 'faculty') && (
                        <select
                            value={programFilter}
                            onChange={(e) => setProgramFilter(e.target.value)}
                            className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                        >
                            <option value="">All Programs</option>
                            <option value="BSIT">BSIT</option>
                            <option value="BSCpE">BSCpE</option>
                        </select>
                    )}
                    {/* hide search bar on online tab — data is live */}
                </div>
            </div>

            {/* ── Content ── */}
            <div className="flex-1 min-h-0 pt-10">
            {loading ? (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                    <TableSkeleton rows={5} cols={4} />
                </div>
            ) : currentList.length === 0 ? (
                <EmptyState
                    title={
                    activeTab === 'new'      ? 'No new registrations'
                  : activeTab === 'students' ? 'No students'
                  : activeTab === 'faculty'  ? 'No faculty'
                  : activeTab === 'visitors' ? 'No visitors'
                  : activeTab === 'online'   ? 'No users online'
                  : 'No archived users'
                }
                description={
                    debouncedSearch || roleFilter || programFilter
                        ? 'Try adjusting your search or filter.'
                        : activeTab === 'new'      ? 'New user registrations will appear here.'
                        : activeTab === 'students' ? 'Approved students will appear here.'
                        : activeTab === 'faculty'  ? 'Approved faculty members will appear here.'
                        : activeTab === 'visitors' ? 'Approved visitors will appear here.'
                        : activeTab === 'online'   ? 'Users who are active will show up here.'
                        : 'Archived users will appear here.'
                }
                icon={
                    activeTab === 'archived' ? <HiOutlineArchiveBoxArrowDown className="w-12 h-12" />
                  : activeTab === 'online'   ? <HiOutlineWifi className="w-12 h-12" />
                  : activeTab === 'new'      ? <HiOutlineUserAdd className="w-12 h-12" />
                  : activeTab === 'students' ? <HiOutlineAcademicCap className="w-12 h-12" />
                  : activeTab === 'visitors' ? <HiOutlineGlobe className="w-12 h-12" />
                  : <HiOutlineBriefcase className="w-12 h-12" />
                }
                />
            ) : (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col overflow-hidden" style={{ maxHeight: 'calc(100vh - 18rem)' }}>
                    <div className="overflow-auto custom-scrollbar">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 border-b border-gray-100 sticky top-0 z-10">
                                {activeTab === 'new' && (
                                    <tr>
                                        <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Name</th>
                                        <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Role</th>
                                        <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Date Registered</th>
                                        <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Actions</th>
                                    </tr>
                                )}
                                {activeTab === 'students' && (
                                    <tr>
                                        <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Name</th>
                                        <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Program</th>
                                        <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Year &amp; Section</th>
                                        <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Actions</th>
                                    </tr>
                                )}
                                {activeTab === 'faculty' && (
                                    <tr>
                                        <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Name</th>
                                        <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Program</th>
                                        <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Actions</th>
                                    </tr>
                                )}
                                {activeTab === 'visitors' && (
                                    <tr>
                                        <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Name</th>
                                        <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Email</th>
                                        <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Registered</th>
                                        <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Actions</th>
                                    </tr>
                                )}
                                {activeTab === 'archived' && (
                                    <tr>
                                        <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Name</th>
                                        <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Role</th>
                                        <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Archived Date</th>
                                        <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Actions</th>
                                    </tr>
                                )}
                                {activeTab === 'online' && (
                                    <tr>
                                        <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">User</th>
                                        <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Role</th>
                                        <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Last Active</th>
                                        <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Status</th>
                                    </tr>
                                )}
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {currentList.map((user) => (
                                    <tr key={user.id} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="py-3 px-4">
                                            <p className="font-medium text-gray-800">{user.name}</p>
                                            <p className="text-xs text-gray-400">{user.email}</p>
                                        </td>
                                        {activeTab === 'new' && (
                                            <>
                                                <td className="py-3 px-4">
                                                    <span className="px-2.5 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded-full capitalize">
                                                        {user.role?.name}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4 text-gray-500">{new Date(user.created_at).toLocaleDateString()}</td>
                                            </>
                                        )}
                                        {activeTab === 'students' && (
                                            <>
                                                <td className="py-3 px-4 text-gray-600">{user.student_profile?.program || '—'}</td>
                                                <td className="py-3 px-4 text-gray-600">
                                                    {user.student_profile ? `Year ${user.student_profile.year} - Section ${user.student_profile.section}` : '—'}
                                                </td>
                                            </>
                                        )}
                                        {activeTab === 'faculty' && (
                                            <td className="py-3 px-4 text-gray-600">{user.faculty_program || '—'}</td>
                                        )}
                                        {activeTab === 'online' && (() => {
                                            const roleColors = { student: 'bg-blue-100 text-blue-700', faculty: 'bg-purple-100 text-purple-700', visitor: 'bg-teal-100 text-teal-700', admin: 'bg-red-100 text-red-700' };
                                            const lastActive = user.last_active_at ? new Date(user.last_active_at) : null;
                                            const diffMs = lastActive ? Date.now() - lastActive.getTime() : null;
                                            const diffSec = diffMs !== null ? Math.floor(diffMs / 1000) : null;
                                            const lastSeenLabel = diffSec === null ? '—'
                                                : diffSec < 60   ? 'Just now'
                                                : diffSec < 3600 ? `${Math.floor(diffSec / 60)}m ago`
                                                : `${Math.floor(diffSec / 3600)}h ago`;
                                            return (
                                                <>
                                                    <td className="py-3 px-4">
                                                        <span className={`px-2.5 py-0.5 text-xs font-medium rounded-full capitalize ${roleColors[user.role] || 'bg-gray-100 text-gray-600'}`}>
                                                            {user.role}
                                                        </span>
                                                    </td>
                                                    <td className="py-3 px-4 text-gray-500 text-xs">{lastSeenLabel}</td>
                                                    <td className="py-3 px-4">
                                                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                                                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                                            Online
                                                        </span>
                                                    </td>
                                                </>
                                            );
                                        })()}
                                        {activeTab === 'visitors' && (
                                            <>
                                                <td className="py-3 px-4 text-gray-500 text-xs">{user.email}</td>
                                                <td className="py-3 px-4 text-gray-500">{new Date(user.created_at).toLocaleDateString()}</td>
                                            </>
                                        )}
                                        {activeTab === 'archived' && (
                                            <>
                                                <td className="py-3 px-4">
                                                    <span className="px-2.5 py-0.5 text-xs font-medium bg-gray-100 text-gray-600 rounded-full capitalize">
                                                        {user.role?.name}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4 text-gray-500">{new Date(user.updated_at).toLocaleDateString()}</td>
                                            </>
                                        )}
                                        <td className="py-3 px-4">
                                            <div className="flex items-center justify-end gap-2">
                                                <button onClick={() => setViewUser(user)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="View">
                                                    <HiOutlineEye className="w-4 h-4" />
                                                </button>
                                                {activeTab === 'new' && (
                                                    <>
                                                        <button onClick={() => handleAcceptUser(user)} className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors" title="Accept">
                                                            <HiOutlineCheck className="w-4 h-4" />
                                                        </button>
                                                        <button onClick={() => handleDenyUser(user)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Deny">
                                                            <HiOutlineX className="w-4 h-4" />
                                                        </button>
                                                    </>
                                                )}
                                                {(activeTab === 'students' || activeTab === 'faculty' || activeTab === 'visitors') && (
                                                    <button onClick={() => handleArchiveUser(user)} className="p-1.5 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors" title="Archive">
                                                        <HiOutlineArchiveBoxArrowDown className="w-4 h-4" />
                                                    </button>
                                                )}
                                                {activeTab === 'archived' && (
                                                    <>
                                                        <button onClick={() => handleUnarchiveUser(user)} className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors" title="Restore">
                                                            <HiOutlineArchiveBoxXMark className="w-4 h-4" />
                                                        </button>
                                                        <button onClick={() => handleDeleteUser(user)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete Permanently">
                                                            <HiOutlineTrash className="w-4 h-4" />
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
            </div>

            {/* User Detail Modal */}
            <Modal open={!!viewUser} onClose={() => setViewUser(null)} title="User Details" size="md">
                {viewUser && (() => {
                    const roleName = viewUser.role?.name;
                    const roleColors = {
                        admin:   'bg-red-100 text-red-700',
                        faculty: 'bg-purple-100 text-purple-700',
                        student: 'bg-blue-100 text-blue-700',
                        visitor: 'bg-teal-100 text-teal-700',
                    };
                    const avatarColors = {
                        admin:   'bg-red-100 text-red-700',
                        faculty: 'bg-purple-100 text-purple-700',
                        student: 'bg-blue-100 text-blue-700',
                        visitor: 'bg-teal-100 text-teal-700',
                    };
                    return (
                        <div className="space-y-4">
                            <div className="flex items-center gap-4">
                                <div className={`w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold ${avatarColors[roleName] || 'bg-green-100 text-green-700'}`}>
                                    {viewUser.name?.charAt(0)}
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold text-gray-900">{viewUser.name}</h3>
                                    <span className={`inline-block mt-0.5 px-2.5 py-0.5 text-xs font-semibold rounded-full capitalize ${roleColors[roleName] || 'bg-gray-100 text-gray-600'}`}>
                                        {roleName}
                                    </span>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-100">
                                <DetailField label="Email" value={viewUser.email} />
                                <DetailField label="Username" value={viewUser.username} />
                                <DetailField label="ID Number" value={viewUser.id_number || '—'} />
                                <DetailField label="Registered" value={new Date(viewUser.created_at).toLocaleDateString()} />
                                {viewUser.student_profile && (
                                    <>
                                        <DetailField label="Program" value={viewUser.student_profile.program} />
                                        <DetailField label="Year Level" value={`Year ${viewUser.student_profile.year}`} />
                                        <DetailField label="Section" value={viewUser.student_profile.section} />
                                    </>
                                )}
                                {viewUser.faculty_program && (
                                    <DetailField label="Faculty Program" value={viewUser.faculty_program} />
                                )}
                                {roleName === 'visitor' && (
                                    <div className="col-span-2">
                                        <p className="text-xs text-teal-600 bg-teal-50 border border-teal-200 rounded-lg px-3 py-2">
                                            🌐 This user registered as a <strong>Visitor</strong> — they can browse published research without academic credentials.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })()}
            </Modal>

            <ConfirmDialog
                open={confirm.open}
                title={confirm.title}
                message={confirm.message}
                variant={confirm.variant}
                onConfirm={confirm.action}
                onCancel={() => setConfirm(prev => ({ ...prev, open: false }))}
            />
        </div>
    );
}

function DetailField({ label, value }) {
    return (
        <div>
            <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">{label}</label>
            <p className="text-sm text-gray-800">{value || '—'}</p>
        </div>
    );
}