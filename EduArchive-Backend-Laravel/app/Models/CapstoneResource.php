<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CapstoneResource extends Model
{
    use HasFactory;

    protected $fillable = [
        'capstone_id',
        'name',
        'file_path',
        'file_original_name',
    ];

    public function capstone(): BelongsTo
    {
        return $this->belongsTo(Capstone::class);
    }
}
