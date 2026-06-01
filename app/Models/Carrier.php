<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Carrier extends Model
{
    protected $fillable = ['name', 'code', 'active'];

    protected $casts = ['active' => 'boolean'];

    public function rateCards(): HasMany
    {
        return $this->hasMany(RateCard::class);
    }
}