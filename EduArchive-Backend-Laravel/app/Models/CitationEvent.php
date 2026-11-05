<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CitationEvent extends Model
{
    protected $fillable = [
        'capstone_id',
        'user_id',
        'format',
        'action',
        'ip_hash',
    ];

    public function capstone(): BelongsTo
    {
        return $this->belongsTo(Capstone::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
