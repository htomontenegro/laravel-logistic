import { useState } from 'react';
import { mfaApi } from '../api/mfaApi';
import { MfaSetupState } from '../types/mfa';


const initialState: MfaSetupState = {
    loading: false,
    error: null,
    secret: '',
    qrCodeUri: '',
    backupCodes: [],
    step: 'setup',
    verificationCode: ''
};

export function useMfa() {
    const [state, setState] = useState<MfaSetupState>(initialState);

    const startSetup = async () => {
        setState((prev) => ({ ...prev, loading: true, error: null }));

        try {
            const data = await mfaApi.setup();
            setState((prev) => ({
                ...prev,
                secret: data.secret,
                qrCodeUri: data.qr_code_uri,
                backupCodes: data.backup_codes,
                step: 'verify',
                loading: false,
            }));
        } catch (err: any) {
            setState((prev) => ({
                ...prev,
                error: err.response?.data?.message || 'Failed to setup MFA',
                loading: false,
            }));
        };

    };

    const verifyAndEnable = async () => {
        if (state.verificationCode.length !== 6) {
            setState((prev) => ({ ...prev, error: 'Code must be 6 digits' }));
            return;
        }

        setState((prev) => ({ ...prev, loading: true, error: null }));

        try {
            await mfaApi.enable({
                secret: state.secret,
                code: state.verificationCode,
                backup_codes: state.backupCodes
            });
            setState((prev) => ({
                ...prev,
                step: 'complete',
                loading: false,
            }));
        } catch (err: any) {
            setState((prev) => ({
                ...prev,
                error: err.response?.data?.message || 'Failed to enable MFA',
                loading: false,
            }));
        };
    };

    const setVerificationCode = (code: string) => {
        setState((prev) => ({
            ...prev,
            verificationCode: code.replace(/\D/g, '').slice(0, 6),
        }));
    };

    const reset = () => setState(initialState);

    return {
        ...state,
        startSetup,
        verifyAndEnable,
        setVerificationCode,
        reset,
    };




}

export const useMfaVerify = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);


    const verify = async (code?: string, backupCode?: string) => {
        setLoading(true);
        setError(null);

        try {
            const data = await mfaApi.verify({ code, backup_code: backupCode });
            localStorage.setItem('token', data.token);
            localStorage.removeItem('temp_token'); // clean up temp token

            return data;
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to verify MFA');
            throw err;
        } finally {
            setLoading(false);
        };
    }
    return {
        loading,
        error,
        verify,
    };
}

export const useMfaStatus = () => {
    const [mfaEnabled, setMfaEnabled] = useState(false);
    const [loading, setLoading] = useState(false);


    const checkStatus = async () => {
        setLoading(true);
        try {
            const data = await mfaApi.status();
            setMfaEnabled(data.mfa_enabled);
        } finally {
            setLoading(false);
        }
    }

    return {
        mfaEnabled,
        loading,
        checkStatus,
    }
}