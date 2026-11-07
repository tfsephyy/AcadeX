<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Capstone;
use App\Traits\ApiResponses;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Adviser-scoped dashboard for faculty accounts.
 *
 * Every assigned figure is restricted to capstones where adviser_id is the
 * authenticated faculty member. Repository-wide figures are returned in a
 * separate key so the UI never has to guess which scope a number describes.
 */
class FacultyDashboardController extends Controller
{
    use ApiResponses;

    public function stats(Request $request): JsonResponse
    {
        $user = $request->user();
        $assigned = Capstone::query()
            ->where('is_archived', false)
            ->where('adviser_id', $user->id);

        $base = clone $assigned;

        $total = (clone $base)->count();
        $pending = (clone $base)->where('approval_status', 'pending')->count();
        $approved = (clone $base)->where('approval_status', 'approved')->count();

        $recent = (clone $base)
            ->with(['uploader:id,name'])
            ->orderByDesc('created_at')
            ->limit(6)
            ->get(['id', 'slug', 'title', 'author', 'year', 'program', 'approval_status', 'created_at', 'uploaded_by']);

        $mostViewed = (clone $base)
            ->withCount(['views as unique_views' => fn ($query) => $query->whereNotNull('user_id')])
            ->having('unique_views', '>=', 1)
            ->orderByDesc('unique_views')
            ->limit(5)
            ->get(['id', 'slug', 'title', 'author', 'year', 'program'])
            ->map(fn (Capstone $capstone) => [
                'id' => $capstone->id,
                'slug' => $capstone->slug,
                'title' => $capstone->title,
                'author' => $capstone->author,
                'year' => $capstone->year,
                'program' => $capstone->program,
                'unique_views' => (int) $capstone->unique_views,
            ]);

        // Use the same saved-reference/copy total as detail and admin rankings.
        $mostCited = (clone $base)
            ->select(['id', 'slug', 'title', 'author', 'year', 'program'])->withReferenceTotal()
            ->orderByDesc('reference_count')
            ->having('reference_count', '>=', 1)
            ->limit(5)
            ->get(['id', 'slug', 'title', 'author', 'year', 'program'])
            ->map(fn (Capstone $capstone) => [
                'id' => $capstone->id,
                'slug' => $capstone->slug,
                'title' => $capstone->title,
                'author' => $capstone->author,
                'year' => $capstone->year,
                'program' => $capstone->program,
                'reference_count' => (int) $capstone->reference_count,
                'citation_generations' => (int) $capstone->reference_count,
            ]);

        $repositoryTotal = Capstone::where('is_archived', false)->count();
        $repositoryApproved = Capstone::where('is_archived', false)
            ->where('approval_status', 'approved')
            ->count();

        return $this->successResponse([
            'assigned' => [
                'total' => $total,
                'pending' => $pending,
                'approved' => $approved,
                'recent' => $recent,
                'most_viewed' => $mostViewed,
                'most_cited' => $mostCited,
                'most_cited_label' => 'saved references and citation copies',
            ],
            'repository' => [
                'total' => $repositoryTotal,
                'approved' => $repositoryApproved,
            ],
            'trends' => [
                'labels' => ['assigned uploads', 'assigned views'],
                'months' => $this->monthlyTrends($user->id),
            ],
        ], 'Faculty dashboard statistics retrieved.');
    }

    /**
     * Six-month series for assigned uploads and views. Uses the same MySQL
     * date grouping as the existing admin dashboard for consistent output.
     */
    private function monthlyTrends(int $adviserId): array
    {
        $start = now()->subMonths(5)->startOfMonth();

        $uploads = Capstone::query()
            ->where('adviser_id', $adviserId)
            ->where('is_archived', false)
            ->where('created_at', '>=', $start)
            ->select(DB::raw("DATE_FORMAT(created_at, '%Y-%m') as month"), DB::raw('COUNT(*) as count'))
            ->groupBy('month')
            ->pluck('count', 'month');

        $views = DB::table('capstone_views')
            ->join('capstones', 'capstone_views.capstone_id', '=', 'capstones.id')
            ->where('capstones.adviser_id', $adviserId)
            ->where('capstones.is_archived', false)
            ->where('capstone_views.created_at', '>=', $start)
            ->select(DB::raw("DATE_FORMAT(capstone_views.created_at, '%Y-%m') as month"), DB::raw('COUNT(*) as count'))
            ->groupBy('month')
            ->pluck('count', 'month');

        $series = [];
        for ($i = 5; $i >= 0; $i--) {
            $key = now()->subMonths($i)->format('Y-m');
            $series[] = [
                'month' => $key,
                'label' => now()->subMonths($i)->format('M Y'),
                'uploads' => (int) ($uploads[$key] ?? 0),
                'views' => (int) ($views[$key] ?? 0),
            ];
        }

        return $series;
    }
}
