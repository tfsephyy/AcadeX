import { useEffect, useRef } from 'react';
import { loginWithGoogle } from '../api/admin';
import { getApiErrorMessage } from '../api/errors';

/**
 * Google Identity Services button. The credential is sent to the server, which
 * verifies it with Google before trusting the email or identity. This component
 * never trusts profile data from the browser or requests the user's password.
 */
export default function GoogleButton({ mode = 'signin', onSuccess, onError, disabled = false, className = '' }) {
    const containerRef = useRef(null);
    const gisRef = useRef(null);
    const callbacksRef = useRef({ onSuccess, onError });

    useEffect(() => {
        callbacksRef.current = { onSuccess, onError };
    }, [onSuccess, onError]);

    useEffect(() => {
        let cancelled = false;
        const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

        if (!clientId || !containerRef.current) return;

        const render = () => {
            if (cancelled || !window.google?.accounts?.id || !containerRef.current || gisRef.current) return;

            gisRef.current = window.google.accounts.id;
            gisRef.current.initialize({
                client_id: clientId,
                callback: async (response) => {
                    const credential = response?.credential;
                    if (!credential) {
                        callbacksRef.current.onError?.('Google did not return a credential. Try again.');
                        return;
                    }

                    // Registration needs the verified ID token after the user
                    // completes their role/profile fields. Do not call the
                    // existing-account login endpoint from the signup button.
                    if (mode === 'signup' || mode === 'link') {
                        callbacksRef.current.onSuccess?.({ credential });
                        return;
                    }

                    try {
                        const res = await loginWithGoogle({ credential });
                        callbacksRef.current.onSuccess?.(res.data.data);
                    } catch (error) {
                        callbacksRef.current.onError?.(getApiErrorMessage(error, 'Google sign-in could not be completed.'));
                    }
                },
                ux_mode: 'popup',
            });
            gisRef.current.renderButton(containerRef.current, {
                theme: 'outline',
                size: 'large',
                text: mode === 'signup' ? 'signup_with' : (mode === 'link' ? 'continue_with' : 'signin_with'),
                width: Math.max(120, Math.min(368, Math.floor(containerRef.current.clientWidth || 368))),
            });
        };

        if (window.google) {
            render();
        } else {
            const existing = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
            if (!existing) {
                const script = document.createElement('script');
                script.src = 'https://accounts.google.com/gsi/client';
                script.async = true;
                script.defer = true;
                script.onload = render;
                document.head.appendChild(script);
            } else {
                existing.addEventListener('load', render, { once: true });
            }
        }

        return () => { cancelled = true; };
    }, [mode]);

    if (!import.meta.env.VITE_GOOGLE_CLIENT_ID) {
        return <p className={`text-xs ${className}`} role="status">Google sign-in is not configured for this deployment.</p>;
    }

    return (
        <div
            ref={containerRef}
            className={className}
            aria-disabled={disabled}
            style={disabled ? { opacity: 0.55, pointerEvents: 'none' } : undefined}
        />
    );
}
