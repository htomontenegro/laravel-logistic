<?php

namespace Database\Seeders;

use App\Models\Carrier;
use App\Models\RateCard;
use App\Models\RateCardItem;
use Illuminate\Database\Seeder;

class RateCardSeeder extends Seeder
{
    private array $zones = [
        'AU-NSW',
        'AU-VIC',
        'AU-QLD',
        'AU-SA',
        'AU-WA',
        'AU-TAS',
        'AU-NT',
        'AU-ACT',
        'NZ-NI',
        'NZ-SI',
    ];

    private array $bands = [
        [0.001,  0.5],
        [0.501,  1.0],
        [1.001,  5.0],
        [5.001, 10.0],
        [10.001, 30.0],
    ];

    public function run(): void
    {
        Carrier::all()->each(fn(Carrier $carrier) => $this->seedForCarrier($carrier));
    }

    public function seedForCarrier(Carrier $carrier): void
    {
        foreach ([now()->subMonth(), now()] as $valid_from) {
            $rateCard = RateCard::create([
                'carrier_id' => $carrier->id,
                'valid_from' => $valid_from,
                'valid_to' => null,
            ]);
            $this->seedItems($rateCard);
        }
    }

    private function seedItems(RateCard $rateCard): void
    {
        $items = [];

        foreach ($this->zones as $zone) {
            foreach ($this->bands as [$from, $to]) {
                $items[] = [
                    'rate_card_id' => $rateCard->id,
                    'zone'         => $zone,
                    'weight_from'  => $from,
                    'weight_to'    => $to,
                    'price_per_kg' => round(mt_rand(150, 800) / 100, 4),
                    'base_rate'    => round(mt_rand(200, 1500) / 100, 4),
                    'created_at'   => now(),
                    'updated_at'   => now(),
                ];
            }
        }

        RateCardItem::insert($items);
    }
}
