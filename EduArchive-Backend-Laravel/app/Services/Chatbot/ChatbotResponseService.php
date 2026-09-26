<?php

namespace App\Services\Chatbot;

use App\Models\Capstone;
use Illuminate\Support\Collection;

/**
 * ChatbotResponseService
 *
 * Formats raw database results into readable, markdown-structured chatbot replies.
 * This service contains ZERO external API calls and ZERO AI inference.
 * Every string it produces is derived from the database records passed to it.
 */
class ChatbotResponseService
{
    // ── Capstone search / recommendation ──────────────────────────────────────

    /**
     * Format a list of capstone search/recommendation results.
     *
     * @return array{reply: string, suggested_capstones: array}
     */
    public function formatCapstoneResults(Collection $capstones, string $query = ''): array
    {
        if ($capstones->isEmpty()) {
            return ['reply' => $this->noResults($query), 'suggested_capstones' => []];
        }

        $count = $capstones->count();
        $q     = $query ? " matching \"**{$query}**\"" : '';
        $lines = ["I found **{$count}** capstone project(s){$q}:\n"];

        foreach ($capstones->values() as $i => $c) {
            $num      = $i + 1;
            $keywords = isset($c->keywords) ? $c->keywords->pluck('name')->join(', ') : '';
            $abstract = trim($c->abstract ?? '');
            $abstract = mb_strlen($abstract) > 350
                ? mb_substr($abstract, 0, 350) . '…'
                : $abstract;

            $lines[] = "---";
            $lines[] = "**{$num}. {$c->title}** [ID:{$c->id}]";
            $lines[] = "📂 **Category:** {$c->category} &nbsp;|&nbsp; 📅 **Year:** {$c->year}";
            $lines[] = "👤 **Author(s):** {$c->author}";

            if (!empty($c->program))  $lines[] = "🎓 **Program:** {$c->program}";
            if ($keywords)            $lines[] = "🏷️ **Keywords:** {$keywords}";
            if ($abstract)            $lines[] = "\n> {$abstract}";

            $lines[] = '';
        }

        return [
            'reply'               => implode("\n", $lines),
            'suggested_capstones' => $capstones->map(fn($c) => [
                'id'      => $c->id,
                'title'   => $c->title,
                'author'  => $c->author,
                'year'    => $c->year,
                'program' => $c->program ?? '',
            ])->values()->toArray(),
        ];
    }

    // ── Popular capstones ─────────────────────────────────────────────────────

    /**
     * Format popular capstones with engagement metrics.
     *
     * @return array{reply: string, suggested_capstones: array}
     */
    public function formatPopular(Collection $capstones, string $metric): array
    {
        if ($capstones->isEmpty()) {
            return ['reply' => "No capstone engagement data is available yet in the repository.", 'suggested_capstones' => []];
        }

        $label = match ($metric) {
            'download_count' => 'Most Downloaded',
            'bookmark_count' => 'Most Bookmarked',
            default          => 'Most Viewed',
        };
        $metricLabel = match ($metric) {
            'download_count' => 'Downloads',
            'bookmark_count' => 'Bookmarks',
            default          => 'Views',
        };

        $lines = ["📊 **{$label} Capstone Projects:**\n*(All counts are live from the AcadeX database)*\n"];

        foreach ($capstones->values() as $i => $c) {
            $num   = $i + 1;
            $count = number_format($c->$metric ?? 0);
            $lines[] = "**{$num}. {$c->title}** [ID:{$c->id}]";
            $lines[] = "   📂 {$c->category} &nbsp;|&nbsp; 📅 {$c->year} &nbsp;|&nbsp; {$metricLabel}: **{$count}**";
            $lines[] = "   👤 {$c->author}";
            $lines[] = '';
        }

        return [
            'reply'               => implode("\n", $lines),
            'suggested_capstones' => $capstones->map(fn($c) => [
                'id'      => $c->id,
                'title'   => $c->title,
                'author'  => $c->author,
                'year'    => $c->year,
                'program' => $c->program ?? '',
            ])->values()->toArray(),
        ];
    }

    // ── Category information ──────────────────────────────────────────────────

    /**
     * Format available category list with counts.
     *
     * @return array{reply: string, suggested_capstones: array}
     */
    public function formatCategories(Collection $categories): array
    {
        if ($categories->isEmpty()) {
            return ['reply' => "No categories are currently available in the repository.", 'suggested_capstones' => []];
        }

        $lines = ["📂 **Available Categories in the AcadeX Repository:**\n"];
        foreach ($categories as $cat => $count) {
            $lines[] = "• **{$cat}** — {$count} capstone(s)";
        }
        $lines[] = "\nYou can ask me to search within any of these categories!";

        return ['reply' => implode("\n", $lines), 'suggested_capstones' => []];
    }

    // ── Capstone detail view ──────────────────────────────────────────────────

    /**
     * Format a single capstone's detailed information.
     *
     * @return array{reply: string, suggested_capstones: array}
     */
    public function formatCapstoneDetails(Capstone $c): array
    {
        $keywords   = $c->keywords->pluck('name')->join(', ') ?: 'None';
        $imradLabel = $c->imrad_path ? '✅ Available' : '❌ Not available';
        $abstract   = trim($c->abstract ?? 'No abstract available.');

        $lines = [
            "## 📋 {$c->title}\n",
            "| Field | Details |",
            "|---|---|",
            "| **Year** | {$c->year} |",
            "| **Author(s)** | {$c->author} |",
            "| **Program** | {$c->program} |",
            "| **Category** | {$c->category} |",
            "| **Copyright** | " . ucfirst($c->copyright_status ?? 'N/A') . " |",
            "| **IMRAD** | {$imradLabel} |",
            "| **Keywords** | {$keywords} |",
            "",
            "**Abstract:**",
            "> {$abstract}",
        ];

        return [
            'reply'               => implode("\n", $lines),
            'suggested_capstones' => [[
                'id'      => $c->id,
                'title'   => $c->title,
                'author'  => $c->author,
                'year'    => $c->year,
                'program' => $c->program ?? '',
            ]],
        ];
    }

    // ── Admin analytics ───────────────────────────────────────────────────────

    /**
     * Format admin statistics response.
     *
     * @param array       $stats         From ChatbotAnalyticsService::repositoryStats()
     * @param array|null  $userStats     From ChatbotAnalyticsService::userStats()
     * @param Collection|null $categories Category distribution
     * @param array|null  $downloadStats Download stats
     * @param Collection|null $copyrightStats Copyright distribution
     *
     * @return array{reply: string, suggested_capstones: array}
     */
    public function formatAdminStats(
        array $stats,
        ?array $userStats       = null,
        ?Collection $categories = null,
        ?array $downloadStats   = null,
        ?Collection $copyrightStats = null
    ): array {
        $lines = ["📊 **AcadeX Repository Statistics**\n*All values are live from the database.*\n"];

        // Capstone overview
        $lines[] = "---\n**📚 Capstones**";
        $lines[] = "• Published: **{$stats['total_published']}**";
        $lines[] = "• Total (all statuses): **{$stats['total_all']}**";
        $lines[] = "• Pending Approval: **{$stats['pending_approval']}**";
        $lines[] = "• Archived: **{$stats['total_archived']}**";
        $lines[] = "• Uploads this year: **{$stats['uploads_this_year']}**";
        $lines[] = "• Uploads this month: **{$stats['uploads_this_month']}**";

        // Document status
        $lines[] = "\n**📄 Document Status**";
        $lines[] = "• With IMRAD: **{$stats['with_imrad']}**";
        $lines[] = "• Without IMRAD: **{$stats['without_imrad']}**";

        // Engagement totals
        $lines[] = "\n**👁️ Engagement (all time)**";
        $lines[] = "• Total Views: **" . number_format($stats['total_views']) . "**";
        $lines[] = "• Total Downloads: **" . number_format($stats['total_downloads']) . "**";
        $lines[] = "• Total Bookmarks: **" . number_format($stats['total_bookmarks']) . "**";

        // User breakdown (only if requested/available)
        if ($userStats) {
            $lines[] = "\n**👥 Registered Users**";
            $lines[] = "• Total: **{$userStats['total']}**";
            if ($userStats['admin'])   $lines[] = "• Admins: **{$userStats['admin']}**";
            if ($userStats['faculty']) $lines[] = "• Faculty: **{$userStats['faculty']}**";
            if ($userStats['student']) $lines[] = "• Students: **{$userStats['student']}**";
            if ($userStats['visitor']) $lines[] = "• Visitors: **{$userStats['visitor']}**";
        }

        // Category breakdown
        if ($categories && $categories->isNotEmpty()) {
            $lines[] = "\n**📂 Category Distribution**";
            foreach ($categories as $r) {
                $lines[] = "• {$r->category}: **{$r->count}**";
            }
        }

        // Downloads
        if ($downloadStats) {
            $lines[] = "\n**⬇️ Downloads**";
            $lines[] = "• Total: **{$downloadStats['total']}**";
            $lines[] = "• This Month: **{$downloadStats['this_month']}**";
            $lines[] = "• This Year: **{$downloadStats['this_year']}**";
        }

        // Copyright
        if ($copyrightStats && $copyrightStats->isNotEmpty()) {
            $lines[] = "\n**©️ Copyright Distribution**";
            foreach ($copyrightStats as $r) {
                $status = ucfirst($r->status ?? 'None');
                $lines[] = "• {$status}: **{$r->count}**";
            }
        }

        return ['reply' => implode("\n", $lines), 'suggested_capstones' => []];
    }

    /**
     * Format upload trend by year with a simple ASCII bar chart.
     *
     * @return array{reply: string, suggested_capstones: array}
     */
    public function formatTrend(Collection $trend): array
    {
        if ($trend->isEmpty()) {
            return ['reply' => "No upload trend data is available in the repository yet.", 'suggested_capstones' => []];
        }

        $max   = max(1, $trend->max('total'));
        $lines = ["📈 **Capstone Upload Trends**\n*Live from AcadeX database — ordered by year*\n"];

        foreach ($trend as $row) {
            $filled  = (int) round(($row->total / $max) * 18);
            $bar     = str_repeat('█', $filled) . str_repeat('░', 18 - $filled);
            $lines[] = "**{$row->year}** {$bar} **{$row->total}**";
        }

        $total = $trend->sum('total');
        $lines[] = "\n*Total across period: **{$total}** capstone(s)*";

        return ['reply' => implode("\n", $lines), 'suggested_capstones' => []];
    }

    /**
     * Format admin activity logs.
     *
     * @param array{activity?: array, logins?: array, top_downloads?: array} $data
     *
     * @return array{reply: string, suggested_capstones: array}
     */
    public function formatLogs(array $data): array
    {
        $lines   = ["🔍 **System Activity Logs**\n*From AcadeX activity records*\n"];
        $hasData = false;

        if (!empty($data['activity'])) {
            $hasData = true;
            $lines[] = "**Recent System Activity:**";
            foreach ($data['activity'] as $i => $a) {
                $user = $a['user'] ?? 'System';
                $desc = $a['description'] ? ": {$a['description']}" : '';
                $lines[] = ($i + 1) . ". **{$user}** — {$a['action']}{$desc} *(at {$a['created_at']})*";
            }
            $lines[] = '';
        }

        if (!empty($data['logins'])) {
            $hasData = true;
            $lines[] = "**Recent Login Activity:**";
            foreach ($data['logins'] as $i => $l) {
                $status  = strtoupper($l['status'] ?? 'unknown');
                $lines[] = ($i + 1) . ". **{$l['email']}** — {$status} at {$l['attempted_at']} *(IP: {$l['ip_address']})*";
            }
            $lines[] = '';
        }

        if (!empty($data['top_downloads'])) {
            $hasData = true;
            $lines[] = "**Most Downloaded Capstones:**";
            foreach ($data['top_downloads'] as $i => $c) {
                $lines[] = ($i + 1) . ". **{$c['title']}** [ID:{$c['id']}] — **{$c['download_count']}** download(s) | {$c['author']} | {$c['year']}";
            }
        }

        if (!$hasData) {
            return ['reply' => "The available activity logs do not contain enough information to answer that.", 'suggested_capstones' => []];
        }

        return ['reply' => implode("\n", $lines), 'suggested_capstones' => []];
    }

    // ── Standard / fallback messages ──────────────────────────────────────────

    public function noResults(string $query = ''): string
    {
        $q = $query ? " matching \"**{$query}**\"" : '';
        return "I couldn't find any capstone projects in the AcadeX repository{$q}.\n\n" .
               "You can try:\n" .
               "• A different category or keyword\n" .
               "• A broader year range\n" .
               "• A different search term";
    }

    public function accessDenied(string $message): array
    {
        return ['reply' => $message, 'suggested_capstones' => []];
    }

    public function dbError(): array
    {
        return [
            'reply'               => "I couldn't retrieve information from the AcadeX repository right now. Please try again later.",
            'suggested_capstones' => [],
        ];
    }

    public function unknownRequest(string $role = 'visitor'): array
    {
        if ($role === 'admin') {
            return [
                'reply' =>
                    "I can help you with various tasks as an administrator:\n\n" .
                    "**📊 Statistics & Analytics:**\n" .
                    "• *\"How many students are registered?\"*\n" .
                    "• *\"Show capstone statistics\"*\n" .
                    "• *\"Uploads this year\"*\n\n" .
                    "**📈 Trends & Logs:**\n" .
                    "• *\"Show upload trends for the last 6 years\"*\n" .
                    "• *\"Recent login activity\"*\n" .
                    "• *\"Who downloaded the most capstones?\"*\n\n" .
                    "**📚 Capstone Search:**\n" .
                    "• *\"Recommend healthcare capstones\"*\n" .
                    "• *\"Find Laravel projects from 2024\"*\n" .
                    "• *\"Most viewed capstones\"*",
                'suggested_capstones' => [],
            ];
        }

        if (in_array($role, ['faculty', 'student'])) {
            return [
                'reply' =>
                    "I can help you search and explore capstone projects in the AcadeX repository.\n\n" .
                    "**Try asking:**\n" .
                    "• *\"Recommend healthcare capstones\"*\n" .
                    "• *\"Find projects about agriculture\"*\n" .
                    "• *\"Show BSIT capstones from 2025\"*\n" .
                    "• *\"Find IoT projects\"*\n" .
                    "• *\"What categories are available?\"*\n" .
                    "• *\"Most downloaded capstones\"*",
                'suggested_capstones' => [],
            ];
        }

        // Visitor
        return [
            'reply' =>
                "I can help you explore publicly available capstone projects.\n\n" .
                "**Try asking:**\n" .
                "• *\"Recommend healthcare capstones\"*\n" .
                "• *\"Find agriculture projects\"*\n" .
                "• *\"Show tourism capstones\"*\n" .
                "• *\"What categories are available?\"*",
            'suggested_capstones' => [],
        ];
    }
}
