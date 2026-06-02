import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../api/client';
import MfaVerify from './MfaVerify';

const FLAG_LABELS: Record<string, string> = {
    excessive_failures: 'Multiple failed login attempts detected',
    new_country: 'Login from an unrecognised country',
    impossible_travel: 'Login location inconsistent with recent activity',
    unknown_device: 'Unrecognised device',
};

interface Props {
    userEmail: string;
    riskFlags: string[];
}

export default function LoginVerification({
    userEmail,
    riskFlags,
}: Props) {
    const navigate = useNavigate();
    const [code, setCode] = useState('');
    const [trustDevice, setTrustDevice] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [mfaRequired, setMfaRequired] = useState(false);

    if (mfaRequired) {
        return <MfaVerify />;
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const response = await apiClient.post('/auth/verify-fraud', {
                code, trust_device: trustDevice,
            }
            );

            localStorage.removeItem('temp_token');

            if (response.data.mfa_required) {
                localStorage.setItem('temp_token', response.data.temp_token);
                setMfaRequired(true);
            } else {
                localStorage.setItem('token', response.data.token);
                navigate('/dashboard');
            }
        } catch (err: any) {
            setError(err.response?.data?.message || 'Verification failed');
        } finally {
            setLoading(false);
        }
    };
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-md p-8">
                <div className="text-center mb-8">
                    <div className="w-14 h-14 bg-amber-900 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-7 h-7 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                        </svg>
                    </div>
                    <h1 className="text-2xl font-bold text-white mb-2">Verify Your Login</h1>
                    <p className="text-slate-400 text-sm">
                        We sent a 6-digit code to <span className="text-slate-200">{userEmail}</span>
                    </p>
                </div>

                {riskFlags.length > 0 && (
                    <div className="bg-amber-950 border border-amber-800 rounded-lg p-4 mb-6">
                        <p className="text-amber-300 text-xs font-semibold uppercase tracking-wide mb-2">Why we're asking</p>
                        <ul className="space-y-1">
                            {riskFlags.map(flag => (
                                <li key={flag} className="text-amber-200 text-sm">
                                    {FLAG_LABELS[flag] ?? flag}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                            Verification Code
                        </label>
                        <input
                            type="text"
                            value={code}
                            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                            placeholder="000000"
                            className="w-full px-4 py-3 bg-slate-800 border border-slate-700 text-white placeholder-slate-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-600 text-center text-2xl tracking-widest font-mono transition"
                            required
                            disabled={loading}
                            maxLength={6}
                        />
                    </div>

                    <label className="flex items-center gap-3 cursor-pointer select-none">
                        <input
                            type="checkbox"
                            checked={trustDevice}
                            onChange={(e) => setTrustDevice(e.target.checked)}
                            className="w-4 h-4 rounded border-slate-600 bg-slate-800 accent-slate-500"
                        />
                        <span className="text-slate-300 text-sm">Trust this device for future logins</span>
                    </label>

                    {error && (
                        <div className="bg-red-950 border border-red-800 text-red-200 px-4 py-3 rounded-lg text-sm">
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading || code.length !== 6}
                        className="w-full bg-slate-700 hover:bg-slate-600 text-white py-2.5 rounded-lg disabled:opacity-50 font-semibold transition duration-200"
                    >
                        {loading ? 'Verifying...' : 'Verify Login'}
                    </button>
                </form>
            </div>
        </div>
    );
}