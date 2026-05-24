<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Services\MfaService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Hash;

class AuthController extends Controller
{

    private MfaService $mfaService;

    public function __construct(MfaService $mfaService)
    {
        $this->mfaService = $mfaService;
    }

    public function register(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string',
            'email' => 'required|email|unique:users',
            'password' => 'required|string|min:6',
        ]);

        $user = User::create([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'password' => ($validated['password'])
        ]);

        $token = $user->createToken('auth_token')->plainTextToken;

        return response()->json([
            'user' => $user,
            'message' => 'User registered successfully',
            'token' => $token
        ], 201);
    }

    public function login(Request $request)
    {
        $validated = $request->validate([
            'email' => 'required|email',
            'password' => 'required|string',
        ]);

        $user = User::where('email', $validated['email'])->first();

        if (!$user || !Hash::check($validated['password'], $user->password)) {

            return response()->json([
                'message' => 'Invalid credentials'
            ], 401);
        }

        // if MFA is enabled, require code
        if ($user->mfa_enabled) {
            $tempToken = $user->createToken(
                'mfa_verification',
                ['mfa:verify'],
                now()->addMinutes(5)
            )->plainTextToken;
            
            return response()->json([
                'message' => 'MFA verification required',
                'mfa_required' => true,
                'temp_token' => $tempToken,
            ]);
        }

        // no MFA - return full token
        $token = $user->createToken('auth_token')->plainTextToken;

        return response()->json([
            'user' => $user,
            'token' => $token,
            'message' => 'Login successful'
        ]);
    }

    public function verifyMfa(Request $request): JsonResponse
    {
        $request->validate([
            'code' => 'nullable|string|size:6',
            'backup_code' => 'nullable|string',
        ]);

        if (!$request->code && !$request->backup_code){
            return response()->json([
                'message' => 'A code is required'
            ], 422);
        }
        $user = $request->user();

        if (!$user->mfa_enabled) {
            return response()->json([
                'message' => 'MFA is not enabled'
            ], 422);
        }

        $mfaSetting = $user->mfaSetting;

        if (!$mfaSetting) {
            return response()->json([
                'message' => 'MFA settings not found'
            ], 422);
        }

        try {
            $secret = decrypt($mfaSetting->secret_key);
            $backupCodes = json_decode(decrypt($mfaSetting->backup_codes), true) ?? [];
        } catch (\Throwable $e) {
            return response()->json(['message' => 'MFA configuration error'], 500);
        }

        // try to verify TOTP code first
        if ($request->code && $this->mfaService->verifyCode($secret, $request->code)) {
            // revoke temp token
            $user->currentAccessToken()->delete();

            //create full auth token
            $token = $user->createToken('auth_token')->plainTextToken;

            return response()->json([
                'user' => $user,
                'token' => $token,
                'message' => 'Login successful'
            ]);
        }

        // if TOTP failed, try backup code
        if ($request->backup_code) {
            $result = $this->mfaService->verifyBackupCode($backupCodes, $request->backup_code);

            if ($result['valid']) {
                // update remaining backup codes
                $mfaSetting->update([
                    'backup_codes' => encrypt(json_encode($result['codes'])),
                ]);

                // revoke temp token
                $user->currentAccessToken()->delete();

                //  create full auth token
                $token = $user->createToken('auth_token')->plainTextToken;

                return response()->json([
                    'user' => $user,
                    'token' => $token,
                    'message' => 'Login successful'
                ]);
            }
        }
        return response()->json([

            'message' => 'Invalid TOTP code or backup code'
        ], 422);
    }


    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();
        return response()->json(['message' => 'Logout successful']);

    }

    public function user(Request $request)
    {
        return response()->json([
            'user' => $request->user()
        ]);
    }
}
