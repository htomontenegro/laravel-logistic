<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Customer extends Model
{


    protected $fillable = ['name', 'code', 'margin_pct', 'api_key'];

    protected $casts = ['margin_pct' => 'decimal:2'];

    public function shipments(): HasMany
    {
        return $this->hasMany(Shipment::class);
    }
}