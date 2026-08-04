<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Bookmark extends Model
{
    protected $fillable = ['user_id', 'capstone_id'];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function capstone(): BelongsTo
    {
        return $this->belongsTo(Capstone::class);
    }
}
