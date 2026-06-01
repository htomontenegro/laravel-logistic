<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class RateCard extends Model
{
    use SoftDeletes;

    protected $fillable = ['carrier_id', 'valid_from', 'valid_to'];
    protected $casts = ['valid_from' => 'date', 'valid_to' => 'date'];

    public function carrier(): BelongsTo
    {
        return $this->belongsTo(Carrier::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(RateCardItem::class);
    }
}
