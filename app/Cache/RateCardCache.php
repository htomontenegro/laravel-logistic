<?php

namespace App\Cache;

use App\Models\RateCard;
use Carbon\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

class RateCardCache
{
    public function getActiveRateCard(int $carrierId, Carbon $date): RateCard
    {
        $cacheKey = "ratecard:{$carrierId}:{$date->toDateString()}";


        return Cache::remember($cacheKey, 3600, function () use ($carrierId, $date) {
            $rateCard = RateCard::where('carrier_id', $carrierId)
                ->where('valid_from', '<=', $date)
                ->where(fn($q) => $q->whereNull('valid_to')
                    ->orWhere('valid_to', '>=', $date))
                ->whereNull('deleted_at')
                ->with('items')
                ->latest('valid_from')
                ->first();

            if (!$rateCard) {
                Log::warning('Rate card fallback used', [
                    'carrier_id' => $carrierId,
                    'date' => $date->toDateString(),
                ]);

                $rateCard = RateCard::where('carrier_id', $carrierId)
                    ->whereNull('deleted_at')
                    ->with('items')
                    ->oldest('valid_from')
                    ->firstOrFail();
            }
            return $rateCard;
        });
    }
}
