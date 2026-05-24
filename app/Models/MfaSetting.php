<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MfaSetting extends Model
{
    protected $fillable = [
        'user_id',
        'secret_key',
        'is_enabled',
        'backup_codes',
        'pending_secret_key',
    ];

    protected $casts = [
        'is_enabled' => 'boolean',
        //'backup_codes' => 'array',
    ];

    protected $hidden = [
        'secret_key',
        'backup_codes',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
