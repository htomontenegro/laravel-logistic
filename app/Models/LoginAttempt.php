<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;


class LoginAttempt extends Model
{
    protected $fillable = [
        'user_id',
        'email',
        'ip_address',
        'user_agent',
        'device_fingerprint',
        'country_code',
        'city',
        'latitude',
        'longitude',
        'successful',
        'risk_score',
        'risk_flags',
    ];

    protected $casts = [
        'successful' => 'boolean',
        'risk_flags' => 'array',
        'latitude' => 'float',
        'longitude' => 'float',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
    
}
