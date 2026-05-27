<?php

namespace App\Services;

use MaxMind\Db\Reader;
use Illuminate\Support\Facades\Log;

class GeoIpService
{
    private ?Reader $reader = null;

    private function reader(): ?Reader
    {
        if ($this->reader) {
            return $this->reader;
        }

        $path = storage_path('app/GeoLite2-City.mmdb');

        if (!file_exists($path)) {
            Log::warning('GeoLite2 database not found at ' . $path);
            return null;
        }

        $this->reader = new Reader($path);
        return $this->reader;
    }

    public function lookup(string $ip): ?array
    {
        if ($this->isPrivateIp($ip)) {
            if (app()->isLocal()) {
                return [
                    'country_code' => config('app.geoip_dev_country', 'AU'),
                    'city'         => config('app.geoip_dev_city', 'Sydney'),
                    'latitude'     => (float) config('app.geoip_dev_lat', -33.8688),
                    'longitude'    => (float) config('app.geoip_dev_lon', 151.2093),
                ];
            }
            return null;
        }

        try {
            $reader = $this->reader();
            if (!$reader) {
                return null;
            }

            $record = $reader->get($ip);

            if (!$record) {
                return null;
            }

            return [
                'country_code' => $record['country']['iso_code'] ?? null,
                'city'         => $record['city']['names']['en'] ?? null,
                'latitude'     => $record['location']['latitude'] ?? null,
                'longitude'    => $record['location']['longitude'] ?? null,
            ];
        } catch (\Throwable $e) {
            Log::warning("GeoIP lookup failed for {$ip}: " . $e->getMessage());
            return null;
        }
    }

    private function isPrivateIp(string $ip): bool
    {
        return filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE) === false;
    }

    public function distanceKm(float $lat1, float $lon1, float $lat2, float $lon2): float
    {
        $earthRadius = 6371;
        $dLat = deg2rad($lat2 - $lat1);
        $dLon = deg2rad($lon2 - $lon1);
        $a = sin($dLat / 2) ** 2 +
             cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLon / 2) ** 2;
        return $earthRadius * 2 * asin(sqrt($a));
    }

    public function __destruct()
    {
        $this->reader?->close();
    }
}