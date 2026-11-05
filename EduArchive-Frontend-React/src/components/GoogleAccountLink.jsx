import { useState } from 'react';
import GoogleButton from './GoogleButton';
import { linkGoogleAccount } from '../api/admin';
import { useAuth } from '../context/useAuth';
import { getApiErrorMessage } from '../api/errors';

/** Securely connect Google only after the user has authenticated to this account. */
export default function GoogleAccountLink() {
    const { user, setUser } = useAuth();
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [password, setPassword] = useState('');

    const handleCredential = async ({ credential }) => {
        setBusy(true);
        setError('');
        try {
            const response = await linkGoogleAccount({ credential, current_password: password });
            const linkedUser = response?.data?.data?.user;
            if (linkedUser) {
                setUser(linkedUser);
                setPassword('');
            }
        } catch (err) {
            setError(getApiErrorMessage(err, 'Google could not be linked. Please try again.'));
        } finally {
            setBusy(false);
        }
    };

    return (
        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm" aria-labelledby="google-account-title">
            <h2 id="google-account-title" className="text-lg font-semibold text-gray-900">Google sign-in</h2>
            <p className="mt-1 text-sm text-gray-600">
                {user?.google_linked
                    ? 'Your Google account is linked. You can use it on the Acadex sign-in page.'
                    : `Link the Google account for ${user?.email || 'your Acadex email'} to sign in with Google next time.`}
            </p>
            {!user?.google_linked && (
                <>
                    <label className="mt-4 block text-sm font-medium text-gray-700" htmlFor="google-link-password">
                        Confirm your Acadex password
                    </label>
                    <input
                        id="google-link-password"
                        type="password"
                        autoComplete="current-password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        className="mt-1 w-full max-w-sm rounded-lg border border-gray-300 px-3 py-2 text-sm"
                        disabled={busy}
                    />
                    <div className="mt-4">
                        <GoogleButton
                            mode="link"
                            onSuccess={handleCredential}
                            onError={setError}
                            disabled={busy || !password}
                        />
                    </div>
                    {busy && <p className="mt-2 text-sm text-gray-500" role="status">Linking your Google account…</p>}
                    {error && <p className="mt-2 text-sm text-red-600" role="alert">{error}</p>}
                </>
            )}
        </section>
    );
}
