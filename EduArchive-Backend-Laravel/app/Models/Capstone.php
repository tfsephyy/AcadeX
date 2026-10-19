<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Capstone extends Model
{
    protected $hidden = ['pdf_text', 'pdf_path', 'imrad_path'];
    protected $appends = ['pdf_available', 'imrad_available', 'imrad_reference'];

    protected static function booted(): void
    {
        // One request boundary also covers route binding, related references,
        // search/filter queries and chatbot aggregate helpers. CLI maintenance
        // has no browser request and is not accidentally scoped to a web user.
        static::addGlobalScope('request_access', function (\Illuminate\Database\Eloquent\Builder $query) {
            if (app()->bound('request') && request()->is('api/*')) {
                app(\App\Services\CapstoneAccess::class)->scope($query, request()->user());
            }
        });
    }

    public function resolveRouteBinding($value, $field = null)
    {
        $method = request()->route()?->getActionMethod();
        if (in_array($method, ['unarchive', 'destroy'], true)) {
            $user = request()->user();
            $query = static::withoutGlobalScope('request_access')->where($field ?? $this->getRouteKeyName(), $value);
            if (!$user || !app(\App\Services\CapstoneAccess::class)->active($user)) return null;
            if (!$user->hasRole('admin')) $query->where('uploaded_by', $user->id);
            return $query->first();
        }
        return parent::resolveRouteBinding($value, $field);
    }

    public function getPdfAvailableAttribute(): bool
    {
        return !empty($this->pdf_path);
    }

    public function getImradAvailableAttribute(): bool
    {
        return !empty($this->imrad_path);
    }

    public function getImradReferenceAttribute(): ?string
    {
        return $this->imrad_path ? 'imrad:'.$this->id : null;
    }

    public function toArray(): array
    {
        $data = parent::toArray();
        $user = app()->bound('request') ? request()->user() : null;
        $access = app(\App\Services\CapstoneAccess::class);
        if (!$user || !($access->manage($user, $this) || $access->reviewer($user, $this))) {
            unset($data['author_details'], $data['imrad_reference']);
        }
        return $data;
    }
    use HasFactory;

    protected $fillable = [
        'title',
        'year',
        'author',
        'author_details',     // JSON: [{name, email, contact}, ...]
        'program',
        'category',
        'abstract',
        'pdf_path',
        'pdf_original_name',
        'pdf_text',          // full extracted text from PDF — used by chatbot
        'status',
        'is_archived',
        'publication_status',
        'copyright_status',
        'imrad_path',
        'imrad_original_name',
        'adviser_id',
        'uploaded_by',
        'approved_by',
        'approved_at',
        'approval_status',
        'rejection_reason',
        'view_count',
        'download_count',
        'bookmark_count',
    ];

    protected function casts(): array
    {
        return [
            'is_archived'    => 'boolean',
            'approved_at'    => 'datetime',
            'year'           => 'integer',
            'author_details' => 'array',
        ];
    }

    /**
     * Virtual accessor: a capstone is considered "published" on the platform
     * when it has been approved (approval_status = 'approved') and is not archived.
     * NOTE: publication_status is a SEPARATE field for external publication tracking
     * (e.g., published to a journal or external site) and has NO effect on platform visibility.
     */
    public function getIsPublishedAttribute(): bool
    {
        return $this->approval_status === 'approved' && !$this->is_archived;
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

    public function adviser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'adviser_id');
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

    public function resources(): HasMany
    {
        return $this->hasMany(CapstoneResource::class);
    }

    public function referencedCapstones(): BelongsToMany
    {
        return $this->belongsToMany(
            Capstone::class,
            'capstone_references',
            'capstone_id',
            'referenced_capstone_id'
        )->withTimestamps();
    }

    public function referencedBy(): BelongsToMany
    {
        return $this->belongsToMany(
            Capstone::class,
            'capstone_references',
            'referenced_capstone_id',
            'capstone_id'
        )->withTimestamps();
    }

    // --- Scopes ---

    /**
     * Scope: capstones visible on the platform.
     * Platform visibility is controlled ONLY by approval_status.
     * NOTE: publication_status is for EXTERNAL publication tracking only
     * (e.g., published to a journal) and has NO relation to platform visibility.
     */
    public function scopePublished($query)
    {
        return $query->where('approval_status', 'approved')
                     ->where('is_archived', false);
    }

    /** Alias for scopePublished — use for clarity where intent matters. */
    public function scopeApproved($query)
    {
        return $query->where('approval_status', 'approved')
                     ->where('is_archived', false);
    }

    public function scopeArchived($query)
    {
        return $query->where('is_archived', true);
    }
}
