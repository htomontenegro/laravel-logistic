import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useMfa, useMfaVerify, useMfaStatus } from '../useMfa';
import * as mfaApi from '../../api/mfaApi';
import { wait } from '@testing-library/user-event/dist/cjs/utils/index.js';

// Mock the API
vi.mock('../../api/mfaApi', () => ({
  mfaApi: {
    setup: vi.fn(),
    enable: vi.fn(),
    verify: vi.fn(),
    status: vi.fn(),
    disable: vi.fn(),
    regenerateBackupCodes: vi.fn(),
  },
}));

describe('useMfa Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('useMfa', () => {
    it('should initialize with default state', () => {
      const { result } = renderHook(() => useMfa());

      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBe(null);
      expect(result.current.secret).toBe('');
      expect(result.current.step).toBe('setup');
      expect(result.current.verificationCode).toBe('');
    });

    it('should start MFA setup and update state', async () => {
      const mockSecret = 'JBSWY3DPEBLW64TMMQ======';
      const mockQrUri = 'otpauth://totp/...';
      const mockBackupCodes = ['CODE1', 'CODE2', 'CODE3'];

      vi.mocked(mfaApi.mfaApi.setup).mockResolvedValueOnce({
        secret: mockSecret,
        qr_code_uri: mockQrUri,
        backup_codes: mockBackupCodes,
        message: 'Setup started',
      });

      const { result } = renderHook(() => useMfa());

      // Call startSetup
      act(() => {
        result.current.startSetup();
      });

      // Wait for state to update
      await waitFor(() => {
        expect(result.current.step).toBe('verify');
      });

      // Verify state was updated correctly
      expect(result.current.secret).toBe(mockSecret);
      expect(result.current.qrCodeUri).toBe(mockQrUri);
      expect(result.current.backupCodes).toEqual(mockBackupCodes);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBe(null);
    });

    it('should handle setup error', async () => {
      const errorMessage = 'Failed to setup MFA';
      vi.mocked(mfaApi.mfaApi.setup).mockRejectedValueOnce({
        response: { data: { message: errorMessage } },
      });

      const { result } = renderHook(() => useMfa());

      act(() => {
        result.current.startSetup();
      });

      await waitFor(() => {
        expect(result.current.error).toBe(errorMessage);
      });

      expect(result.current.loading).toBe(false);
      expect(result.current.step).toBe('setup');
    });

    it('should validate verification code format', async () => {
      const { result } = renderHook(() => useMfa());

      // Set invalid code length
      act(() => {
        result.current.setVerificationCode('12345'); // Only 5 digits
      });

      expect(result.current.verificationCode).toBe('12345');
    });

    it('should only allow 6 digits in verification code', async () => {
      const { result } = renderHook(() => useMfa());

      act(() => {
        result.current.setVerificationCode('123456xyz'); // Mix of numbers and letters
      });

      // Should only contain first 6 digits
      expect(result.current.verificationCode).toBe('123456');
    });

    it('should verify and enable MFA with valid code', async () => {
      const mockSecret = 'JBSWY3DPEBLW64TMMQ======';
      const mockCode = '123456';
      const mockBackupCodes = ['CODE1', 'CODE2'];

      // Mock setup response
      vi.mocked(mfaApi.mfaApi.setup).mockResolvedValueOnce({
        secret: mockSecret,
        qr_code_uri: 'otpauth://...',
        backup_codes: mockBackupCodes,
        message: 'Setup started',
      });
      vi.mocked(mfaApi.mfaApi.enable).mockResolvedValueOnce({
        message: 'MFA enabled successfully',
      });

      const { result } = renderHook(() => useMfa());

      // Set up initial state
      act(() => {
        result.current.startSetup();
      });


      await waitFor(() => {
        expect(result.current.step).toBe('verify');
      });

      // Set verification code
      act(() => {
        result.current.setVerificationCode(mockCode);
      });

      // Verify and enable
      act(() => {
        result.current.verifyAndEnable();
      });

      await waitFor(() => {
        expect(result.current.step).toBe('complete');
      });

      expect(result.current.error).toBe(null);
    });

    it('should reject invalid verification code', async () => {
      vi.mocked(mfaApi.mfaApi.enable).mockRejectedValueOnce({
        response: { data: { message: 'Invalid verification code' } },
      });

      const { result } = renderHook(() => useMfa());

      // Set invalid code
      act(() => {
        result.current.setVerificationCode('000000');
      });

      // Try to verify
      act(() => {
        result.current.verifyAndEnable();
      });

      await waitFor(() => {
        expect(result.current.error).toBe('Invalid verification code');
      });

      expect(result.current.step).not.toBe('complete');
    });

    it('should require 6-digit code', () => {
      const { result } = renderHook(() => useMfa());

      act(() => {
        result.current.setVerificationCode('12345'); // Only 5 digits
      });

      // Should show error when trying to verify with incomplete code
      act(() => {
        result.current.verifyAndEnable();
      });

      expect(result.current.error).toBe('Code must be 6 digits');
    });

    it('should reset to initial state', () => {
      const { result } = renderHook(() => useMfa());

      // Change state
      act(() => {
        result.current.setVerificationCode('123456');
      });

      // Reset
      act(() => {
        result.current.reset();
      });

      expect(result.current.verificationCode).toBe('');
      expect(result.current.step).toBe('setup');
      expect(result.current.error).toBe(null);
    });
  });

  describe('useMfaVerify', () => {
    it('should initialize with default state', () => {
      const { result } = renderHook(() => useMfaVerify());

      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBe(null);
    });

    it('should verify TOTP code successfully', async () => {
      const mockToken = 'mock_auth_token';
      const mockUser = { id: 1, email: 'test@example.com' };

      vi.mocked(mfaApi.mfaApi.verify).mockResolvedValueOnce({
        token: mockToken,
        user: mockUser,
      });

      const { result } = renderHook(() => useMfaVerify());

      let response;
      await act(async () => {
        response = await result.current.verify('123456');
      });

      expect(response?.token).toBe(mockToken);
      expect(response?.user).toEqual(mockUser);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBe(null);
    });

    it('should handle verification error', async () => {
      const errorMessage = 'Invalid TOTP code';

      vi.mocked(mfaApi.mfaApi.verify).mockRejectedValueOnce({
        response: { data: { message: errorMessage } },
      });

      const { result } = renderHook(() => useMfaVerify());

      await act(async () => {
        try {
          await result.current.verify('000000');
        } catch (err) {
          // Error expected
        }
      });

      await waitFor(() => {
        expect(result.current.error).toBe(errorMessage);
      });
    });

    it('should verify backup code', async () => {
      const mockToken = 'mock_auth_token';

      vi.mocked(mfaApi.mfaApi.verify).mockResolvedValueOnce({
        token: mockToken,
        user: { id: 1 },
      });

      const { result } = renderHook(() => useMfaVerify());

      await act(async () => {
        await result.current.verify(undefined, 'BACKUPCODE123');
      });

      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBe(null);
    });

    it('should store token in localStorage on successful verification', async () => {
      const mockToken = 'mock_auth_token';

      vi.mocked(mfaApi.mfaApi.verify).mockResolvedValueOnce({
        token: mockToken,
        user: { id: 1 },
      });

      const { result } = renderHook(() => useMfaVerify());

      await act(async () => {
        await result.current.verify('123456');
      });

      expect(localStorage.setItem).toHaveBeenCalledWith('token', mockToken);
    });
  });

  describe('useMfaStatus', () => {
    it('should initialize with default state', () => {
      const { result } = renderHook(() => useMfaStatus());

      expect(result.current.mfaEnabled).toBe(false);
      expect(result.current.loading).toBe(false);
    });

    it('should check MFA status successfully', async () => {
      vi.mocked(mfaApi.mfaApi.status).mockResolvedValueOnce({
        mfa_enabled: true,
        mfa_verified_at: '2024-01-01T12:00:00Z',
      });

      const { result } = renderHook(() => useMfaStatus());

      await act(async () => {
  await result.current.checkStatus();
});

      await waitFor(() => {
        expect(result.current.mfaEnabled).toBe(true);
      });

      expect(result.current.loading).toBe(false);
    });

    it('should handle status check error', async () => {
  vi.mocked(mfaApi.mfaApi.status).mockRejectedValueOnce(
    new Error('API Error')
  );

  const { result } = renderHook(() => useMfaStatus());

  await act(async () => {
    try {
      await result.current.checkStatus();
    } catch (err) {
      // Error expected - hook doesn't handle it
    }
  });

  await waitFor(() => {
    expect(result.current.loading).toBe(false);
  });
});
  });
});