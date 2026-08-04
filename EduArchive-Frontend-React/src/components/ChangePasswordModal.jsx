import { useState } from 'react';
import { HiOutlineX, HiOutlineKey, HiOutlineCheckCircle } from 'react-icons/hi';
import { changePassword } from '../api/admin';

export default function ChangePasswordModal({ open, onClose }) {
    const [currentPassword, setCurrentPassword] = useState('');
    const [password, setPassword] = useState('');
    const [passwordConfirmation, setPasswordConfirmation] = useState('');
    const [showCurrent, setShowCurrent] = useState(false);
    const [showNew, setShowNew] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    if (!open) return null;

    const passwordChecks = {
        minLength: password.length >= 8,
        hasUpper: /[A-Z]/.test(password),
        hasLower: /[a-z]/.test(password),
        hasNumber: /\d/.test(password),
        matches: password === passwordConfirmation && password.length > 0,
    };

    const resetState = () => {
        setCurrentPassword('');
        setPassword('');
        setPasswordConfirmation('');
        setShowCurrent(false);
        setShowNew(false);
        setShowConfirm(false);
        setError('');
        setSuccess(false);
    };

    const handleClose = () => {
        resetState();
        onClose();
    };

    const handleSubmit = async () => {
        if (!currentPassword) {
            setError('Please enter your current password.');
            return;
        }
        if (!Object.values(passwordChecks).every(Boolean)) {
            setError('Please meet all password requirements.');
            return;
        }
        setLoading(true);
        setError('');
        try {
            await changePassword({
                current_password: currentPassword,
                password,
                password_confirmation: passwordConfirmation,
            });
            setSuccess(true);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to change password.');
        } finally {
            setLoading(false);
        }
    };

    const EyeButton = ({ show, toggle }) => (
        <button type="button" onClick={toggle} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            {show ? (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                </svg>
            ) : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
            )}
        </button>
    );

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />
            <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden animate-scale-in">
                <div className="bg-[#1B5E20] px-6 py-4 flex items-center justify-between">
                    <h2 className="text-white font-semibold text-lg flex items-center gap-2">
                        <HiOutlineKey className="w-5 h-5" /> Change Password
                    </h2>
                    <button onClick={handleClose} className="text-white/70 hover:text-white transition-colors">
                        <HiOutlineX className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 space-y-5">
                    {error && (
                        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">{error}</div>
                    )}

                    {success ? (
                        <div className="text-center py-4">
                            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <HiOutlineCheckCircle className="w-10 h-10 text-green-600" />
                            </div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-2">Password Changed!</h3>
                            <p className="text-sm text-gray-600 mb-6">Your password has been updated successfully.</p>
                            <button onClick={handleClose} className="w-full py-3 bg-[#1B5E20] text-white font-semibold rounded-xl hover:bg-green-800 transition-colors">
                                Done
                            </button>
                        </div>
                    ) : (
                        <>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
                                <div className="relative">
                                    <input type={showCurrent ? 'text' : 'password'} value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="Enter current password"
                                        className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none" />
                                    <EyeButton show={showCurrent} toggle={() => setShowCurrent(!showCurrent)} />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                                <div className="relative">
                                    <input type={showNew ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter new password"
                                        className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none" />
                                    <EyeButton show={showNew} toggle={() => setShowNew(!showNew)} />
                                </div>
                                {password.length > 0 && (
                                    <div className="mt-2 space-y-1">
                                        <PwdCheck ok={passwordChecks.minLength} label="At least 8 characters" />
                                        <PwdCheck ok={passwordChecks.hasUpper} label="One uppercase letter" />
                                        <PwdCheck ok={passwordChecks.hasLower} label="One lowercase letter" />
                                        <PwdCheck ok={passwordChecks.hasNumber} label="One number" />
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
                                <div className="relative">
                                    <input type={showConfirm ? 'text' : 'password'} value={passwordConfirmation} onChange={(e) => setPasswordConfirmation(e.target.value)} placeholder="Confirm new password"
                                        className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none" />
                                    <EyeButton show={showConfirm} toggle={() => setShowConfirm(!showConfirm)} />
                                </div>
                                {passwordConfirmation.length > 0 && !passwordChecks.matches && (
                                    <p className="text-xs text-red-500 mt-1">Passwords do not match.</p>
                                )}
                            </div>

                            <button onClick={handleSubmit} disabled={loading}
                                className="w-full py-3 bg-[#1B5E20] text-white font-semibold rounded-xl hover:bg-green-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                                {loading && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                                {loading ? 'Changing...' : 'Change Password'}
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

function PwdCheck({ ok, label }) {
    return (
        <div className="flex items-center gap-2">
            <div className={`w-4 h-4 rounded-full flex items-center justify-center ${ok ? 'bg-green-100' : 'bg-gray-100'}`}>
                {ok ? (
                    <svg className="w-3 h-3 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                ) : (
                    <div className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                )}
            </div>
            <span className={`text-xs ${ok ? 'text-green-700' : 'text-gray-500'}`}>{label}</span>
        </div>
    );
}
