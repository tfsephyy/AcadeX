<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Validation\ValidationException;

class AdviserMatching
{
    public static function displayName(?string $name): string
    {
        return trim(preg_replace('/\s+/u', ' ', $name ?? ''));
    }

    public static function normalized(?string $name): string
    {
        return mb_strtolower(self::displayName($name), 'UTF-8');
    }

    public function eligible(): Builder
    {
        return User::whereHas('role', fn ($query) => $query->where('name', 'faculty'))
            ->where('is_approved', true)->where('is_archived', false)->where('adviser_available', true);
    }

    /** Resolve again on save; never trust a browser-supplied automatic match. */
    public function resolve(?string $name, int|string|null $selectedId = null): array
    {
        $name = self::displayName($name);
        $faculty = $this->eligible()->get(['id', 'name']);
        if ($name === '' && $selectedId) {
            $selected = $faculty->firstWhere('id', (int) $selectedId);
            if (!$selected) $this->invalidSelection();
            return ['adviser_name' => self::displayName($selected->name), 'adviser_id' => $selected->id];
        }

        $matches = $name === '' ? collect() : $faculty->filter(
            fn (User $user) => self::normalized($user->name) === self::normalized($name)
        );
        if ($selectedId && !$matches->contains('id', (int) $selectedId)) $this->invalidSelection();

        return [
            'adviser_name' => $name === '' ? null : $name,
            'adviser_id' => $selectedId ? (int) $selectedId : ($matches->count() === 1 ? $matches->first()->id : null),
        ];
    }

    private function invalidSelection(): never
    {
        throw ValidationException::withMessages([
            'adviser_id' => 'Select an active, available Faculty account matching the adviser name.',
        ]);
    }
}
