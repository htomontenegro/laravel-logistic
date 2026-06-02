import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MfaSetup from '../MfaSetup';

// Hoist the mock function declaration
const { mockUseMfa, mockNavigate } = vi.hoisted(() => {
  return {
    mockUseMfa: vi.fn(),
    mockNavigate: vi.fn(),
  };
});

// Mock useMfa hook
vi.mock('../useMfa', () => ({
  useMfa: mockUseMfa,
}));

// Mock react-router
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

// Default mock return value
const defaultMockValue = {
  step: 'setup',
  loading: false,
  error: '',
  secret: '',
  qrCodeUri: '',
  backupCodes: [],
  verificationCode: '',
  startSetup: vi.fn(),
  verifyAndEnable: vi.fn(),
  setVerificationCode: vi.fn(),
  reset: vi.fn(),
};

describe('MfaSetup Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseMfa.mockReturnValue(defaultMockValue);
  });

  describe('Setup Step', () => {
    it('should render setup step initially', () => {
      render(<MfaSetup />);

      expect(screen.getByText(/Set Up Two-Factor Authentication/i)).toBeInTheDocument();
      expect(screen.getByText(/Enable two-factor authentication/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Start Setup/i })).toBeInTheDocument();
    });

    it('should call startSetup when button is clicked', async () => {
      const user = userEvent.setup();
      const startSetup = vi.fn();

      mockUseMfa.mockReturnValue({
        ...defaultMockValue,
        startSetup,
      });

      render(<MfaSetup />);

      const button = screen.getByRole('button', { name: /Start Setup/i });
      await user.click(button);

      expect(startSetup).toHaveBeenCalled();
    });

    it('should disable button while loading', () => {
      mockUseMfa.mockReturnValue({
        ...defaultMockValue,
        loading: true,
      });

      render(<MfaSetup />);

      const button = screen.getByRole('button', { name: /Loading/i });
      expect(button).toBeDisabled();
    });
  });

  describe('Verify Step', () => {
    it('should render QR code when in verify step', () => {
      mockUseMfa.mockReturnValue({
        ...defaultMockValue,
        step: 'verify',
        secret: 'JBSWY3DPEBLW64TMMQ======',
        qrCodeUri: 'otpauth://totp/test@example.com?secret=ABC123',
        backupCodes: ['CODE1', 'CODE2', 'CODE3'],
      });

      render(<MfaSetup />);

      expect(screen.getByText(/Scan this QR code/i)).toBeInTheDocument();
      expect(screen.getByText('JBSWY3DPEBLW64TMMQ======')).toBeInTheDocument();
    });

    it('should allow entering 6-digit code', async () => {
      const user = userEvent.setup();
      const setVerificationCode = vi.fn();

      mockUseMfa.mockReturnValue({
        ...defaultMockValue,
        step: 'verify',
        secret: 'ABC123',
        qrCodeUri: 'otpauth://...',
        backupCodes: ['CODE1'],
        setVerificationCode,
      });

      render(<MfaSetup />);

      const input = screen.getByPlaceholderText('000000');
      await user.type(input, '123456');

      expect(setVerificationCode).toHaveBeenCalled();
    });

    it('should show error message if verification fails', () => {
      mockUseMfa.mockReturnValue({
        ...defaultMockValue,
        step: 'verify',
        error: 'Invalid verification code',
        secret: 'ABC123',
        qrCodeUri: 'otpauth://...',
        backupCodes: ['CODE1'],
      });

      render(<MfaSetup />);

      expect(screen.getByText('Invalid verification code')).toBeInTheDocument();
    });

    it('should disable verify button if code is incomplete', () => {
      mockUseMfa.mockReturnValue({
        ...defaultMockValue,
        step: 'verify',
        secret: 'ABC123',
        qrCodeUri: 'otpauth://...',
        backupCodes: ['CODE1'],
        verificationCode: '12345',  // Only 5 digits
      });

      render(<MfaSetup />);

      const button = screen.getByRole('button', { name: /Verify & Enable MFA/i });
      expect(button).toBeDisabled();
    });
  });

  describe('Complete Step', () => {
    it('should render success message and backup codes', () => {
      const backupCodes = ['CODE1', 'CODE2', 'CODE3', 'CODE4', 'CODE5'];

      mockUseMfa.mockReturnValue({
        ...defaultMockValue,
        step: 'complete',
        backupCodes,
      });

      render(<MfaSetup />);

      expect(screen.getByText(/✓ MFA Enabled Successfully/i)).toBeInTheDocument();
      expect(screen.getByText(/Save these backup codes/i)).toBeInTheDocument();

      backupCodes.forEach((code) => {
        expect(screen.getByText(code)).toBeInTheDocument();
      });
    });

    it('should allow copying backup codes', async () => {
      const user = userEvent.setup();
      const backupCodes = ['CODE1', 'CODE2'];

      // Mock clipboard using vi.stubGlobal
      const writeTextMock = vi.fn(() => Promise.resolve());
      vi.stubGlobal('navigator', {
        clipboard: {
          writeText: writeTextMock,
        },
      });

      mockUseMfa.mockReturnValue({
        ...defaultMockValue,
        step: 'complete',
        backupCodes,
      });

      render(<MfaSetup />);

      const copyButton = screen.getByRole('button', { name: /Copy Backup Codes/i });
      await user.click(copyButton);

      expect(writeTextMock).toHaveBeenCalled();
    });

    it('should navigate to dashboard when button clicked', async () => {
      const user = userEvent.setup();

      mockUseMfa.mockReturnValue({
        ...defaultMockValue,
        step: 'complete',
        backupCodes: ['CODE1'],
      });

      render(<MfaSetup />);

      const button = screen.getByRole('button', { name: /Go to Dashboard/i });
      await user.click(button);

      expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
    });
  });

  describe('Accessibility', () => {
    it('should have proper labels for inputs', () => {
      mockUseMfa.mockReturnValue({
        ...defaultMockValue,
        step: 'verify',
        secret: 'ABC123',
        qrCodeUri: 'otpauth://...',
        backupCodes: ['CODE1'],
      });

      render(<MfaSetup />);

      expect(screen.getByLabelText(/Enter 6-digit code/i)).toBeInTheDocument();
    });

    it('should have descriptive button text', () => {
      render(<MfaSetup />);

      expect(screen.getByRole('button', { name: /Start Setup/i })).toBeInTheDocument();
    });
  });
});