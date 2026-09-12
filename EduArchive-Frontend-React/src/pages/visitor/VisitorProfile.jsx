import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { updateProfile } from '../../api/admin';
import { useNotification } from '../../components/Notification';
import ChangePasswordModal from '../../components/ChangePasswordModal';
import { HiOutlineUser, HiOutlineMail, HiOutlinePencil, HiOutlineKey } from 'react-icons/hi';

export default function VisitorProfile() {
    const { user, setUser } = useAuth();
    const notify = useNotification();
    const [editing, setEditing]               = useState(false);
    const [changePwdOpen, setChangePwdOpen]   = useState(false);
    const [form, setForm]                     = useState({ name: user?.name || '', username: user?.username || '' });
    const [currentPassword, setCurrentPassword] = useState('');
    const [loading, setLoading]               = useState(false);
    const [error, setError]                   = useState('');

    const handleSave = async () => {
        if (!currentPassword) { setError('Please enter your current password to save changes.'); return; }
        setLoading(true); setError('');
        try {
            const res = await updateProfile({ ...form, current_password: currentPassword });
            if (res.data?.data?.user) setUser(res.data.data.user);
            notify.success('Profile updated successfully.');
            setEditing(false); setCurrentPassword('');
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to update profile.');
        } finally { setLoading(false); }
    };

    const handleCancel = () => {
        setForm({ name: user?.name || '', username: user?.username || '' });
        setCurrentPassword(''); setError(''); setEditing(false);
    };

    return (
        <div className="max-w-xl mx-auto space-y-6">
            <ChangePasswordModal open={changePwdOpen} onClose={() => setChangePwdOpen(false)} />

            <div>
                <h1 className="text-3xl font-bold" style={{ color: 'var(--color-text)' }}>My Profile</h1>
                <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>Manage your visitor account information.</p>
            </div>

            {/* Avatar + role */}
            <div className="flex items-center gap-5 p-5 rounded-2xl border shadow-sm"
                style={{ background: 'var(--color-bg-secondary)', borderColor: 'var(--color-border)' }}>
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-bold text-white flex-shrink-0"
                    style={{ background: 'var(--color-primary)' }}>
                    {user?.name?.charAt(0)?.toUpperCase() || 'V'}
                </div>
                <div>
                    <p className="text-lg font-bold" style={{ color: 'var(--color-text)' }}>{user?.name}</p>
                    <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{user?.email}</p>
                    <span className="mt-1 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold uppercase border bg-cyan-50 text-cyan-700 border-cyan-200">
                        Visitor
                    </span>
                </div>
            </div>

            {/* Edit form */}
            <div className="rounded-2xl border shadow-sm overflow-hidden"
                style={{ background: 'var(--color-bg-secondary)', borderColor: 'var(--color-border)' }}>
                <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
                    <h2 className="font-semibold" style={{ color: 'var(--color-text)' }}>Personal Information</h2>
                    {!editing && (
                        <button onClick={() => setEditing(true)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors hover:bg-gray-50"
                            style={{ color: 'var(--color-text)', borderColor: 'var(--color-border)' }}>
                            <HiOutlinePencil className="w-4 h-4" /> Edit
                        </button>
                    )}
                </div>
                <div className="p-5 space-y-4">
                    <ProfileField icon={<HiOutlineUser className="w-4 h-4" />} label="Full Name"
                        editing={editing} value={form.name}
                        onChange={v => setForm(p => ({ ...p, name: v }))} />
                    <ProfileField icon={<HiOutlineUser className="w-4 h-4" />} label="Username"
                        editing={editing} value={form.username}
                        onChange={v => setForm(p => ({ ...p, username: v }))} />
                    <div className="flex items-center gap-3">
                        <span className="text-gray-400 flex-shrink-0"><HiOutlineMail className="w-4 h-4" /></span>
                        <div className="flex-1">
                            <label className="text-[11px] font-semibold text-gray-400 uppercase block mb-0.5">Email</label>
                            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{user?.email}</p>
                        </div>
                    </div>

                    {editing && (
                        <>
                            <div>
                                <label className="text-[11px] font-semibold text-gray-400 uppercase block mb-1">Current Password (required to save)</label>
                                <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)}
                                    className="w-full px-3 py-2 text-sm border rounded-lg outline-none focus:ring-2 focus:ring-green-500"
                                    style={{ background: 'var(--color-bg-tertiary)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
                                    placeholder="Enter current password" />
                            </div>
                            {error && <p className="text-sm text-red-600">{error}</p>}
                            <div className="flex gap-3 pt-2">
                                <button onClick={handleSave} disabled={loading}
                                    className="flex-1 py-2 text-sm font-semibold rounded-lg bg-[#1B5E20] text-white hover:bg-green-800 transition-colors disabled:opacity-60">
                                    {loading ? 'Saving…' : 'Save Changes'}
                                </button>
                                <button onClick={handleCancel} className="flex-1 py-2 text-sm font-semibold rounded-lg border transition-colors hover:bg-gray-50"
                                    style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}>
                                    Cancel
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Change Password */}
            <div className="rounded-2xl border shadow-sm p-5 flex items-center justify-between"
                style={{ background: 'var(--color-bg-secondary)', borderColor: 'var(--color-border)' }}>
                <div className="flex items-center gap-3">
                    <HiOutlineKey className="w-5 h-5 text-gray-400" />
                    <div>
                        <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>Password</p>
                        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Update your account password</p>
                    </div>
                </div>
                <button onClick={() => setChangePwdOpen(true)}
                    className="px-4 py-2 text-sm font-medium rounded-lg bg-[#1B5E20] text-white hover:bg-green-800 transition-colors">
                    Change
                </button>
            </div>
        </div>
    );
}

function ProfileField({ icon, label, editing, value, onChange }) {
    return (
        <div className="flex items-center gap-3">
            <span className="text-gray-400 flex-shrink-0">{icon}</span>
            <div className="flex-1">
                <label className="text-[11px] font-semibold text-gray-400 uppercase block mb-0.5">{label}</label>
                {editing ? (
                    <input value={value} onChange={e => onChange(e.target.value)}
                        className="w-full px-3 py-1.5 text-sm border rounded-lg outline-none focus:ring-2 focus:ring-green-500"
                        style={{ background: 'var(--color-bg-tertiary)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }} />
                ) : (
                    <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>{value || '—'}</p>
                )}
            </div>
        </div>
    );
}
