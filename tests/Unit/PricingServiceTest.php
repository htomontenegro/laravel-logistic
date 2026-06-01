<?php

namespace Tests\Unit;

use App\Exceptions\PricingException;
use App\Models\Carrier;
use App\Models\Customer;
use App\Models\RateCard;
use App\Models\RateCardItem;
use App\Services\PricingService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;
use Illuminate\Support\Facades\Cache;

class PricingServiceTest extends TestCase
{
    use RefreshDatabase;

    private PricingService $service;
    private Customer $customer;
    private Carrier $carrier;

    protected function setUp(): void
    {
        parent::setUp();

        Cache::flush();

        $this->service  = new PricingService(new \App\Cache\RateCardCache());
        $this->carrier  = Carrier::create(['name' => 'Test Carrier', 'code' => 'TC', 'active' => true]);
        $this->customer = Customer::create([
            'name'       => 'Test Customer',
            'code'       => 'TCUST',
            'margin_pct' => 10.00,
            'api_key'    => 'test-key-12345678901234567890123456789012',
        ]);

        $rateCard = RateCard::create([
            'carrier_id' => $this->carrier->id,
            'valid_from' => now()->toDateString(),
            'valid_to'   => null,
        ]);

        // Two weight bands: light (0–5kg) and heavy (5.001–30kg)
        RateCardItem::insert([
            [
                'rate_card_id' => $rateCard->id,
                'zone'         => 'AU-NSW',
                'weight_from'  => 0.001,
                'weight_to'    => 5.0,
                'price_per_kg' => 2.50,
                'base_rate'    => 5.00,
                'created_at'   => now(),
                'updated_at'   => now(),
            ],
            [
                'rate_card_id' => $rateCard->id,
                'zone'         => 'AU-NSW',
                'weight_from'  => 5.001,
                'weight_to'    => 30.0,
                'price_per_kg' => 1.80,
                'base_rate'    => 12.00,
                'created_at'   => now(),
                'updated_at'   => now(),
            ],
        ]);
    }

    public function test_light_band_selected_for_small_weight(): void
    {
        $quote = $this->service->getQuote($this->carrier->id, $this->customer, 'AU-VIC', 'AU-NSW', 2.0);

        // base_rate=5.00, weight_cost=2.0*2.50=5.00, distance=5.00, subtotal=15.00, margin=1.50
        $this->assertEquals(5.00, $quote['base_rate']);
        $this->assertEquals(5.00, $quote['weight_cost']);
        $this->assertEquals(16.50, $quote['total_price']);
    }

    public function test_heavy_band_selected_for_large_weight(): void
    {
        $quote = $this->service->getQuote($this->carrier->id, $this->customer, 'AU-VIC', 'AU-NSW', 10.0);

        // base_rate=12.00, weight_cost=10.0*1.80=18.00, distance=5.00, subtotal=35.00, margin=3.50
        $this->assertEquals(12.00, $quote['base_rate']);
        $this->assertEquals(18.00, $quote['weight_cost']);
        $this->assertEquals(38.50, $quote['total_price']);
    }

    public function test_exception_thrown_when_no_band_matches(): void
    {
        $this->expectException(\Illuminate\Database\Eloquent\ModelNotFoundException::class);

        // Weight 50kg is outside any band
        $this->service->getQuote($this->carrier->id, $this->customer, 'AU-VIC', 'AU-NSW', 50.0);
    }

    public function test_pricing_exception_thrown_when_total_is_zero(): void
    {
        // Create a zero-priced item to trigger the guard
        $rateCard = RateCard::where('carrier_id', $this->carrier->id)->first();
        RateCardItem::where('rate_card_id', $rateCard->id)->update(['price_per_kg' => 0, 'base_rate' => 0]);

        // Also need distance to be 0 — swap to same-country same-zone won't help with distanceFee
        // Easier: set margin_pct to 0 and force subtotal to 0 via 0 weight
        $this->expectException(PricingException::class);

        $this->customer->update(['margin_pct' => 0]);
        $this->service->getQuote($this->carrier->id, $this->customer, 'AU-NSW', 'AU-NSW', 2.0);
    }
}
