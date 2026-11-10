<?php

namespace App\Services;

use App\Models\Capstone;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;

class AdviserMatching
{
    public static function displayName(?string $name): string
    {
        return trim(preg_replace('/\s+/u', ' ', $name ?? ''));
    }

    public static function normalized(?string $name): string
    {
        return \App\Services\Extraction\NameNormalizer::key($name);
    }

    public function eligible(): Builder
    {
        return User::whereHas('role', fn ($query) => $query->where('name', 'faculty'))
            ->where('is_approved', true)->where('is_archived', false)->where('adviser_available', true);
    }

    /**
     * Extract distinct advisers from the scoped capstone query.
     * Includes registered faculty accounts and manually entered advisers.
     * Deduplicates by normalized name and returns a collection of ['id' => ..., 'name' => ...]
     * sorted alphabetically.
     */
    public function extractOptions(Builder $capstoneQuery): Collection
    {
        $recordsQuery = (clone $capstoneQuery);
        $recordsQuery->getQuery()->orders = null;

        $records = $recordsQuery
            ->where(function ($q) {
                $q->whereNotNull('capstones.adviser_id')
                  ->orWhere(function ($inner) {
                      $inner->whereNotNull('capstones.adviser_name')
                            ->where('capstones.adviser_name', '!=', '');
                  });
            })
            ->select(['capstones.adviser_id', 'capstones.adviser_name'])
            ->distinct()
            ->get();

        if ($records->isEmpty()) {
            return collect();
        }

        $adviserIds = $records->pluck('adviser_id')->filter()->unique()->values();
        $facultyMap = $adviserIds->isNotEmpty()
            ? User::whereIn('id', $adviserIds)->get(['id', 'name'])->keyBy('id')
            : collect();

        $entriesByKey = [];

        foreach ($records as $record) {
            $faculty = $record->adviser_id ? $facultyMap->get($record->adviser_id) : null;
            $rawName = trim((string) $record->adviser_name);

            $referenceName = $faculty?->name ?? ($rawName !== '' ? $rawName : null);
            if (!$referenceName) {
                continue;
            }

            $key = self::normalized($referenceName);
            if ($key === '') {
                $key = mb_strtolower(trim($referenceName));
            }
            if ($key === '') {
                continue;
            }

            if (!isset($entriesByKey[$key])) {
                $entriesByKey[$key] = [
                    'faculty_id' => $faculty?->id,
                    'official_name' => $faculty?->name,
                    'raw_names' => [],
                ];
            }

            if ($faculty && empty($entriesByKey[$key]['faculty_id'])) {
                $entriesByKey[$key]['faculty_id'] = $faculty->id;
                $entriesByKey[$key]['official_name'] = $faculty->name;
            }

            if ($rawName !== '') {
                $entriesByKey[$key]['raw_names'][] = $rawName;
            }
        }

        $options = [];
        foreach ($entriesByKey as $key => $entry) {
            $displayName = null;
            if (!empty($entry['official_name'])) {
                $displayName = self::displayName($entry['official_name']);
            } else {
                $uniqueRaw = array_values(array_unique($entry['raw_names']));
                usort($uniqueRaw, function ($a, $b) {
                    $aLower = ($a === mb_strtolower($a));
                    $bLower = ($b === mb_strtolower($b));
                    if ($aLower !== $bLower) {
                        return $aLower ? 1 : -1;
                    }
                    return strlen($a) <=> strlen($b);
                });
                $displayName = self::displayName($uniqueRaw[0] ?? $key);
            }

            if (empty($displayName)) {
                continue;
            }

            $options[] = [
                'id' => $entry['faculty_id'] !== null ? $entry['faculty_id'] : $displayName,
                'name' => $displayName,
            ];
        }

        usort($options, fn ($a, $b) => strnatcasecmp($a['name'], $b['name']));

        return collect($options);
    }

    /**
     * Apply adviser filter to a capstone query.
     * Supports filtering by registered faculty user ID or by adviser name.
     * Matches across adviser_id foreign keys and adviser_name string records.
     */
    public function applyFilter(Builder $query, mixed $adviserParam): Builder
    {
        if ($adviserParam === null || $adviserParam === '') {
            return $query;
        }

        $adviserStr = trim((string) $adviserParam);
        if ($adviserStr === '' || in_array(strtolower($adviserStr), ['all', 'null', 'undefined'], true)) {
            return $query;
        }

        $matchingUserIds = [];
        $matchingRawNames = [];
        $key = null;

        if (is_numeric($adviserParam)) {
            $facultyId = (int) $adviserParam;
            $matchingUserIds[] = $facultyId;

            $facultyUser = User::find($facultyId);
            if ($facultyUser && !empty($facultyUser->name)) {
                $matchingRawNames[] = trim($facultyUser->name);
                $key = self::normalized($facultyUser->name);
            }
        } else {
            $matchingRawNames[] = $adviserStr;
            $key = self::normalized($adviserStr);

            if ($key !== '') {
                $facultyUsers = $this->eligible()->get(['id', 'name']);
                foreach ($facultyUsers as $user) {
                    if (self::normalized($user->name) === $key) {
                        $matchingUserIds[] = $user->id;
                        $matchingRawNames[] = trim($user->name);
                    }
                }
            }
        }

        if (!empty($key)) {
            $dbNames = Capstone::withoutGlobalScope('request_access')
                ->whereNotNull('adviser_name')
                ->where('adviser_name', '!=', '')
                ->distinct()
                ->pluck('adviser_name');

            foreach ($dbNames as $dbName) {
                $trimmed = trim((string) $dbName);
                if ($trimmed !== '' && self::normalized($trimmed) === $key) {
                    $matchingRawNames[] = $trimmed;
                }
            }
        }

        $matchingUserIds = array_values(array_unique($matchingUserIds));
        $matchingRawNames = array_values(array_unique(array_filter($matchingRawNames)));

        return $query->where(function ($q) use ($matchingUserIds, $matchingRawNames, $adviserStr) {
            $hasCondition = false;

            if (!empty($matchingUserIds)) {
                $q->whereIn('capstones.adviser_id', $matchingUserIds);
                $hasCondition = true;
            }

            if (!empty($matchingRawNames)) {
                if ($hasCondition) {
                    $q->orWhereIn('capstones.adviser_name', $matchingRawNames);
                } else {
                    $q->whereIn('capstones.adviser_name', $matchingRawNames);
                    $hasCondition = true;
                }
            }

            if (!$hasCondition) {
                $q->where('capstones.adviser_name', $adviserStr);
            }
        });
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
