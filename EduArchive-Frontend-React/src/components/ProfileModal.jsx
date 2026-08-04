import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { updateProfile } from '../api/admin';
import { useNotification } from './Notification';
import ChangePasswordModal from './ChangePasswordModal';
import ChangeEmailModal from './ChangeEmailModal';
import {
    HiOutlineUser, HiOutlineMail, HiOutlineIdentification,
    HiOutlineAcademicCap, HiOutlineKey, HiOutlineX,
    HiOutlineShieldCheck, HiOutlinePencil
} from 'react-icons/hi';

export default function ProfileModal({ open, onClose }) {
    const { user, setUser } = useAuth();
    const notify = useNotification();
    const [changePwdOpen, setChangePwdOpen] = useState(false);
    const [changeEmailOpen, setChangeEmailOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // General editing state
    const [editing, setEditing] = useState(false);
    const [form, setForm] = useState({ 
        name: user?.name || '', 
        username: user?.username || '',
        program: user?.program || ''
    });
    const [currentPassword, setCurrentPassword] = useState('');

    // Reset form on modal close
    useEffect(() => {
        if (!open) {
            setForm({ 
                name: user?.name || '', 
                username: user?.username || '',
                program: user?.program || ''
            });
            setCurrentPassword('');
            setError('');
            setEditing(false);
        }
    }, [open, user]);

    const handleGeneralSave = async () => {
        if (!currentPassword) {
            setError('Please enter your current password to save changes.');
            return;
        }
        setLoading(true);
        setError('');
        try {
            const res = await updateProfile({ ...form, current_password: currentPassword });
            if (res.data?.data?.user) {
                setUser(res.data.data.user);
            }
            notify.success('Profile updated successfully.');
            setEditing(false);
            setCurrentPassword('');
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to update profile.');
        } finally {
            setLoading(false);
        }
    };

    if (!open) return null;

    // Build profile fields
    const studentProfile = user?.student_profile;
    const profileFields = [
        { label: 'Full Name', value: user?.name, icon: HiOutlineUser, editable: true, key: 'name' },
        { label: 'Email', value: user?.email?.toLowerCase(), icon: HiOutlineMail },
        { label: 'Username', value: user?.username, icon: HiOutlineIdentification, editable: true, key: 'username' },
        { label: 'Role', value: user?.role, icon: user?.role === 'student' ? HiOutlineAcademicCap : HiOutlineShieldCheck },
        ...(studentProfile ? [
            { label: 'Program', value: studentProfile?.program, icon: HiOutlineAcademicCap },
            { label: 'Year Level', value: studentProfile?.year ? `Year ${studentProfile.year}` : null, icon: HiOutlineAcademicCap },
            { label: 'Section', value: studentProfile?.section, icon: HiOutlineAcademicCap },
        ] : []),
        ...(user?.role === 'faculty' ? [
            { label: 'Program', value: user.program, icon: HiOutlineAcademicCap, editable: true, key: 'program' },
        ] : []),
    ];

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto custom-scrollbar flex flex-col">
                {/* Header */}
                <div className="sticky top-0 bg-gradient-to-r from-[#1B5E20] to-[#2E7D32] px-6 py-6 flex items-center justify-between shrink-0">
                    <div>
                        <h2 className="text-2xl font-bold text-white">My Profile</h2>
                        <p className="text-green-200 text-sm mt-1">Manage your account settings</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                    >
                        <HiOutlineX className="w-6 h-6 text-white" />
                    </button>
                </div>

                {/* Avatar section */}
                <div className="border-b border-gray-100 px-6 py-6 shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 bg-[#8BC34A] rounded-full flex items-center justify-center text-2xl font-bold text-white shadow-lg" style={{ aspectRatio: '1 / 1' }}>
                            {user?.name?.charAt(0) || '?'}
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-gray-900">{user?.name}</h3>
                            <p className="text-sm text-gray-500 capitalize">{user?.role} Account</p>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="px-6 py-6 overflow-y-auto custom-scrollbar flex-1">
                    {error && (
                        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">
                            {error}
                        </div>
                    )}

                    <div className="space-y-4">
                        <div className="divide-y divide-gray-100">
                            {profileFields.map((field, idx) => (
                                <div key={idx} className="flex items-center gap-4 py-4 first:pt-0 last:pb-0">
                                    <div className="p-2 bg-green-50 rounded-lg shrink-0">
                                        <field.icon className="w-5 h-5 text-green-600" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-semibold text-gray-500 uppercase">{field.label}</p>
                                        {editing && field.editable ? (
                                            <input
                                                type="text"
                                                value={form[field.key] || ''}
                                                onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
                                                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-800 focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                                            />
                                        ) : (
                                            <p className={`text-sm font-medium break-all ${field.label === 'Email' ? 'text-gray-800 lowercase' : 'text-gray-800 capitalize'}`}>{field.value || '—'}</p>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {editing && (
                            <div className="mt-6 pt-4 border-t border-gray-100">
                                <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">
                                    Current Password (required to save)
                                </label>
                                <input
                                    type="password"
                                    value={currentPassword}
                                    onChange={(e) => setCurrentPassword(e.target.value)}
                                    placeholder="Enter your password"
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                                />
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="sticky bottom-0 bg-gray-50 border-t border-gray-100 px-6 py-4 flex gap-2 justify-end shrink-0">
                    <button
                        onClick={() => setChangePwdOpen(true)}
                        className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors flex items-center gap-2"
                    >
                        <HiOutlineKey className="w-4 h-4" /> Change Password
                    </button>
                    <button
                        onClick={() => setChangeEmailOpen(true)}
                        className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors flex items-center gap-2"
                    >
                        <HiOutlineMail className="w-4 h-4" /> Change Email
                    </button>
                    {editing && (
                        <>
                            <button
                                onClick={() => {
                                    setForm({ name: user?.name || '', username: user?.username || '' });
                                    setCurrentPassword('');
                                    setError('');
                                    setEditing(false);
                                }}
                                className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleGeneralSave}
                                disabled={loading}
                                className="px-4 py-2 text-sm font-medium text-white bg-[#1B5E20] rounded-lg hover:bg-green-800 disabled:opacity-50 transition-colors"
                            >
                                {loading ? 'Saving...' : 'Save Changes'}
                            </button>
                        </>
                    )}
                    {!editing && (
                        <button
                            onClick={() => setEditing(true)}
                            className="px-4 py-2 text-sm font-medium text-white bg-[#1B5E20] rounded-lg hover:bg-green-800 transition-colors flex items-center gap-2"
                        >
                            <HiOutlinePencil className="w-4 h-4" /> Edit Profile
                        </button>
                    )}
                </div>

                {/* Change Password Modal */}
                <ChangePasswordModal open={changePwdOpen} onClose={() => setChangePwdOpen(false)} />

                {/* Change Email Modal */}
                <ChangeEmailModal open={changeEmailOpen} onClose={() => setChangeEmailOpen(false)} />
            </div>
        </div>
    );
}
