import apiClient from "./client";
import {
    MfaSetupResponse,
    MfaEnableRequest,
    MfaVerifyRequest,
    MfaStatusResponse
} from "../types/mfa";

export const mfaApi = {
    // get QR code and secret for setup
    async setup(): Promise<MfaSetupResponse> {
        const response = await apiClient.post<MfaSetupResponse>('/mfa/setup');
        return response.data;
    },

    // enable MFA
    async enable(payload: MfaEnableRequest): Promise<{ message: string }> {
        const response = await apiClient.post('/mfa/enable', payload);
        return response.data;
    },

    // disable MFA
    async disable(password: string): Promise<{ message: string }> {
        const response = await apiClient.post('/mfa/disable', { password });
        return response.data;
    },

    async verify(payload: MfaVerifyRequest): Promise<{ token: string, user: any }> {
        const response = await apiClient.post('/auth/verify-mfa', payload);
        return response.data;

    },

    // Get current MFA status
    async status(): Promise<MfaStatusResponse> {
        const response = await apiClient.get<MfaStatusResponse>('/mfa/status');
        return response.data;
    },

    // Regenerate backup codes
    async regenerateBackupCodes(): Promise<{ backup_codes: string[] }> {
        const response = await apiClient.post('/mfa/backup-codes');
        return response.data;
    },


}

