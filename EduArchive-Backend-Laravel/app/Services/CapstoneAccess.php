<?php

namespace App\Services;

use App\Models\Capstone;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;

class CapstoneAccess
{
    public function active(?User $user): bool
    {
        return $user && $user->is_approved && !$user->is_archived && $user->email_verified_at
            && in_array($user->role?->name, ['admin', 'faculty', 'student', 'visitor'], true);
    }

    /**
     * A record is in the approved capstone library once review has approved it.
     * publication_status remains the separate external/public-release flag used
     * for the visitor full-document tier.
     */
    public function published(Capstone $capstone): bool
    {
        return !$capstone->is_archived && $capstone->approval_status === 'approved';
    }

    public function owner(User $user, Capstone $capstone): bool
    {
        return in_array($user->role?->name, ['faculty', 'student'], true)
            && (int) $capstone->uploaded_by === (int) $user->id;
    }

    public function reviewer(User $user, Capstone $capstone): bool
    {
        return $user->hasRole('faculty') && (int) $capstone->adviser_id === (int) $user->id
            && $capstone->uploader?->hasRole('student');
    }

    /**
     * Visitor-tier check: approved records become visitor-visible when they are
     * externally published, copyright-cleared, or have an IMRAD document.
     */
    public function visitorVisible(Capstone $capstone): bool
    {
        return !$capstone->is_archived
            && $capstone->approval_status === 'approved'
            && (
                $capstone->publication_status === 'published'
                || $capstone->copyright_status === 'copyrighted'
                || !empty($capstone->imrad_path)
            );
    }

    /**
     * Visitors may receive the complete PDF/resources only for published or
     * copyright-cleared records. IMRAD-only records never pass this check.
     */
    public function visitorCanViewDocument(Capstone $capstone): bool
    {
        return !$capstone->is_archived
            && $capstone->approval_status === 'approved'
            && (
                $capstone->publication_status === 'published'
                || $capstone->copyright_status === 'copyrighted'
            );
    }

    public function view(User $user, Capstone $capstone): bool
    {
        if (!$this->active($user)) return false;
        if ($user->hasRole('admin')) return true;
        if ($capstone->is_archived) return false;
        if ($this->owner($user, $capstone) || $this->reviewer($user, $capstone)) return true;

        // Approved records are the platform library for authenticated students
        // and faculty. Visitors get the complete document only in the two
        // full-access tiers; the dedicated visitor routes expose IMRAD-only
        // records without letting the generic PDF/resource routes through.
        if (in_array($user->role?->name, ['faculty', 'student'], true)) {
            return $this->published($capstone);
        }
        if ($user->hasRole('visitor')) {
            return $this->visitorCanViewDocument($capstone);
        }

        return false;
    }

    /**
     * Whether an authenticated user can interact with the record (record-level
     * operations such as bookmarking and view tracking).
     * For visitors, this checks visitorVisible() so approved IMRAD-only records
     * can be bookmarked and tracked without opening full-document PDF/resource access.
     */
    public function canAccessRecord(User $user, Capstone $capstone): bool
    {
        if (!$this->active($user)) return false;
        if ($user->hasRole('admin')) return true;
        if ($capstone->is_archived) return false;
        if ($this->owner($user, $capstone) || $this->reviewer($user, $capstone)) return true;

        if (in_array($user->role?->name, ['faculty', 'student'], true)) {
            return $this->published($capstone);
        }
        if ($user->hasRole('visitor')) {
            return $this->visitorVisible($capstone);
        }

        return false;
    }

    public function manage(User $user, Capstone $capstone): bool
    {
        return $this->active($user) && ($user->hasRole('admin') || $this->owner($user, $capstone));
    }

    public function scope(Builder $query, ?User $user): void
    {
        if (!$this->active($user)) {
            $query->whereRaw('1 = 0');
            return;
        }
        if ($user->hasRole('admin')) return;

        $column = fn ($name) => $query->getModel()->qualifyColumn($name);
        $query->where($column('is_archived'), false)->where(function (Builder $allowed) use ($user, $column) {
            if (in_array($user->role?->name, ['faculty', 'student'], true)) {
                $allowed->where(function (Builder $library) use ($column) {
                    $library->where($column('approval_status'), 'approved');
                })->orWhere($column('uploaded_by'), $user->id);

                if ($user->hasRole('faculty')) {
                    $allowed->orWhere(function (Builder $review) use ($user, $column) {
                        $review->where($column('adviser_id'), $user->id)
                            ->whereHas('uploader.role', fn ($role) => $role->where('name', 'student'));
                    });
                }
                return;
            }

            // Visitors only see approved records that meet a visitor tier.
            $allowed->where($column('approval_status'), 'approved')
                ->where(function (Builder $tier) use ($column) {
                    $tier->where($column('publication_status'), 'published')
                        ->orWhere($column('copyright_status'), 'copyrighted')
                        ->orWhereNotNull($column('imrad_path'));
                });
        });
    }
}
