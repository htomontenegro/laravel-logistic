import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useNavigate } from 'react-router-dom';
import { useMfa } from '../hooks/useMfa';

export default function MfaSetup() {
    const navigate = useNavigate();
    const {
        step,
        loading,
        error,
        secret,
        qrCodeUri,
        backupCodes,
        verificationCode,
        startSetup,
        verifyAndEnable,
        setVerificationCode,
        reset,
    } = useMfa();

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-md p-8">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-white">Set Up 2FA</h1>
                    <p className="text-slate-400 text-sm mt-2">Secure your account</p>
                </div>

                {/* Step 1: Setup */}
                {step === 'setup' && (
                    <div>
                        <p className="text-slate-400 mb-8 text-center">
                            Enable two-factor authentication to secure your account
                        </p>
                        <button
                            onClick={startSetup}
                            disabled={loading}
                            className="w-full bg-slate-700 hover:bg-slate-600 text-white py-2.5 rounded-lg disabled:opacity-50 font-semibold transition duration-200"
                        >
                            {loading ? 'Loading...' : 'Start Setup'}
                        </button>
                    </div>
                )}

                {/* Step 2: Verify */}
                {step === 'verify' && (
                    <div className="space-y-5">
                        <div>
                            <p className="text-sm text-slate-300 mb-4">
                                Scan this QR code with your authenticator app:
                            </p>
                            <div className="flex justify-center mb-4 bg-slate-800 p-4 rounded-lg border border-slate-700">
                                <QRCodeSVG value={qrCodeUri} size={200} />
                            </div>
                            <p className="text-xs text-slate-500 text-center mb-3">
                                Can't scan? Enter manually:
                            </p>
                            <code className="bg-slate-800 px-3 py-2 rounded text-xs text-slate-300 block text-center border border-slate-700 break-all">{secret}</code>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                                Enter 6-digit code from authenticator:
                            </label>
                            <input
                                type="text"
                                maxLength={6}
                                value={verificationCode}
                                onChange={(e) => setVerificationCode(e.target.value)}
                                placeholder="000000"
                                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 text-white placeholder-slate-500 rounded-lg text-center text-2xl tracking-widest font-mono focus:outline-none focus:ring-2 focus:ring-slate-600 focus:border-transparent transition"
                                autoFocus
                            />
                        </div>

                        {error && (
                            <div className="bg-red-950 border border-red-800 text-red-200 px-4 py-3 rounded-lg text-sm">
                                {error}
                            </div>
                        )}

                        <button
                            onClick={verifyAndEnable}
                            disabled={loading || verificationCode.length !== 6}
                            className="w-full bg-slate-700 hover:bg-slate-600 text-white py-2.5 rounded-lg disabled:opacity-50 font-semibold transition duration-200"
                        >
                            {loading ? 'Verifying...' : 'Verify & Enable MFA'}
                        </button>

                        <details className="text-sm border-t border-slate-700 pt-4">
                            <summary className="cursor-pointer text-slate-400 hover:text-slate-300 font-medium transition">Can't scan QR code?</summary>
                            <div className="mt-3 p-3 bg-slate-800 rounded border border-slate-700">
                                <p className="mb-2 text-xs text-slate-400">Enter this code manually in your authenticator app:</p>
                                <code className="bg-slate-900 p-2 rounded block border border-slate-600 text-xs text-slate-300 break-all">
                                    {secret}
                                </code>
                            </div>
                        </details>
                    </div>
                )}

                {/* Step 3: Complete */}
                {step === 'complete' && (
                    <div className="space-y-5">
                        <div className="bg-green-950 border border-green-800 rounded-lg p-5">
                            <p className="text-green-300 font-semibold mb-4">✓ Two-Factor Authentication Enabled!</p>
                            <p className="text-sm text-slate-300 mb-4">
                                Save these backup codes in a safe place. Use them if you lose access to your authenticator app:
                            </p>
                            <div className="bg-slate-800 p-4 rounded border border-slate-700 mb-4 max-h-40 overflow-y-auto">
                                {backupCodes.map((code, i) => (
                                    <div key={i} className="font-mono text-sm text-slate-300 py-1">
                                        {code}
                                    </div>
                                ))}
                            </div>
                            <button
                                onClick={() => {
                                    const text = backupCodes.join('\n');
                                    navigator.clipboard.writeText(text);
                                    alert('Backup codes copied to clipboard');
                                }}
                                className="w-full bg-slate-700 hover:bg-slate-600 text-white py-2 rounded-lg text-sm font-medium mb-2 transition"
                            >
                                📋 Copy Backup Codes
                            </button>
                            <p className="text-xs text-slate-500 text-center">
                                Store these codes safely (password manager, encrypted file, etc.)
                            </p>
                        </div>

                        <button
                            onClick={() => navigate('/dashboard')}
                            className="w-full bg-slate-700 hover:bg-slate-600 text-white py-2.5 rounded-lg font-semibold transition duration-200"
                        >
                            Go to Dashboard
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}