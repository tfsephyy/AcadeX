<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;

    protected $fillable = [
        'name',
        'username',
        'email',
        'id_number',
        'role_id',
        'password',
        'is_locked',
        'is_approved',
        'is_archived',
        'faculty_program',
        'login_attempts',
        'locked_until',
        'last_active_at',
    ];

    protected $hidden = [
        'password',
        'remember_token',
        'auth_version',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'locked_until'      => 'datetime',
            'last_active_at'    => 'datetime',
            'password'          => 'hashed',
            'is_locked'         => 'boolean',
            'is_approved'       => 'boolean',
            'is_archived'       => 'boolean',
            'auth_version'      => 'integer',
        ];
    }

    protected static function booted(): void
    {
        static::updated(function (User $user) {
            if ($user->wasChanged('auth_version')) {
                $user->auth_version = (int) $user->newQuery()->whereKey($user->getKey())->value('auth_version');
                $user->tokens()->delete();
            }
        });
    }

    protected function performUpdate(Builder $query): bool
    {
        if (! $this->isDirty(['password', 'email', 'is_approved', 'is_archived', 'role_id'])) {
            return parent::performUpdate($query);
        }

        return $this->getConnection()->transaction(function () use ($query) {
            // Lock until version retrieval and token revocation complete. Stale model
            // instances must increment the persisted version, never their snapshot.
            $current = $this->newQuery()->whereKey($this->getKey())->lockForUpdate()->firstOrFail();
            $this->auth_version = (int) $current->auth_version + 1;
            return parent::performUpdate($query);
        });
    }

    public function advisedCapstones(): HasMany
    {
        return $this->hasMany(Capstone::class, 'adviser_id');
    }

    /* ── Relationships ─────────────────────────────────── */

    public function role(): BelongsTo
    {
        return $this->belongsTo(Role::class);
    }

    public function studentProfile(): HasOne
    {
        return $this->hasOne(StudentProfile::class);
    }

    public function uploadedCapstones(): HasMany
    {
        return $this->hasMany(Capstone::class, 'uploaded_by');
    }

    public function approvedCapstones(): HasMany
    {
        return $this->hasMany(Capstone::class, 'approved_by');
    }

    public function bookmarks(): HasMany
    {
        return $this->hasMany(Bookmark::class);
    }

    public function notifications(): HasMany
    {
        return $this->hasMany(Notification::class, 'admin_id');
    }

    /* ── Helpers ───────────────────────────────────────── */

    public function isAdmin(): bool
    {
        return $this->role?->name === 'admin';
    }

    public function isStudent(): bool
    {
        return $this->role?->name === 'student';
    }

    public function isFaculty(): bool
    {
        return $this->role?->name === 'faculty';
    }

    public function hasRole(string $role): bool
    {
        return $this->role?->name === $role;
    }
}
