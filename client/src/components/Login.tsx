import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import apiClient from '../api/client';
import MfaVerify from './MfaVerify';
import LoginVerification from './LoginVerification';


export default function Login() {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [mfaRequired, setMfaRequired] = useState(false);
    const [tempToken, setTempToken] = useState('');
    const [fraudRequired, setFraudRequired] = useState(false);
    const [riskFlags, setRiskFlags] = useState<string[]>([]);


    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const response = await apiClient.post('/auth/login', { email, password });


            if (response.data.email_verification_required) {
                localStorage.setItem('temp_token', response.data.temp_token);
                setRiskFlags(response.data.risk_flags ?? []);
                setFraudRequired(true);
            }
            // Check if MFA is required
            else if (response.data.mfa_required) {
                setMfaRequired(true);
                setTempToken(response.data.temp_token);
                // Store temp token for MfaVerify component
                localStorage.setItem('temp_token', response.data.temp_token);
            } else {
                // No MFA - login successful
                localStorage.setItem('token', response.data.token);
                navigate('/dashboard');
            }
        } catch (err: any) {
            setError(err.response?.data?.message || 'Login failed');
        } finally {
            setLoading(false);
        }
    };

    if (fraudRequired) {
        return <LoginVerification userEmail={email} riskFlags={riskFlags} />;
    }

    // Show MFA verification if required
    if (mfaRequired) {
        return <MfaVerify />;
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-md p-8">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-white mb-2">Welcome Back</h1>
                    <p className="text-slate-400 text-sm">Sign in to your account</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                    {/* Email Input */}
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                            Email Address
                        </label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="you@example.com"
                            className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 text-white placeholder-slate-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-600 focus:border-transparent transition"
                            required
                            disabled={loading}
                        />
                    </div>

                    {/* Password Input */}
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                            Password
                        </label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 text-white placeholder-slate-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-600 focus:border-transparent transition"
                            required
                            disabled={loading}
                        />
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="bg-red-950 border border-red-800 text-red-200 px-4 py-3 rounded-lg text-sm">
                            {error}
                        </div>
                    )}

                    {/* Login Button */}
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-slate-700 hover:bg-slate-600 text-white py-2.5 rounded-lg disabled:opacity-50 font-semibold transition duration-200 mt-6"
                    >
                        {loading ? 'Signing in...' : 'Sign In'}
                    </button>
                </form>

                {/* Divider */}
                <div className="relative my-7">
                    <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-slate-700"></div>
                    </div>
                    <div className="relative flex justify-center text-sm">
                        <span className="px-2 bg-slate-900 text-slate-500">Don't have an account?</span>
                    </div>
                </div>

                {/* Sign Up Link */}
                <button
                    type="button"
                    onClick={() => navigate('/register')}
                    className="w-full px-4 py-2.5 border border-slate-600 text-slate-300 rounded-lg hover:bg-slate-800 hover:border-slate-500 font-semibold transition duration-200"
                >
                    Create New Account
                </button>
            </div>
        </div>
    );
}