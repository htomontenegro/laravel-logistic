<?php

namespace App\Services;

use App\Models\LoginAttempt;
use App\Models\User;
use App\Models\WhitelistedDevice;
use Illuminate\Auth\Events\Login;

class FraudDetectionService
{
    public function __construct(private GeoIpService $geoIp) {}


    // Evaluate risk for login attempt
    // returns ['score' => int, 'flags' => string[], 'geo' => array|null]
    public function evaluate(User $user, string $ip, string $userAgent, string $deviceFingerprint): array
    {
        $score = 0;
        $flag = [];

        $geo = $this->geoIp->lookup($ip);

        // rule 1 - excessive failed attempts in the past hour

        $recentFailures = LoginAttempt::where('email', $user->email)
            ->where('successful', false)
            ->where('created_at', '>', now()->subHour())
            ->count();

        if ($recentFailures > 5) {
            $score += 30;
            $flag[] = 'excessive_failed_attempts';
        }

        // rule 2 - new country

        if ($geo && $geo['country_code']) {
            $knownCountries = LoginAttempt::where('user_id', $user->id)
                ->where('successful', true)
                ->whereNotNull('country_code')
                ->pluck('country_code')
                ->unique()
                ->toArray();

            if (count($knownCountries) > 0 && !in_array($geo['country_code'], $knownCountries)) {
                $score += 20;
                $flag[] = 'new_country';
            }
        }

        // rule 3 - impossible travel
        if ($geo && $geo['latitude'] && $geo['longitude']) {
            $lastLogin = LoginAttempt::where('user_id', $user->id)
                ->where('successful', true)
                ->whereNotNull('latitude')
                ->whereNotNull('longitude')
                ->where('created_at', '>=', now()->subHours(2))
                ->latest()
                ->first();

            if ($lastLogin) {
                $distance = $this->geoIp->distanceKm(
                    $lastLogin->latitude,
                    $lastLogin->longitude,
                    $geo['latitude'],
                    $geo['longitude']
                );

                if ($distance > 500) {
                    $score += 45;
                    $flag[] = 'impossible_travel';
                }
            }
        }

        //rule 4 - unknown device fingerprint

        $knownDevice = WhitelistedDevice::where('user_id', $user->id)
            ->where('device_fingerprint', $deviceFingerprint)
            ->exists();

        if (!$knownDevice) {
            $score += 20;
            $flag[] = 'unknown_device';
        }

        return [
            'score' => $score,
            'flags' => $flag,
            'geo' => $geo,
        ];
    }

    public function record(
        ?User $user,
        string $email,
        string $ip,
        string $userAgent,
        string $deviceFingerprint,
        bool $successful,
        int $riskScore,
        array $riskFlags,
        ?array $geo
    ): void {
        LoginAttempt::create([
            'user_id'            => $user?->id,
            'email'              => $email,
            'ip_address'         => $ip,
            'user_agent'         => $userAgent,
            'device_fingerprint' => $deviceFingerprint,
            'country_code'       => $geo['country_code'] ?? null,
            'city'               => $geo['city'] ?? null,
            'latitude'           => $geo['latitude'] ?? null,
            'longitude'          => $geo['longitude'] ?? null,
            'successful'         => $successful,
            'risk_score'         => $riskScore,
            'risk_flags'         => $riskFlags,
        ]);
    }

    public function isTrustedDevice(User $user, string $fingerprint): bool
    {
        return WhitelistedDevice::where('user_id', $user->id)
            ->where('device_fingerprint', $fingerprint)
            ->exists();
    }

    public function trustDevice(User $user, string $fingerprint, string $ip, ?string $countryCode): void
    {
        WhitelistedDevice::updateOrCreate(
            ['user_id' => $user->id, 'device_fingerprint' => $fingerprint],
            [
                'ip_address'   => $ip,
                'country_code' => $countryCode,
                'last_used_at' => now(),
            ]
        );
    }
}
