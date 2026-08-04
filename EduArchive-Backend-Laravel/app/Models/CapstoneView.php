<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CapstoneView extends Model
{
    protected $table = 'capstone_views';

    protected $fillable = ['user_id', 'capstone_id', 'ip_address'];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function capstone(): BelongsTo
    {
        return $this->belongsTo(Capstone::class);
    }
}
