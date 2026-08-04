<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Keyword extends Model
{
    use HasFactory;

    protected $fillable = ['name'];

    public function capstones(): BelongsToMany
    {
        return $this->belongsToMany(Capstone::class, 'capstone_keyword')->withTimestamps();
    }
}
