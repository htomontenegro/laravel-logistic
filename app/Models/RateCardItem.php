<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RateCardItem extends Model
{
    protected $fillable = ['rate_card_id', 'zone', 'weight_from', 'weight_to', 'price_per_kg', 'base_rate'];

    protected $casts = [
        'weight_from'  => 'decimal:3',
        'weight_to'    => 'decimal:3',
        'price_per_kg' => 'decimal:4',
        'base_rate'    => 'decimal:4',
    ];

    public function rateCard(): BelongsTo
    {
        return $this->belongsTo(RateCard::class);
    }
}
