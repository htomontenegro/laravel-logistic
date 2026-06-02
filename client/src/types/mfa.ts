export interface MfaSetupResponse {
    secret: string;
    qr_code_uri: string;
    backup_codes: string[];
    message: string;
}

export interface MfaEnableRequest {
    code: string;
}

export interface MfaVerifyRequest {
    code?: string;
    backup_code?: string;
}

export interface MfaStatusResponse {
    mfa_enabled: boolean;
    mfa_verified_at: string | null;
}

export interface MfaSetupState {
    loading: boolean;
    error: string | null;
    secret: string;
    qrCodeUri: string;
    backupCodes: string[];
    step: 'setup' | 'verify' | 'complete';
    verificationCode: string;
}