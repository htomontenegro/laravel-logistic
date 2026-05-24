<?php

namespace App\Services;

use OTPHP\TOTP;

class MfaService
{
    public function generateSecretKey(): string
    {
        $totp = TOTP::create();
        return $totp->getSecret();
    }
    /**
     * Generate a QR code URI for the user to scan
     */
    public function generateQrCodeUri(string $email, string $secret): string
    {
        $totp = TOTP::create($secret);
        $totp->setLabel($email);
        $totp->setIssuer('Laravel Login');
        return $totp->getProvisioningUri();
    }
    /**
     * Verify a TOTP code is correct
     */
    public function verifyCode(string $secret, string $code): bool
{
    try {
        $totp = TOTP::create($secret);
        return $totp->verify($code, null, 1); // allow ±29s clock drift
    } catch (\Exception $e) {
        return false;
    }
}
   
    /**
     * Generate 10 backup codes (8 characters each)
     */
    public function generateBackupCodes(): array
    {
        $codes = [];
        for ($i = 0; $i < 10; $i++) {
            $codes[] = strtoupper(bin2hex(random_bytes(4))); // 8 character hex string
        }
        return $codes;
    }

    /**
     * Verify and remove a backup code (one-time use)
     */

    public function verifyBackupCode(array $backupCodes, string $code): array
    {
        $index = array_search(strtoupper($code), $backupCodes);

        if ($index !== false) {
            unset($backupCodes[$index]);
            return ['valid' => true, 'codes' => $backupCodes];
        }
        return ['valid' => false, 'codes' => $backupCodes];
    }
}
