<?php

namespace Database\Seeders;

use App\Models\Customer;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class CustomerSeeder extends Seeder
{
    public function run(): void
    {
        $customers = [
            ['name' => 'Acme Corp',        'code' => 'ACME',  'margin_pct' => 12.50],
            ['name' => 'Blue Ocean Traders','code' => 'BOT',   'margin_pct' => 10.00],
            ['name' => 'Summit Retail',     'code' => 'SR',    'margin_pct' => 15.00],
            ['name' => 'Delta Imports',     'code' => 'DI',    'margin_pct' => 8.00],
            ['name' => 'Horizon Goods',     'code' => 'HG',    'margin_pct' => 11.25],
            ['name' => 'Vertex Supply',     'code' => 'VS',    'margin_pct' => 9.50],
            ['name' => 'Crimson Exports',   'code' => 'CE',    'margin_pct' => 13.00],
            ['name' => 'Prism Trading',     'code' => 'PT',    'margin_pct' => 7.75],
            ['name' => 'Apex Freight',      'code' => 'AF',    'margin_pct' => 14.00],
            ['name' => 'Cobalt Commerce',   'code' => 'CC',    'margin_pct' => 6.50],
            ['name' => 'Nexus Wholesale',   'code' => 'NW',    'margin_pct' => 10.50],
            ['name' => 'Orion Logistics',   'code' => 'OL',    'margin_pct' => 12.00],
            ['name' => 'Atlas Shipping',    'code' => 'AS',    'margin_pct' => 9.00],
            ['name' => 'Zeta Retail',       'code' => 'ZR',    'margin_pct' => 11.00],
            ['name' => 'Echo Imports',      'code' => 'EI',    'margin_pct' => 8.50],
            ['name' => 'Sigma Goods',       'code' => 'SG',    'margin_pct' => 16.00],
            ['name' => 'Titan Cargo',       'code' => 'TC',    'margin_pct' => 5.00],
            ['name' => 'Luna Traders',      'code' => 'LT',    'margin_pct' => 13.50],
            ['name' => 'Nova Freight',      'code' => 'NF',    'margin_pct' => 10.75],
            ['name' => 'Omega Distribution','code' => 'OD',    'margin_pct' => 14.50],
        ];

        foreach ($customers as $data) {
            Customer::firstOrCreate(
                ['code' => $data['code']],
                array_merge($data, ['api_key' => Str::random(40)])
            );
        }
    }
}