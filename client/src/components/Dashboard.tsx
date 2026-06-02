import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../api/client';
import MfaSettings from './MfaSettings';
import TrustedDevices from './TrustedDevices';

interface User {
    id: number;
    name: string;
    email: string;
    mfa_enabled: boolean;
    created_at: string;
}

export default function Dashboard() {
    const navigate = useNavigate();
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        fetchUser();
    }, []);

    const fetchUser = async () => {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                navigate('/login');
                return;
            }

            const response = await apiClient.get('/auth/user', {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });
            setUser(response.data.user);
        } catch (err: any) {
            if (err.response?.status === 401) {
                localStorage.removeItem('token');
                navigate('/login');
            } else {
                console.log(err);
                setError('Failed to load user data');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = async () => {
        try {
            const token = localStorage.getItem('token');
            await apiClient.post(
                '/auth/logout',
                {},
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            );

            localStorage.removeItem('token');
            localStorage.removeItem('temp_token');

            navigate('/login');
        } catch (err) {
            console.error('Logout failed:', err);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 flex items-center justify-center">
                <div className="text-slate-400 text-lg">Loading...</div>
            </div>
        );
    }

    if (!user) {
        return (
            <div className="min-h-screen w-full bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 flex items-center justify-center p-4">
                <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-md p-8">
                    <p className="text-red-400 text-center mb-4">{error || 'Failed to load dashboard'}</p>
                    <button
                        onClick={() => navigate('/login')}
                        className="w-full bg-slate-700 hover:bg-slate-600 text-white py-2.5 rounded-lg font-semibold transition"
                    >
                        Go to Login
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="w-screen min-h-screen w-full bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800">
            {/* Header */}
            <header className="bg-slate-900 border-b border-slate-700 shadow-lg">
                <div className="max-w-6xl mx-auto px-4 py-5 sm:px-6 lg:px-8 flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-bold text-white">Dashboard</h1>
                        <p className="text-slate-400 text-sm">Welcome back, {user.name}!</p>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="px-6 py-2.5 bg-red-900 hover:bg-red-800 text-white rounded-lg font-semibold text-sm transition duration-200"
                    >
                        Logout
                    </button>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-6xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
                {/* Welcome Card */}
                <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-xl p-8 mb-8">
                    <h2 className="text-2xl font-bold text-white mb-6">Account Information</h2>
                    <div className="space-y-6">
                        <div>
                            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Name</label>
                            <p className="text-white text-lg font-medium">{user.name}</p>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Email</label>
                            <p className="text-white text-lg font-medium">{user.email}</p>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Member Since</label>
                            <p className="text-white text-lg font-medium">
                                {new Date(user.created_at).toLocaleDateString('en-US', {
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric',
                                })}
                            </p>
                        </div>
                    </div>
                </div>

                {/* MFA Settings Section */}
                <div className="mb-8">
                    <MfaSettings />
                </div>

                {/* Trusted Devices Section */}
                <div className="mb-8">
                    <TrustedDevices />
                </div>

                {/* Additional Settings Card */}
                <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-xl p-8">
                    <h2 className="text-2xl font-bold text-white mb-4">Account Settings</h2>
                    <div className="space-y-4">
                        <p className="text-slate-400">
                            More settings and features coming soon...
                        </p>
                    </div>
                </div>
            </main>
        </div>
    );
}