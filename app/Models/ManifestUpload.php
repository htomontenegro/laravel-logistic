<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ManifestUpload extends Model
{
    protected $fillable = [
        'carrier_id',
        'original_filename',
        's3_path',
        'status',
        'total_rows',
        'valid_rows',
        'invalid_rows'  
    ];

    protected $casts = [
        'invalid_rows' => 'array'
    ];

    public function carrier(): BelongsTo
    {
        return $this->belongsTo(Carrier::class);
    }
}