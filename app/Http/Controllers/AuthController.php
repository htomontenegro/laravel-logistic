<?php

namespace App\Http\Controllers;

use App\Mail\LoginVerificationMail;
use App\Models\User;
use App\Services\FraudDetectionService;
use App\Services\MfaService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;

class AuthController extends Controller
{


    public function __construct(
        private MfaService $mfaService,
        private FraudDetectionService $fraudService,
    ) {}

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

        $ip                = $request->ip();
        $userAgent         = $request->userAgent() ?? '';
        $deviceFingerprint = $request->header('X-Device-Fingerprint', hash('sha256', $userAgent));

        $user = User::where('email', $validated['email'])->first();

        if (!$user || !Hash::check($validated['password'], $user->password)) {

            $this->fraudService->record(
                $user,
                $validated['email'],
                $ip,
                $userAgent,
                $deviceFingerprint,
                false,
                0,
                [],
                null
            );
            return response()->json([
                'message' => 'Invalid credentials'
            ], 401);
        }

        // evaluate fraud risk
        $fraud = $this->fraudService->evaluate($user, $ip, $userAgent, $deviceFingerprint);

        // record attempt (not yet successfull - will be marked successful after all verifications pass)
        $this->fraudService->record(
            $user,
            $user->email,
            $ip,
            $userAgent,
            $deviceFingerprint,
            false,
            $fraud['score'],
            $fraud['flags'],
            $fraud['geo']
        );

        // high-risk: require emial verification before proceeding
        if ($fraud['score'] >= 40) {
            $code = (string) random_int(100000, 999999);
            $cacheKey = "fraud_verify:{$user->id}:" . hash('sha256', $deviceFingerprint);
            Cache::put($cacheKey, $code, now()->addMinutes(10));
            Mail::to($user->email)->send(new LoginVerificationMail($code));

            $tempToken = $user->createToken(
                'fraud_verification',
                ['fraud:verify'],
                now()->addMinutes(10)
            )->plainTextToken;

            return response()->json([
                'message'                      => 'Email verification required',
                'email_verification_required'  => true,
                'risk_flags'                   => $fraud['flags'],
                'temp_token'                   => $tempToken,
            ], 202);
        }

        // low risk - proceed to MFA check or issue token

        return $this->issueTokenOrRequireMfa($user, $deviceFingerprint, $ip, $fraud['geo']['country_code'] ?? null);
    }


    public function verifyFraud(Request $request): JsonResponse
    {
        $request->validate(['code' => 'required|string|size:6']);

        $user = $request->user();
        $deviceFingerprint = $request->header('X-Device-Fingerprint', hash('sha256', $request->userAgent() ?? ''));
        $cacheKey          = "fraud_verify:{$user->id}:" . hash('sha256', $deviceFingerprint);

        $stored = Cache::get($cacheKey);

        if (!$stored || $stored !== $request->code) {
            return response()->json(['message' => 'Invalid or expired verification code'], 422);
        }

        Cache::forget($cacheKey);
        $user->currentAccessToken()->delete();

        // Optionally trust this device
        if ($request->boolean('trust_device')) {
            $geo = app(\App\Services\GeoIpService::class)->lookup($request->ip());
            $this->fraudService->trustDevice(
                $user,
                $deviceFingerprint,
                $request->ip(),
                $geo['country_code'] ?? null
            );
        }

        return $this->finalizeLogin($user, $request);
    }


    public function verifyMfa(Request $request): JsonResponse
    {
        $request->validate([
            'code' => 'nullable|string|size:6',
            'backup_code' => 'nullable|string',
        ]);

        if (!$request->code && !$request->backup_code) {
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
            return $this->finalizeLogin($user, $request);
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
                return $this->finalizeLogin($user, $request);
            }
        }
        return response()->json([

            'message' => 'Invalid TOTP code or backup code'
        ], 422);
    }


    private function issueTokenOrRequireMfa(User $user, string $deviceFingerprint, string $ip, ?string $countryCode): JsonResponse
    {
        if ($user->mfa_enabled) {
            $tempToken = $user->createToken(
                'mfa_verification',
                ['mfa:verify'],
                now()->addMinutes(5)
            )->plainTextToken;

            return response()->json([
                'message'      => 'MFA verification required',
                'mfa_required' => true,
                'temp_token'   => $tempToken,
            ]);
        }

        $this->fraudService->trustDevice($user, $deviceFingerprint, $ip, $countryCode);
        $token = $user->createToken('auth_token')->plainTextToken;

        return response()->json([
            'user'    => $user,
            'token'   => $token,
            'message' => 'Login successful',
        ]);
    }

    public function finalizeLogin(User $user, Request $request): JsonResponse
    {
        $deviceFingerprint = $request->header('X-Device-Fingerprint', hash('sha256', $request->userAgent() ?? ''));
        $geo               = app(\App\Services\GeoIpService::class)->lookup($request->ip());

        $this->fraudService->trustDevice($user, $deviceFingerprint, $request->ip(), $geo['country_code'] ?? null);
        $this->fraudService->record(
            $user,
            $user->email,
            $request->ip(),
            $request->userAgent() ?? '',
            $deviceFingerprint,
            true,
            0,
            [],
            $geo
        );

        $user->currentAccessToken()->delete();
        $token = $user->createToken('auth_token')->plainTextToken;

        return response()->json([
            'user'    => $user,
            'token'   => $token,
            'message' => 'Login successful',
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();
        return response()->json(['message' => 'Logout successful']);
    }

    public function user(Request $request): JsonResponse
    {
        return response()->json(['user' => $request->user()]);
    }
}
