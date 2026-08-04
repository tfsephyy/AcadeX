import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { updateProfile } from '../../api/admin';
import { useNotification } from '../../components/Notification';
import ChangePasswordModal from '../../components/ChangePasswordModal';
import { HiOutlineUser, HiOutlineMail, HiOutlineIdentification, HiOutlineAcademicCap, HiOutlinePencil, HiOutlineKey } from 'react-icons/hi';

export default function StudentProfile() {
    const { user, setUser } = useAuth();
    const notify = useNotification();
    const [editing, setEditing] = useState(false);
    const [changePwdOpen, setChangePwdOpen] = useState(false);
    const [form, setForm] = useState({ name: user?.name || '', username: user?.username || '' });
    const [currentPassword, setCurrentPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSave = async () => {
        if (!currentPassword) {
            setError('Please enter your current password to save changes.');
            return;
        }
        setLoading(true);
        setError('');
        try {
            const res = await updateProfile({ ...form, current_password: currentPassword });
            if (res.data?.data?.user) setUser(res.data.data.user);
            notify.success('Profile updated successfully.');
            setEditing(false);
            setCurrentPassword('');
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to update profile.');
        } finally {
            setLoading(false);
        }
    };

    const handleCancel = () => {
        setForm({ name: user?.name || '', username: user?.username || '' });
        setCurrentPassword('');
        setError('');
        setEditing(false);
    };

    // Build fields — students have extra profile info
    const studentProfile = user?.student_profile;
    const profileFields = [
        { label: 'Full Name', value: user?.name, icon: HiOutlineUser, editable: true, key: 'name' },
        { label: 'Email', value: user?.email, icon: HiOutlineMail },
        { label: 'Username', value: user?.username, icon: HiOutlineIdentification, editable: true, key: 'username' },
        { label: 'Role', value: user?.role, icon: HiOutlineAcademicCap },
        ...(studentProfile ? [
            { label: 'Program', value: studentProfile?.program, icon: HiOutlineAcademicCap },
            { label: 'Year Level', value: studentProfile?.year ? `Year ${studentProfile.year}` : null, icon: HiOutlineAcademicCap },
            { label: 'Section', value: studentProfile?.section, icon: HiOutlineAcademicCap },
        ] : []),
    ];

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Profile</h1>
                    <p className="text-sm text-gray-500 mt-1">Your student account details</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => setChangePwdOpen(true)}
                        className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2">
                        <HiOutlineKey className="w-4 h-4" /> Change Password
                    </button>
                    {!editing && (
                        <button onClick={() => setEditing(true)}
                            className="px-4 py-2 text-sm font-medium text-white bg-[#1B5E20] rounded-lg hover:bg-green-800 transition-colors flex items-center gap-2">
                            <HiOutlinePencil className="w-4 h-4" /> Edit Profile
                        </button>
                    )}
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="bg-gradient-to-r from-[#1B5E20] to-[#2E7D32] px-6 py-8">
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 bg-[#8BC34A] rounded-full flex items-center justify-center text-2xl font-bold text-white shadow-lg" style={{ aspectRatio: '1 / 1' }}>
                            {user?.name?.charAt(0) || 'S'}
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">{user?.name}</h2>
                            <p className="text-green-200 text-sm capitalize">{user?.role} Account</p>
                        </div>
                    </div>
                </div>

                <div className="divide-y divide-gray-100">
                    {profileFields.map((field, idx) => (
                        <div key={idx} className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50 transition-colors">
                            <div className="p-2 bg-green-50 rounded-lg">
                                <field.icon className="w-5 h-5 text-green-600" />
                            </div>
                            <div className="flex-1">
                                <p className="text-xs font-semibold text-gray-500 uppercase">{field.label}</p>
                                {editing && field.editable ? (
                                    <input type="text" value={form[field.key]}
                                        onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
                                        className="mt-0.5 w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-800 focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none" />
                                ) : (
                                    <p className="text-sm font-medium text-gray-800 capitalize">{field.value || '—'}</p>
                                )}
                            </div>
                        </div>
                    ))}

                    {editing && (
                        <div className="px-6 py-4 space-y-3">
                            {error && <div className="p-2 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">{error}</div>}
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Current Password (required)</label>
                                <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)}
                                    placeholder="Enter current password to confirm changes"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-800 focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none" />
                            </div>
                            <div className="flex justify-end gap-2">
                                <button onClick={handleCancel} className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">Cancel</button>
                                <button onClick={handleSave} disabled={loading}
                                    className="px-4 py-2 text-sm font-medium text-white bg-[#1B5E20] rounded-lg hover:bg-green-800 transition-colors disabled:opacity-50 flex items-center gap-2">
                                    {loading && <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                                    Save Changes
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <ChangePasswordModal open={changePwdOpen} onClose={() => setChangePwdOpen(false)} />
        </div>
    );
}
