import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { useMfa } from './useMfa';

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
  } = useMfa();

  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleCopyBackupCodes = async () => {
    const codesText = backupCodes.join('\n');
    try {
      await navigator.clipboard.writeText(codesText);
      setCopiedIndex(-1); // Indicate all copied
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleCopyCode = async (code: string, index: number) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-md w-full max-w-md p-8">
        {/* SETUP STEP */}
        {step === 'setup' && (
          <div>
            <h1 className="text-2xl font-bold mb-2 text-center">
              Set Up Two-Factor Authentication
            </h1>
            <p className="text-gray-600 text-center mb-6">
              Enable two-factor authentication for your account
            </p>
            <button
              onClick={startSetup}
              disabled={loading}
              className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
            >
              {loading ? 'Loading...' : 'Start Setup'}
            </button>
          </div>
        )}

        {/* VERIFY STEP */}
        {step === 'verify' && (
          <div>
            <h1 className="text-2xl font-bold mb-2 text-center">
              Scan QR Code
            </h1>
            <p className="text-gray-600 text-center mb-6">
              Scan this QR code with your authenticator app
            </p>

            {qrCodeUri && (
              <div className="flex justify-center mb-6">
                <QRCodeSVG value={qrCodeUri} size={200} level="H" />
              </div>
            )}

            {secret && (
              <div className="mb-6 p-4 bg-gray-100 rounded-lg">
                <p className="text-sm text-gray-600 mb-2">
                  Manual Entry Code (if QR doesn't work):
                </p>
                <p className="font-mono font-bold text-center text-lg break-all">
                  {secret}
                </p>
              </div>
            )}

            <div className="mb-6">
              <label htmlFor="verification-code" className="block text-sm font-medium text-gray-700 mb-2">
                Enter 6-digit code
              </label>
              <input
                id="verification-code"
                type="text"
                placeholder="000000"
                value={verificationCode}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                  setVerificationCode(value);
                }}
                maxLength={6}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-center text-2xl letter-spacing-2"
              />
            </div>

            {error && <p className="text-red-600 text-sm mb-4 text-center">{error}</p>}

            <button
              onClick={() => verifyAndEnable(verificationCode)}
              disabled={verificationCode.length !== 6 || loading}
              className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
            >
              {loading ? 'Verifying...' : 'Verify & Enable MFA'}
            </button>
          </div>
        )}

        {/* COMPLETE STEP */}
        {step === 'complete' && (
          <div>
            <div className="text-center mb-6">
              <h1 className="text-2xl font-bold">
                ✓
                MFA Enabled Successfully
              </h1>
            </div>

            <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <h3 className="font-bold text-blue-900 mb-3">
                Save these backup codes
              </h3>
              <p className="text-sm text-blue-800 mb-4">
                Store these in a safe place. You can use them to access your account if you lose your authenticator device.
              </p>

              <div className="space-y-2 mb-4">
                {backupCodes.map((code, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-2 bg-white rounded border border-blue-200"
                  >
                    <code className="font-mono text-sm">{code}</code>
                    <button
                      onClick={() => handleCopyCode(code, index)}
                      className="text-xs text-blue-600 hover:text-blue-800 px-2 py-1"
                    >
                      {copiedIndex === index ? '✓ Copied' : 'Copy'}
                    </button>
                  </div>
                ))}
              </div>

              <button
                onClick={handleCopyBackupCodes}
                className="w-full bg-blue-100 text-blue-600 py-2 rounded hover:bg-blue-200 text-sm font-medium"
              >
                {copiedIndex === -1 ? '✓ Copied All' : 'Copy Backup Codes'}
              </button>
            </div>

            <button
              onClick={() => navigate('/dashboard')}
              className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 font-medium"
            >
              Go to Dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
} 