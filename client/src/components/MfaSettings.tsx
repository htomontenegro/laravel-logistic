import React, { useState, useEffect } from 'react';
import { useMfaStatus } from '../hooks/useMfa';
import apiClient from '../api/client';

export default function MfaSettings() {
  const { mfaEnabled, loading: statusLoading, checkStatus } = useMfaStatus();
  const [showDisableModal, setShowDisableModal] = useState(false);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [showBackupCodes, setShowBackupCodes] = useState(false);
  const [regeneratingCodes, setRegeneratingCodes] = useState(false);

  useEffect(() => {
    checkStatus();
  }, []);

  const handleDisableMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      await apiClient.post('/mfa/disable', { password });
      setSuccess('MFA has been disabled');
      setPassword('');
      setShowDisableModal(false);
      setTimeout(() => checkStatus(), 500);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to disable MFA');
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerateCodes = async () => {
    setRegeneratingCodes(true);
    setError('');

    try {
      const response = await apiClient.post('/mfa/backup-codes', { password });
      setBackupCodes(response.data.backup_codes);
      setShowBackupCodes(true);
      setSuccess('Backup codes regenerated successfully');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to regenerate backup codes');
    } finally {
      setRegeneratingCodes(false);
    }
  };

  const copyBackupCodes = () => {
    const text = backupCodes.join('\n');
    navigator.clipboard.writeText(text);
    alert('Backup codes copied to clipboard');
  };

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-xl p-8 max-w-2xl">
      <h2 className="text-2xl font-bold text-white mb-8">Two-Factor Authentication</h2>

      {/* Status Section */}
      <div className="mb-8">
        {statusLoading ? (
          <p className="text-slate-400">Loading MFA status...</p>
        ) : (
          <div
            className={`p-5 rounded-lg border-2 ${
              mfaEnabled
                ? 'bg-green-950 border-green-800'
                : 'bg-amber-950 border-amber-800'
            }`}
          >
            <p className="font-semibold mb-2">
              {mfaEnabled ? (
                <span className="text-green-300">✓ Two-Factor Authentication is Enabled</span>
              ) : (
                <span className="text-amber-300">⚠ Two-Factor Authentication is Disabled</span>
              )}
            </p>
            <p className="text-sm text-slate-300">
              {mfaEnabled
                ? 'Your account is protected with two-factor authentication. You will need to enter a verification code when logging in.'
                : 'Enable two-factor authentication to add an extra layer of security to your account.'}
            </p>
          </div>
        )}
      </div>

      {/* Success Message */}
      {success && (
        <div className="bg-green-950 border border-green-800 text-green-200 px-4 py-3 rounded-lg mb-4 text-sm">
          {success}
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-950 border border-red-800 text-red-200 px-4 py-3 rounded-lg mb-4 text-sm">
          {error}
        </div>
      )}

      {/* Actions */}
      <div className="space-y-6">
        {mfaEnabled && (
          <>
            {/* Regenerate Backup Codes */}
            <div>
              <h3 className="font-semibold text-white mb-2">Backup Codes</h3>
              <p className="text-sm text-slate-400 mb-4">
                If you lose access to your authenticator app, you can use backup codes to sign in.
              </p>
              <button
                onClick={handleRegenerateCodes}
                disabled={regeneratingCodes}
                className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg disabled:opacity-50 text-sm font-semibold transition"
              >
                {regeneratingCodes ? 'Generating...' : 'Regenerate Backup Codes'}
              </button>
            </div>

            {/* Show Backup Codes */}
            {showBackupCodes && backupCodes.length > 0 && (
              <div className="bg-slate-800 border border-slate-700 rounded-lg p-5">
                <p className="text-sm font-semibold text-white mb-3">
                  Your new backup codes:
                </p>
                <div className="bg-slate-900 p-3 rounded border border-slate-600 mb-4 max-h-48 overflow-y-auto">
                  {backupCodes.map((code, i) => (
                    <div key={i} className="font-mono text-sm text-slate-300 py-1">
                      {code}
                    </div>
                  ))}
                </div>
                <div className="space-y-2">
                  <button
                    onClick={copyBackupCodes}
                    className="w-full px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-semibold transition"
                  >
                    📋 Copy Codes
                  </button>
                  <p className="text-xs text-slate-500 text-center">
                    Save these codes in a secure location. Each code can only be used once.
                  </p>
                </div>
              </div>
            )}

            {/* Disable MFA */}
            <div className="border-t border-slate-700 pt-6">
              <h3 className="font-semibold text-white mb-2">Disable Two-Factor Authentication</h3>
              <p className="text-sm text-slate-400 mb-4">
                Disabling 2FA will make your account less secure. You will only need your password to log in.
              </p>
              <button
                onClick={() => setShowDisableModal(true)}
                className="px-4 py-2.5 bg-red-900 hover:bg-red-800 text-white rounded-lg text-sm font-semibold transition"
              >
                Disable MFA
              </button>
            </div>
          </>
        )}

        {!mfaEnabled && (
          <div>
            <p className="text-sm text-slate-400 mb-4">
              Protect your account by enabling two-factor authentication.
            </p>
            <a
              href="/mfa-setup"
              className="inline-block px-6 py-2.5 bg-green-900 hover:bg-green-800 text-white rounded-lg text-sm font-semibold transition"
            >
              Enable Two-Factor Authentication
            </a>
          </div>
        )}
      </div>

      {/* Disable MFA Modal */}
      {showDisableModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-md p-8">
            <h3 className="text-lg font-bold mb-4 text-red-400">Disable Two-Factor Authentication?</h3>
            <p className="text-sm text-slate-400 mb-6">
              Are you sure? Disabling 2FA makes your account less secure. Enter your password to confirm.
            </p>

            <form onSubmit={handleDisableMfa} className="space-y-4">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 text-white placeholder-slate-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600 focus:border-transparent transition"
                disabled={loading}
                autoFocus
              />

              {error && (
                <p className="text-red-400 text-sm">{error}</p>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowDisableModal(false);
                    setPassword('');
                    setError('');
                  }}
                  disabled={loading}
                  className="flex-1 px-4 py-2.5 border border-slate-600 text-slate-300 rounded-lg hover:bg-slate-800 disabled:opacity-50 font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !password}
                  className="flex-1 px-4 py-2.5 bg-red-900 hover:bg-red-800 text-white rounded-lg disabled:opacity-50 font-semibold transition"
                >
                  {loading ? 'Disabling...' : 'Disable'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}