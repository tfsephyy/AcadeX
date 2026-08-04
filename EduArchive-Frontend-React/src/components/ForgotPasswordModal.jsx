import { useState, useEffect, useRef } from 'react';
import { HiOutlineX, HiOutlineMail, HiOutlineKey, HiOutlineShieldCheck, HiOutlineCheckCircle } from 'react-icons/hi';
import { sendForgotPasswordCode, verifyResetCode, resetPassword } from '../api/admin';

export default function ForgotPasswordModal({ open, onClose }) {
    const [step, setStep] = useState(1); // 1=email, 2=code+password, 3=success
    const [email, setEmail] = useState('');
    const [code, setCode] = useState('');
    const [password, setPassword] = useState('');
    const [passwordConfirmation, setPasswordConfirmation] = useState('');
    const [showPwd, setShowPwd] = useState(false);
    const [showConfirmPwd, setShowConfirmPwd] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [resendCooldown, setResendCooldown] = useState(0);
    const intervalRef = useRef(null);

    // Cleanup interval on unmount
    useEffect(() => {
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, []);

    // Cooldown timer
    useEffect(() => {
        if (resendCooldown > 0) {
            intervalRef.current = setInterval(() => {
                setResendCooldown(prev => {
                    if (prev <= 1) {
                        clearInterval(intervalRef.current);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
            return () => clearInterval(intervalRef.current);
        }
    }, [resendCooldown]);

    if (!open) return null;

    const resetState = () => {
        setStep(1);
        setEmail('');
        setCode('');
        setPassword('');
        setPasswordConfirmation('');
        setShowPwd(false);
        setShowConfirmPwd(false);
        setError('');
        setResendCooldown(0);
    };

    const handleClose = () => {
        resetState();
        onClose();
    };

    const handleSendCode = async () => {
        if (!email.trim()) {
            setError('Please enter your email address.');
            return;
        }
        setLoading(true);
        setError('');
        try {
            await sendForgotPasswordCode(email.toLowerCase());
            setStep(2);
            setResendCooldown(60);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to send verification code.');
        } finally {
            setLoading(false);
        }
    };

    const handleResendCode = async () => {
        if (resendCooldown > 0) return;
        setLoading(true);
        setError('');
        try {
            await sendForgotPasswordCode(email.toLowerCase());
            setResendCooldown(60);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to resend code.');
        } finally {
            setLoading(false);
        }
    };

    // Password validation
    const passwordChecks = {
        minLength: password.length >= 8,
        hasUpper: /[A-Z]/.test(password),
        hasLower: /[a-z]/.test(password),
        hasNumber: /\d/.test(password),
        matches: password === passwordConfirmation && password.length > 0,
    };

    const handleResetPassword = async () => {
        if (!code.trim()) {
            setError('Please enter the verification code.');
            return;
        }
        if (!Object.values(passwordChecks).every(Boolean)) {
            setError('Please meet all password requirements.');
            return;
        }
        setLoading(true);
        setError('');
        try {
            await resetPassword({
                email: email.toLowerCase(),
                code,
                password,
                password_confirmation: passwordConfirmation,
            });
            setStep(3);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to reset password.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />
            <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden animate-scale-in">
                {/* Header */}
                <div className="bg-[#1B5E20] px-6 py-4 flex items-center justify-between">
                    <h2 className="text-white font-semibold text-lg flex items-center gap-2">
                        {step === 1 && <><HiOutlineMail className="w-5 h-5" /> Forgot Password</>}
                        {step === 2 && <><HiOutlineKey className="w-5 h-5" /> Verify & Reset</>}
                        {step === 3 && <><HiOutlineCheckCircle className="w-5 h-5" /> Success</>}
                    </h2>
                    <button onClick={handleClose} className="text-white/70 hover:text-white transition-colors">
                        <HiOutlineX className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 space-y-5">
                    {error && (
                        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">
                            {error}
                        </div>
                    )}

                    {/* Step 1: Enter Email */}
                    {step === 1 && (
                        <>
                            <p className="text-sm text-gray-600">
                                Enter your email address and we'll send you a verification code to reset your password.
                            </p>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSendCode()}
                                    placeholder="Enter your email"
                                    className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all"
                                />
                            </div>
                            <button
                                onClick={handleSendCode}
                                disabled={loading}
                                className="w-full py-3 bg-[#1B5E20] text-white font-semibold rounded-xl hover:bg-green-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {loading && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                                {loading ? 'Sending...' : 'Send Verification Code'}
                            </button>
                        </>
                    )}

                    {/* Step 2: Enter Code + New Password */}
                    {step === 2 && (
                        <>
                            <p className="text-sm text-gray-600">
                                A verification code was sent to <strong className="text-gray-800">{email}</strong>.
                            </p>

                            {/* Verification Code */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Verification Code</label>
                                <input
                                    type="text"
                                    value={code}
                                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                                    placeholder="Enter 7-character code"
                                    maxLength={7}
                                    className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none font-mono text-center text-lg tracking-[0.3em] uppercase transition-all"
                                />
                                <div className="flex justify-end mt-2">
                                    <button
                                        onClick={handleResendCode}
                                        disabled={resendCooldown > 0 || loading}
                                        className="text-xs text-green-700 hover:text-green-900 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
                                    >
                                        {resendCooldown > 0
                                            ? `Resend code in ${resendCooldown}s`
                                            : "Didn't receive the code? Resend"
                                        }
                                    </button>
                                </div>
                            </div>

                            {/* New Password */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                                <div className="relative">
                                    <input
                                        type={showPwd ? 'text' : 'password'}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="Enter new password"
                                        className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPwd(!showPwd)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                    >
                                        {showPwd ? (
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
                                </div>

                                {/* Password requirements */}
                                {password.length > 0 && (
                                    <div className="mt-2 space-y-1">
                                        <PasswordCheck ok={passwordChecks.minLength} label="At least 8 characters" />
                                        <PasswordCheck ok={passwordChecks.hasUpper} label="One uppercase letter" />
                                        <PasswordCheck ok={passwordChecks.hasLower} label="One lowercase letter" />
                                        <PasswordCheck ok={passwordChecks.hasNumber} label="One number" />
                                    </div>
                                )}
                            </div>

                            {/* Confirm Password */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
                                <div className="relative">
                                    <input
                                        type={showConfirmPwd ? 'text' : 'password'}
                                        value={passwordConfirmation}
                                        onChange={(e) => setPasswordConfirmation(e.target.value)}
                                        placeholder="Confirm new password"
                                        className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowConfirmPwd(!showConfirmPwd)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                    >
                                        {showConfirmPwd ? (
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
                                </div>
                                {passwordConfirmation.length > 0 && !passwordChecks.matches && (
                                    <p className="text-xs text-red-500 mt-1">Passwords do not match.</p>
                                )}
                            </div>

                            <button
                                onClick={handleResetPassword}
                                disabled={loading}
                                className="w-full py-3 bg-[#1B5E20] text-white font-semibold rounded-xl hover:bg-green-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {loading && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                                {loading ? 'Resetting...' : 'Reset Password'}
                            </button>
                        </>
                    )}

                    {/* Step 3: Success */}
                    {step === 3 && (
                        <div className="text-center py-4">
                            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <HiOutlineCheckCircle className="w-10 h-10 text-green-600" />
                            </div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-2">Password Reset Successfully!</h3>
                            <p className="text-sm text-gray-600 mb-6">
                                You can now sign in with your new password.
                            </p>
                            <button
                                onClick={handleClose}
                                className="w-full py-3 bg-[#1B5E20] text-white font-semibold rounded-xl hover:bg-green-800 transition-colors"
                            >
                                Back to Sign In
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function PasswordCheck({ ok, label }) {
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
