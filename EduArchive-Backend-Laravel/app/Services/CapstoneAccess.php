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

    public function published(Capstone $capstone): bool
    {
        return !$capstone->is_archived && $capstone->publication_status === 'published'
            && $capstone->status === 'approved' && $capstone->approval_status === 'approved';
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

    public function view(User $user, Capstone $capstone): bool
    {
        if (!$this->active($user)) return false;
        if ($user->hasRole('admin')) return true;
        if ($capstone->is_archived) return false;
        return $this->owner($user, $capstone) || $this->reviewer($user, $capstone) || $this->published($capstone);
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
            $allowed->where(function (Builder $public) use ($column) {
                $public->where($column('publication_status'), 'published')
                    ->where($column('status'), 'approved')->where($column('approval_status'), 'approved');
            });
            if (in_array($user->role?->name, ['faculty', 'student'], true)) {
                $allowed->orWhere($column('uploaded_by'), $user->id);
            }
            if ($user->hasRole('faculty')) {
                $allowed->orWhere(function (Builder $review) use ($user, $column) {
                    $review->where($column('adviser_id'), $user->id)
                        ->whereHas('uploader.role', fn ($role) => $role->where('name', 'student'));
                });
            }
        });
    }
}
