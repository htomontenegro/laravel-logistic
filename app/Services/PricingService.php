<?php

namespace App\Services;

use App\Cache\RateCardCache;
use App\Exceptions\PricingException;
use App\Models\Carrier;
use App\Models\Customer;
use Illuminate\Database\Eloquent\ModelNotFoundException;

class PricingService
{
    public function __construct(private RateCardCache $cache) {}

    public function getQuotesForAllCarriers(
        Customer $customer,
        string $originZone,
        string $destinationZone,
        float $weight
    ): array {
        $carriers = Carrier::where('active', true)->get();
        $quotes = [];

        foreach ($carriers as $carrier) {
            try {
                $quotes[] = $this->getQuote(
                    $carrier->id,
                    $customer,
                    $originZone,
                    $destinationZone,
                    $weight
                );
            } catch (ModelNotFoundException $e) {
            }
        }
        usort($quotes, fn($a, $b) => $a['total_price'] <=> $b['total_price']);
        return $quotes;
    }


    public function getQuote(
        int $carrierId,
        Customer $customer,
        string $originZone,
        string $destinationZone,
        float $weight
    ): array {
        $rateCard = $this->cache->getActiveRateCard($carrierId, now());

        $item = $rateCard->items
            ->filter(
                fn($i) =>
                $i->zone === $destinationZone &&
                    (float) $i->weight_from <= (float) $weight &&
                    (float) $i->weight_to >= (float) $weight
            )
            ->first();

        if (!$item) {
            throw new ModelNotFoundException(
                "No rate card item found for carrier: {$carrierId}, origin zone: {$originZone}, destination zone: {$destinationZone}, weight: {$weight}"
            );
        }

        $weightCost   = $weight * (float) $item->price_per_kg;
        $distanceCost = $this->distanceFee($originZone, $destinationZone);
        $subtotal     = (float) $item->base_rate + $weightCost + $distanceCost;
        $margin       = $subtotal * ((float) $customer->margin_pct / 100);
        $total        = $subtotal + $margin;

        throw_if($total <= 0, PricingException::class, 'Quote total must be > 0');

        return [
            'carrier_id'        => $carrierId,
            'rate_card_item_id' => $item->id,
            'base_rate'         => (float) $item->base_rate,
            'weight_cost'       => $weightCost,
            'distance_cost'     => $distanceCost,
            'margin'            => $margin,
            'total_price'       => $total,
            'calculated_at'     => now(),
        ];
    }

    private function distanceFee(string $origin, string $destination): float
    {
        if ($origin === $destination) return 0.00;

        $originCountry = explode('-', $origin)[0];
        $destinationCountry = explode('-', $destination)[0];

        return $originCountry === $destinationCountry ? 5.00 : 25.00;
    }

}
