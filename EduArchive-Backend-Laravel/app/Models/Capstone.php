<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Capstone extends Model
{
    use HasFactory;

    protected $fillable = [
        'title',
        'year',
        'author',
        'program',
        'category',
        'abstract',
        'pdf_path',
        'pdf_original_name',
        'status',
        'is_published',
        'is_archived',
        'uploaded_by',
        'approved_by',
        'approved_at',
        'view_count',
        'download_count',
        'bookmark_count',
    ];

    protected function casts(): array
    {
        return [
            'is_published' => 'boolean',
            'is_archived'  => 'boolean',
            'approved_at'  => 'datetime',
            'year'         => 'integer',
        ];
    }

    // --- Relationships ---

    public function uploader(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }

    public function approver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function keywords(): BelongsToMany
    {
        return $this->belongsToMany(Keyword::class, 'capstone_keyword')->withTimestamps();
    }

    public function bookmarks(): HasMany
    {
        return $this->hasMany(Bookmark::class);
    }

    public function downloads(): HasMany
    {
        return $this->hasMany(Download::class);
    }

    public function views(): HasMany
    {
        return $this->hasMany(CapstoneView::class);
    }

    // --- Scopes ---

    public function scopePublished($query)
    {
        return $query->where('is_published', true);
    }

    public function scopeArchived($query)
    {
        return $query->where('is_archived', true);
    }
}
