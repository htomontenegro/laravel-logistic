<?php

namespace App\Http\Controllers;

use App\Models\MfaSetting;
use App\Services\MfaService;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Hash;

class MfaController extends Controller
{
    private MfaService $mfaService;

    public function __construct(MfaService $mfaService)
    {
        $this->mfaService = $mfaService;
    }

    /**
     * Start MFA setup - return QR code and secret
     */

     public function setup(Request $request): JsonResponse
     {
         $user = $request->user();
     
         $secret = $this->mfaService->generateSecretKey();
         $qrCodeUri = $this->mfaService->generateQrCodeUri($user->email, $secret);
         $backupCodes = $this->mfaService->generateBackupCodes();
     
         MfaSetting::updateOrCreate(
             ['user_id' => $user->id],
             [
                 'pending_secret_key' => encrypt($secret),
                 'is_enabled' => false,
             ]
         );
     
         return response()->json([
             'qr_code_uri' => $qrCodeUri,
             'secret' => $secret,
             'backup_codes' => $backupCodes,
             'message' => 'Scan the QR code with your authenticator app',
         ]);
     }
     
     public function enable(Request $request): JsonResponse
     {
         $request->validate([
             'code' => 'required|string|size:6',
         ]);
     
         $user = $request->user();
         $mfaSetting = MfaSetting::firstOrCreate(['user_id' => $user->id]);
     
         if (!$mfaSetting->pending_secret_key) {
             return response()->json(['message' => 'Run MFA setup first'], 422);
         }
     
         $secret = decrypt($mfaSetting->pending_secret_key);
     
         if (!$this->mfaService->verifyCode($secret, $request->code)) {
             return response()->json(['message' => 'Invalid verification code'], 422);
         }
     
         $backupCodes = $this->mfaService->generateBackupCodes();
     
         $mfaSetting->update([
             'secret_key' => encrypt($secret),
             'pending_secret_key' => null,
             'is_enabled' => true,
             'backup_codes' => encrypt(json_encode($backupCodes)),
         ]);
     
         $user->update([
             'mfa_enabled' => true,
             'mfa_verified_at' => now(),
         ]);
     
         return response()->json([
             'message' => 'MFA enabled successfully',
             'mfa_enabled' => true,
         ]);
     }

    /**
     * Disable MFA - requires password confirmation
     */

    public function disable(Request $request): JsonResponse
    {
        $request->validate([
            'password' => 'required|string',
        ]);

        $user = $request->user();

        // Verify password

        if (!Hash::check($request->password, $user->password)) {
            return response()->json([
                'message' => 'Invalid password'
            ], 422);
        }
        // Disable MFA
        if ($user->mfaSetting) {
            $user->mfaSetting->update([
                'is_enabled' => false,
                'secret_key' => null,
                'pending_secret_key' => null,
                'backup_codes' => null,
            ]);
        }

        $user->update([
            'mfa_enabled' => false,
            'mfa_verified_at' => null,
        ]);

        return response()->json([
            'message' => 'MFA disabled successfully',
            'mfa_enabled' => false,
        ]);
    }
    /**
     * Regenerate backup codes
     */
    public function regenerateBackupCodes(Request $request): JsonResponse
    {
        $user = $request->user();
        $mfaSetting = $user->mfaSetting;

        $request->validate(['password' => 'required|string']);
        if (!Hash::check($request->password, $user->password)) {
            return response()->json(['message' => 'Invalid password'], 422);
        }

        if (!$mfaSetting || !$mfaSetting->is_enabled) {
            return response()->json([
                'message' => 'MFA is not enabled'
            ], 422);
        }

        $backupCodes = $this->mfaService->generateBackupCodes();

        $mfaSetting->update([
            'backup_codes' => encrypt(json_encode($backupCodes)),
        ]);

        return response()->json([
            'backup_codes' => $backupCodes,
            'message' => 'Backup codes regenerated successfully'
        ]);
    }

    /**
     * Get MFA status
     */
    public function status(Request $request): JsonResponse
    {
        $user = $request->user();

        return response()->json([
            'mfa_enabled' => $user->mfa_enabled,
            'mfa_verified_at' => $user->mfa_verified_at,
        ]);
    }
}
