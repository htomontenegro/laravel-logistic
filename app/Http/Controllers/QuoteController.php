<?php

namespace App\Http\Controllers;

use App\Models\Customer;
use App\Models\Quote;
use App\Models\Shipment;
use App\Services\PricingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class QuoteController extends Controller
{
    public function __construct(private PricingService $pricing) {}

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'customer_id'      => 'required|integer|exists:customers,id',
            'origin_zone'      => 'required|string|max:10',
            'destination_zone' => 'required|string|max:10',
            'weight'           => 'required|numeric|min:0.001',
        ]);

        $customer = Customer::findOrFail($validated['customer_id']);

        $shipment = Shipment::create([
            'origin_zone'      => $validated['origin_zone'],
            'destination_zone' => $validated['destination_zone'],
            'weight'           => $validated['weight'],
            'customer_id'      => $customer->id,
            'status'           => 'pending',
        ]);

        $ranked = $this->pricing->getQuotesForAllCarriers(
            $customer,
            $validated['origin_zone'],
            $validated['destination_zone'],
            (float)$validated['weight']
        );

        foreach ($ranked as $q) {
            Quote::create([
                'shipment_id'       => $shipment->id,
                'carrier_id'        => $q['carrier_id'],
                'rate_card_item_id' => $q['rate_card_item_id'],
                'base_rate'         => $q['base_rate'],
                'weight_cost'       => $q['weight_cost'],
                'distance_cost'     => $q['distance_cost'],
                'margin'            => $q['margin'],
                'total_price'       => $q['total_price'],
                'calculated_at'     => $q['calculated_at'],
            ]);
        }
        return response()->json([
            'shipment_id' => $shipment->id,
            'ranked_quotes' => $ranked
        ],201);
    }
}
