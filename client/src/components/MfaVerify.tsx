import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useMfaVerify } from '../hooks/useMfa';

export default function MfaVerify() {
    const navigate = useNavigate();
    const location = useLocation();
    const { loading, error, verify } = useMfaVerify();

    const [totpCode, setTotpCode] = useState('');
    const [backupCode, setBackupCode] = useState('');
    const [useBackupCode, setUseBackupCode] = useState(false);
    const [verifyError, setVerifyError] = useState('');

    // Check if we have temp token (from login with MFA required)
    const tempToken = location.state?.tempToken || localStorage.getItem('temp_token');
    if (!tempToken) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 flex items-center justify-center p-4">
                <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-md p-8">
                    <p className="text-red-400 text-center font-medium">Invalid session. Please login again.</p>
                    <button
                        onClick={() => navigate('/login')}
                        className="w-full mt-6 bg-slate-700 hover:bg-slate-600 text-white py-2.5 rounded-lg font-semibold transition"
                    >
                        Go to Login
                    </button>
                </div>
            </div>
        );
    }

    const handleVerify = async (e: React.FormEvent) => {
        e.preventDefault();
        setVerifyError('');

        if (!useBackupCode && totpCode.length !== 6) {
            setVerifyError('Enter a 6-digit code');
            return;
        }

        if (useBackupCode && !backupCode.trim()) {
            setVerifyError('Enter a backup code');
            return;
        }

        try {
            const code = useBackupCode ? undefined : totpCode;
            const bCode = useBackupCode ? backupCode.trim() : undefined;

            await verify(code, bCode);
            navigate('/dashboard');
        } catch (err) {
            setVerifyError('Verification failed. Please try again.');
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-md p-8">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-white">Verify Identity</h1>
                    <p className="text-slate-400 text-sm mt-2">Enter your verification code</p>
                </div>

                <form onSubmit={handleVerify} className="space-y-5">
                    {/* TOTP Code Input */}
                    {!useBackupCode && (
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                                6-digit code from your authenticator app
                            </label>
                            <input
                                type="text"
                                maxLength={6}
                                value={totpCode}
                                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                                placeholder="000000"
                                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 text-white placeholder-slate-500 rounded-lg text-center text-2xl tracking-widest font-mono focus:outline-none focus:ring-2 focus:ring-slate-600 focus:border-transparent transition"
                                autoFocus
                                disabled={loading}
                            />
                            <p className="text-xs text-slate-500 mt-2">
                                This is the 6-digit number displayed in your authenticator app
                            </p>
                        </div>
                    )}

                    {/* Backup Code Input */}
                    {useBackupCode && (
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                                Enter one of your backup codes
                            </label>
                            <input
                                type="text"
                                value={backupCode}
                                onChange={(e) => setBackupCode(e.target.value)}
                                placeholder="XXXXXXXX"
                                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 text-white placeholder-slate-500 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-slate-600 focus:border-transparent transition"
                                autoFocus
                                disabled={loading}
                            />
                            <p className="text-xs text-slate-500 mt-2">
                                Use one of the backup codes you saved when setting up 2FA
                            </p>
                        </div>
                    )}

                    {/* Error Message */}
                    {(error || verifyError) && (
                        <div className="bg-red-950 border border-red-800 text-red-200 px-4 py-3 rounded-lg text-sm">
                            {error || verifyError}
                        </div>
                    )}

                    {/* Submit Button */}
                    <button
                        type="submit"
                        disabled={
                            loading ||
                            (!useBackupCode && totpCode.length !== 6) ||
                            (useBackupCode && !backupCode.trim())
                        }
                        className="w-full bg-slate-700 hover:bg-slate-600 text-white py-2.5 rounded-lg disabled:opacity-50 font-semibold transition duration-200 mt-6"
                    >
                        {loading ? 'Verifying...' : 'Verify'}
                    </button>

                    {/* Toggle Backup Code */}
                    <button
                        type="button"
                        onClick={() => {
                            setUseBackupCode(!useBackupCode);
                            setTotpCode('');
                            setBackupCode('');
                            setVerifyError('');
                        }}
                        className="w-full text-slate-400 hover:text-slate-300 text-sm font-medium border-t border-slate-700 pt-4 transition"
                    >
                        {useBackupCode ? 'Use authenticator code instead' : 'Use backup code instead'}
                    </button>
                </form>

                {/* Help Section */}
                <details className="mt-6 border-t border-slate-700 pt-4">
                    <summary className="cursor-pointer text-slate-400 text-sm font-medium hover:text-slate-300 transition">
                        Troubleshooting
                    </summary>
                    <div className="mt-3 text-xs text-slate-500 space-y-2">
                        <p>
                            <strong>Code expires quickly:</strong> Your authenticator app generates codes that expire every 30 seconds. Enter it quickly.
                        </p>
                        <p>
                            <strong>Lost authenticator?</strong> Use one of your backup codes to regain access.
                        </p>
                        <p>
                            <strong>Still locked out?</strong> Contact support to regain access to your account.
                        </p>
                    </div>
                </details>
            </div>
        </div>
    );
}