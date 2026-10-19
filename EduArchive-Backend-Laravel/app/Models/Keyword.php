<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Keyword extends Model
{
    use HasFactory;

    protected static function booted(): void
    {
        static::addGlobalScope('request_access', function (\Illuminate\Database\Eloquent\Builder $query) {
            if (app()->bound('request') && request()->is('api/*') && !request()->user()?->hasRole('admin')) {
                $query->whereHas('capstones');
            }
        });
    }

    protected $fillable = ['name'];

    public function capstones(): BelongsToMany
    {
        return $this->belongsToMany(Capstone::class, 'capstone_keyword')->withTimestamps();
    }
}
