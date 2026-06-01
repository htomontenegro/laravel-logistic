<?php

namespace Database\Seeders;

use App\Models\Carrier;
use Illuminate\Database\Seeder;

class CarrierSeeder extends Seeder
{
    public function run(): void
    {
        $carriers = [
            ['name' => 'FastFreight',       'code' => 'FF'],
            ['name' => 'BlueStar Logistics', 'code' => 'BSL'],
            ['name' => 'PacificCargo',       'code' => 'PC'],
            ['name' => 'Speedway Express',   'code' => 'SWE'],
            ['name' => 'TransOcean',         'code' => 'TO'],
        ];

        $rateCardSeeder = new RateCardSeeder();

        foreach ($carriers as $data) {
            $carrier = Carrier::firstOrCreate(
                ['code' => $data['code']],
                array_merge($data, ['active' => true])
            );

            if ($carrier->wasRecentlyCreated) {
                $rateCardSeeder->seedForCarrier($carrier);
            }
        }
    }
}