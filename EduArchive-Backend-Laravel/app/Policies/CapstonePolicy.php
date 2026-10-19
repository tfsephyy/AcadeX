<?php

namespace App\Policies;

use App\Models\Capstone;
use App\Models\User;
use App\Services\CapstoneAccess;

class CapstonePolicy
{
    public function __construct(private CapstoneAccess $access) {}

    public function view(User $user, Capstone $capstone): bool
    {
        return $this->access->view($user, $capstone);
    }

    public function update(User $user, Capstone $capstone): bool
    {
        return ($user->hasRole('admin') || !$capstone->is_archived) && $this->access->manage($user, $capstone);
    }

    public function delete(User $user, Capstone $capstone): bool
    {
        return $this->access->manage($user, $capstone);
    }

    public function restore(User $user, Capstone $capstone): bool
    {
        return $this->access->manage($user, $capstone);
    }

    public function review(User $user, Capstone $capstone): bool
    {
        return $this->access->active($user) && ($user->hasRole('admin') ||
            (!$capstone->is_archived && $this->access->reviewer($user, $capstone)));
    }

    public function download(User $user, Capstone $capstone): bool
    {
        return in_array($user->role?->name, ['admin', 'faculty'], true) && $this->view($user, $capstone);
    }
}
