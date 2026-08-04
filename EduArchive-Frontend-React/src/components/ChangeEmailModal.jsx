import { useState, useEffect, useRef } from 'react';
import { HiOutlineX, HiOutlineMail, HiOutlineCheckCircle } from 'react-icons/hi';
import { useAuth } from '../context/AuthContext';
import { updateProfile, sendVerificationCode, verifyEmailCode } from '../api/admin';
import { useNotification } from './Notification';

export default function ChangeEmailModal({ open, onClose }) {
    const { user, setUser } = useAuth();
    const notify = useNotification();
    const [currentPassword, setCurrentPassword] = useState('');
    const [newEmail, setNewEmail] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    
    // Email verification state
    const [emailCodeSent, setEmailCodeSent] = useState(false);
    const [emailCode, setEmailCode] = useState('');
    const [emailSending, setEmailSending] = useState(false);
    const [emailVerifying, setEmailVerifying] = useState(false);
    const [resendCooldown, setResendCooldown] = useState(0);
    const intervalRef = useRef(null);

    // Resend cooldown timer
    useEffect(() => {
        if (resendCooldown > 0) {
            intervalRef.current = setInterval(() => {
                setResendCooldown(prev => {
                    if (prev <= 1) {
                        clearInterval(intervalRef.current);
                        return 0;
                    }
                    return prev - 1;
                })
            }, 1000);
            return () => clearInterval(intervalRef.current);
        }
    }, [resendCooldown]);

    useEffect(() => {
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        }
    }, []);

    if (!open) return null;

    const resetState = () => {
        setCurrentPassword('');
        setNewEmail('');
        setShowPassword(false);
        setError('');
        setSuccess(false);
        setEmailCodeSent(false);
        setEmailCode('');
        setEmailSending(false);
        setEmailVerifying(false);
        setResendCooldown(0);
    };

    const handleClose = () => {
        resetState();
        onClose();
    };

    const handleSendEmailCode = async () => {
        if (!newEmail.trim()) {
            setError('Please enter your new email address.');
            return;
        }
        if (newEmail.toLowerCase() === user?.email?.toLowerCase()) {
            setError('New email must be different from current email.');
            return;
        }
        
        setEmailSending(true);
        setError('');
        try {
            await sendVerificationCode(newEmail.toLowerCase());
            setEmailCodeSent(true);
            setResendCooldown(60);
            notify.success('Verification code sent to your new email.');
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to send verification code.');
        } finally {
            setEmailSending(false);
        }
    };

    const handleVerifyAndChangeEmail = async () => {
        if (!currentPassword) {
            setError('Please enter your current password.');
            return;
        }
        if (!emailCode.trim()) {
            setError('Please enter the verification code.');
            return;
        }

        setEmailVerifying(true);
        setError('');
        try {
            // Verify the code first
            await verifyEmailCode({ email: newEmail.toLowerCase(), code: emailCode });
            
            // Update email with verification code
            const res = await updateProfile({
                email: newEmail.toLowerCase(),
                current_password: currentPassword,
                email_code: emailCode,
            });
            
            if (res.data?.data?.user) {
                setUser(res.data.data.user);
                setSuccess(true);
                notify.success('Email changed successfully!');
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to change email.');
        } finally {
            setEmailVerifying(false);
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
            <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden animate-scale-in flex flex-col max-h-[90vh]">
                <div className="bg-[#1B5E20] px-6 py-4 flex items-center justify-between">
                    <h2 className="text-white font-semibold text-lg flex items-center gap-2">
                        <HiOutlineMail className="w-5 h-5" /> Change Email
                    </h2>
                    <button onClick={handleClose} className="text-white/70 hover:text-white transition-colors">
                        <HiOutlineX className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 space-y-5 overflow-y-auto custom-scrollbar flex-1">
                    {error && (
                        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">{error}</div>
                    )}

                    {success ? (
                        <div className="text-center py-4">
                            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <HiOutlineCheckCircle className="w-10 h-10 text-green-600" />
                            </div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-2">Email Changed!</h3>
                            <p className="text-sm text-gray-600 mb-6">Your email has been updated successfully.</p>
                            <button onClick={handleClose} className="w-full py-3 bg-[#1B5E20] text-white font-semibold rounded-xl hover:bg-green-800 transition-colors">
                                Done
                            </button>
                        </div>
                    ) : (
                        <>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Current Email</label>
                                <input
                                    type="email"
                                    value={user?.email || ''}
                                    disabled
                                    className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm bg-gray-50 text-gray-600"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">New Email</label>
                                <input
                                    type="email"
                                    value={newEmail}
                                    onChange={(e) => setNewEmail(e.target.value)}
                                    placeholder="Enter your new email"
                                    disabled={emailCodeSent}
                                    className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none disabled:bg-gray-50"
                                />
                                {emailCodeSent && (
                                    <button
                                        onClick={() => {
                                            setNewEmail('');
                                            setEmailCode('');
                                            setEmailCodeSent(false);
                                            setError('');
                                        }}
                                        className="mt-2 text-xs text-[#1B5E20] hover:underline"
                                    >
                                        Use a different email
                                    </button>
                                )}
                            </div>

                            {!emailCodeSent ? (
                                <button
                                    onClick={handleSendEmailCode}
                                    disabled={emailSending || !newEmail.trim()}
                                    className="w-full py-3 bg-[#1B5E20] text-white font-semibold rounded-xl hover:bg-green-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {emailSending && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                                    {emailSending ? 'Sending Code...' : 'Send Verification Code'}
                                </button>
                            ) : (
                                <>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Verification Code</label>
                                        <input
                                            type="text"
                                            value={emailCode}
                                            onChange={(e) => setEmailCode(e.target.value)}
                                            placeholder="Enter code from your email"
                                            className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                                        />
                                        <button
                                            onClick={handleSendEmailCode}
                                            disabled={resendCooldown > 0 || emailSending}
                                            className="mt-2 text-xs text-[#1B5E20] hover:underline disabled:text-gray-400 disabled:cursor-not-allowed"
                                        >
                                            {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Didn't receive code? Resend"}
                                        </button>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
                                        <div className="relative">
                                            <input
                                                type={showPassword ? 'text' : 'password'}
                                                value={currentPassword}
                                                onChange={(e) => setCurrentPassword(e.target.value)}
                                                placeholder="Enter your current password"
                                                className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                                            />
                                            <EyeButton show={showPassword} toggle={() => setShowPassword(!showPassword)} />
                                        </div>
                                    </div>

                                    <button
                                        onClick={handleVerifyAndChangeEmail}
                                        disabled={emailVerifying || !emailCode.trim() || !currentPassword.trim()}
                                        className="w-full py-3 bg-[#1B5E20] text-white font-semibold rounded-xl hover:bg-green-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                    >
                                        {emailVerifying && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                                        {emailVerifying ? 'Verifying...' : 'Confirm Email Change'}
                                    </button>
                                </>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
