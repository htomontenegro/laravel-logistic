<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Quote extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'shipment_id', 'carrier_id', 'rate_card_item_id',
        'base_rate', 'weight_cost', 'distance_cost', 'margin', 'total_price', 'calculated_at',
    ];

    protected $casts = [
        'base_rate'     => 'decimal:4',
        'weight_cost'   => 'decimal:4',
        'distance_cost' => 'decimal:4',
        'margin'        => 'decimal:4',
        'total_price'   => 'decimal:4',
        'calculated_at' => 'datetime',
        'created_at'    => 'datetime',
    ];

    public function carrier(): BelongsTo
    {
        return $this->belongsTo(Carrier::class);
    }

    public function rateCardItem(): BelongsTo
    {
        return $this->belongsTo(RateCardItem::class);
    }

    public function shipment(): BelongsTo
    {
        return $this->belongsTo(Shipment::class);
    }
}