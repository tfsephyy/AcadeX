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
     * Titles include a [LINK:{id}] marker so the frontend can render them as clickable links.
     *
     * @return array{reply: string, suggested_capstones: array}
     */
    public function formatPopular(Collection $capstones, string $metric): array
    {
        if ($capstones->isEmpty()) {
            return ['reply' => "No capstone engagement data is available yet in the repository.", 'suggested_capstones' => []];
        }

        $count    = $capstones->count();
        $isSingle = $count === 1;

        // Header and count label per metric
        $header     = match ($metric) {
            'download_count' => 'Most Downloaded Capstone Project:',
            'bookmark_count' => 'Most Bookmarked Capstone Project:',
            default          => $isSingle ? 'Most Viewed Capstone Project:' : "Top {$count} Most Viewed Capstone Projects:",
        };
        $countLabel = match ($metric) {
            'download_count' => 'Total Download',
            'bookmark_count' => 'Total Bookmarks',
            default          => 'Total views',
        };

        $lines = [
            "📊 **{$header}**",
            "*(Live count" . ($isSingle ? '' : 's') . " from the AcadeX database)*",
            "",
        ];

        if ($isSingle) {
            $c         = $capstones->first();
            $metricVal = number_format($c->$metric ?? 0);
            $lines[] = "**Capstone title:** {$c->title} [LINK:{$c->id}]";
            $lines[] = "**{$countLabel}:** {$metricVal}";
        } else {
            foreach ($capstones->values() as $i => $c) {
                $num       = $i + 1;
                $metricVal = number_format($c->$metric ?? 0);
                $lines[] = "**{$num}. Capstone title:** {$c->title} [LINK:{$c->id}]";
                $lines[] = "**{$countLabel}:** {$metricVal}";
                $lines[] = "";
            }
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
        ?Collection $copyrightStats = null,
        bool $userOnly          = false
    ): array {
        // User-only mode: just return clean user count breakdown
        if ($userOnly && $userStats) {
            $total    = $userStats['total'];
            $faculty  = $userStats['faculty']  ?? 0;
            $students = $userStats['student']  ?? 0;
            $visitors = $userStats['visitor']  ?? 0;

            $lines = [
                "There are **{$total}** users in total.",
                "",
                "\u2022 **{$faculty}** facult" . ($faculty === 1 ? 'y' : 'ies') . ".",
                "\u2022 **{$students}** student" . ($students === 1 ? '' : 's') . ".",
                "\u2022 **{$visitors}** visitor" . ($visitors === 1 ? '' : 's') . ".",
            ];
            return ['reply' => implode("\n", $lines), 'suggested_capstones' => []];
        }

        $lines = ["\ud83d\udcca **AcadeX Repository Statistics**\n*All values are live from the database.*\n"];

        // Capstone overview
        $lines[] = "---\n**\ud83d\udcda Capstones**";
        $lines[] = "\u2022 Published: **{$stats['total_published']}**";
        $lines[] = "\u2022 Total (all statuses): **{$stats['total_all']}**";
        $lines[] = "\u2022 Pending Approval: **{$stats['pending_approval']}**";
        $lines[] = "\u2022 Archived: **{$stats['total_archived']}**";
        $lines[] = "\u2022 Uploads this year: **{$stats['uploads_this_year']}**";
        $lines[] = "\u2022 Uploads this month: **{$stats['uploads_this_month']}**";

        // Document status
        $lines[] = "\n**\ud83d\udcc4 Document Status**";
        $lines[] = "\u2022 With IMRAD: **{$stats['with_imrad']}**";
        $lines[] = "\u2022 Without IMRAD: **{$stats['without_imrad']}**";

        // Engagement totals
        $lines[] = "\n**\ud83d\udc41\ufe0f Engagement (all time)**";
        $lines[] = "\u2022 Total Views: **" . number_format($stats['total_views']) . "**";
        $lines[] = "\u2022 Total Downloads: **" . number_format($stats['total_downloads']) . "**";
        $lines[] = "\u2022 Total Bookmarks: **" . number_format($stats['total_bookmarks']) . "**";

        // User breakdown (only if requested/available)
        if ($userStats) {
            $total    = $userStats['total'];
            $faculty  = $userStats['faculty']  ?? 0;
            $students = $userStats['student']  ?? 0;
            $visitors = $userStats['visitor']  ?? 0;

            $lines[] = "\nThere are **{$total}** users in total.";
            $lines[] = "";
            $lines[] = "\u2022 **{$faculty}** facult" . ($faculty === 1 ? 'y' : 'ies') . ".";
            $lines[] = "\u2022 **{$students}** student" . ($students === 1 ? '' : 's') . ".";
            $lines[] = "\u2022 **{$visitors}** visitor" . ($visitors === 1 ? '' : 's') . ".";
        }

        // Category breakdown
        if ($categories && $categories->isNotEmpty()) {
            $lines[] = "\n**\ud83d\udcc2 Category Distribution**";
            foreach ($categories as $r) {
                $lines[] = "\u2022 {$r->category}: **{$r->count}**";
            }
        }

        // Downloads
        if ($downloadStats) {
            $lines[] = "\n**\u2b07\ufe0f Downloads**";
            $lines[] = "\u2022 Total: **{$downloadStats['total']}**";
            $lines[] = "\u2022 This Month: **{$downloadStats['this_month']}**";
            $lines[] = "\u2022 This Year: **{$downloadStats['this_year']}**";
        }

        // Copyright
        if ($copyrightStats && $copyrightStats->isNotEmpty()) {
            $lines[] = "\n**\u00a9\ufe0f Copyright Distribution**";
            foreach ($copyrightStats as $r) {
                $status = ucfirst($r->status ?? 'None');
                $lines[] = "\u2022 {$status}: **{$r->count}**";
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
        $lines   = ["🔒 **Recent Login Activity**\n*From AcadeX login records*\n"];
        $hasData = false;

        if (!empty($data['activity'])) {
            $hasData = true;
            $lines[] = "**Recent System Activity:**";
            foreach ($data['activity'] as $i => $a) {
                $user = $a['user'] ?? 'System';
                $desc = $a['description'] ? ": {$a['description']}" : '';
                $time = $a['created_at'] ? date('M d, Y h:i A', strtotime($a['created_at'])) : 'Unknown';
                $lines[] = ($i + 1) . ". **{$user}** — {$a['action']}{$desc} *({$time})*";
            }
            $lines[] = '';
        }

        if (isset($data['logins'])) {
            $hasData = true;
            if (empty($data['logins'])) {
                $lines[] = "**Recent Login Activity:** No recent login attempts found.";
            } else {
                $lines[] = "**Recent Login Attempts:**";
                foreach ($data['logins'] as $i => $l) {
                    $status  = strtoupper($l['status'] ?? 'unknown');
                    $icon    = ($status === 'SUCCESS') ? '✅' : '❌';
                    $time    = $l['attempted_at'] ? date('M d, Y h:i A', strtotime($l['attempted_at'])) : 'Unknown';
                    $ip      = $l['ip_address'] ?? 'N/A';
                    $lines[] = ($i + 1) . ". {$icon} **{$l['email']}** — {$status} at {$time} *(IP: {$ip})*";
                }
            }
            $lines[] = '';
        }

        if (!empty($data['top_downloads'])) {
            $hasData = true;
            $lines[] = "**Most Downloaded Capstones:**";
            foreach ($data['top_downloads'] as $i => $c) {
                $lines[] = ($i + 1) . ". **{$c['title']}** [LINK:{$c['id']}] — **{$c['download_count']}** download(s) | {$c['author']} | {$c['year']}";
            }
        }

        if (!$hasData) {
            return ['reply' => "The available activity logs do not contain enough information to answer that.", 'suggested_capstones' => []];
        }

        return ['reply' => implode("\n", $lines), 'suggested_capstones' => []];
    }


    // ── Definition / Glossary ─────────────────────────────────────────────────

    /**
     * Answer a definition/concept question from static knowledge.
     * No DB needed — these are fixed explanations.
     * 
     * @param string $msg User message
     */
    public function formatDefinition(string $msg): array
    {
        $msg = strtolower($msg);

        // Each entry has an array of trigger substrings — first match wins
        $glossary = [
            [
                'triggers' => ['imrad'],
                'answer'   => "📄 **IMRAD** stands for **Introduction, Methodology, Results, and Discussion**.\n\n" .
                    "It is the standard structure for scientific and research papers:\n" .
                    "- **Introduction** — background and objectives\n" .
                    "- **Methodology** — how the study was conducted\n" .
                    "- **Results** — findings/data collected\n" .
                    "- **Discussion** — interpretation of results and conclusions\n\n" .
                    "In EduArchive, capstones that have an uploaded IMRAD document are marked with ✅ IMRAD Available.",
            ],
            [
                'triggers' => ['abstract'],
                'answer'   => "📝 An **abstract** is a short summary (usually 150–300 words) of a research paper.\n\n" .
                    "It briefly covers:\n- The problem being studied\n- The methods used\n- The key findings\n- The conclusion\n\n" .
                    "In EduArchive, each capstone's abstract is displayed on its detail page and is also used by EduBot to answer context-specific questions.",
            ],
            [
                'triggers' => ['capstone vs thesis', 'difference between a capstone', 'capstone and a thesis', 'capstone and thesis', 'capstone or thesis'],
                'answer'   => "🎓 **Capstone vs Thesis:**\n\n" .
                    "- A **capstone project** is a practical, applied project that demonstrates skills learned throughout a program. It often results in a working system or product.\n" .
                    "- A **thesis** is a formal academic document based on original research, typically required for graduate degrees.\n\n" .
                    "EduArchive stores **capstone projects** produced by undergraduate students.",
            ],
            [
                'triggers' => ['publication status', 'publication'],
                'answer'   => "📰 **Publication Status** indicates whether a capstone has been formally published or submitted to an academic conference or journal.\n\n" .
                    "Possible values include:\n- **Published** — formally submitted to a publication\n- **Unpublished** — internal archive only\n\n" .
                    "This is separate from whether the capstone is *visible* in EduArchive (controlled by `publication_status`).",
            ],
            [
                'triggers' => ['copyright'],
                'answer'   => "©️ **Copyright Status** indicates the intellectual property status of a capstone.\n\n" .
                    "Common values:\n- **Copyrighted** — the authors have claimed copyright\n- **None / Not specified** — no formal copyright claim\n\n" .
                    "Copyrighted capstones may be visible to visitors even if they haven't been formally published in EduArchive.",
            ],
            [
                'triggers' => ['archived vs published', 'archived and published', 'difference between archived', 'archived'],
                'answer'   => "📦 **Archived vs Published:**\n\n" .
                    "- **Published** (`publication_status = 'published'`) — the capstone is visible in the EduArchive library for all users.\n" .
                    "- **Archived** (`is_archived = true`) — the capstone has been hidden/removed from public view but is still in the database.\n\n" .
                    "An archived capstone will not appear in search results.",
            ],
            [
                'triggers' => ['approval status', 'approval'],
                'answer'   => "✅ **Approval Status** tracks where a capstone is in the review pipeline:\n\n" .
                    "- **Pending** — awaiting faculty/admin review\n- **Approved** — accepted and published\n- **Rejected** — returned with a reason for revision\n\n" .
                    "You can see the rejection reason in your uploaded capstones list.",
            ],
            [
                'triggers' => ['pending'],
                'answer'   => "⏳ **Pending** means your capstone submission is waiting for review.\n\n" .
                    "The approval flow is:\n1. Student/Faculty uploads capstone → status = **Pending**\n2. Faculty reviews it → Approved or Rejected\n3. Admin gives final approval → Capstone becomes Published\n\n" .
                    "You will receive a notification when the status changes.",
            ],
            [
                'triggers' => ['role of an adviser', 'adviser', 'advisor'],
                'answer'   => "👨‍🏫 An **adviser** (also called a thesis/capstone adviser) is a faculty member who supervises a student's capstone project.\n\n" .
                    "The adviser:\n- Guides the research direction\n- Reviews and approves the methodology\n- Signs off on the final submission\n\n" .
                    "In EduArchive, each capstone has an `adviser` field linking to the supervising faculty member.",
            ],
            [
                'triggers' => ['keyword', 'what are keywords', 'why do they matter', 'why do keywords matter'],
                'answer'   => "🏷️ **Keywords** are specific terms that describe the main topics of a capstone.\n\n" .
                    "They matter because:\n- EduBot uses keywords to **find and recommend** relevant capstones\n- They make capstones **easier to discover** through search\n- They help identify **research trends** and popular topics in the archive\n\n" .
                    "When uploading a capstone, always add accurate keywords to improve its discoverability.",
            ],
            [
                'triggers' => ['format', 'accepted'],
                'answer'   => "📁 EduArchive accepts the following file formats:\n\n" .
                    "- **PDF** — required for the main capstone document\n- **PDF** — also accepted for the IMRAD document (optional)\n\n" .
                    "Make sure your PDF is not password-protected before uploading.",
            ],
        ];

        // Match against the first trigger substring found in the message
        foreach ($glossary as $entry) {
            foreach ($entry['triggers'] as $trigger) {
                if (str_contains($msg, $trigger)) {
                    return ['reply' => $entry['answer'], 'suggested_capstones' => []];
                }
            }
        }

        // Fallback for unrecognised definition request
        return ['reply' =>
            "I can explain any of the following terms:\n\n" .
            "• IMRAD • Abstract • Capstone vs Thesis\n" .
            "• Publication Status • Copyright Status\n" .
            "• Archived vs Published • Pending\n" .
            "• Adviser • Keywords • Approval Status • Accepted formats\n\n" .
            "Just ask: *\"What is [term]?\"*",
            'suggested_capstones' => []
        ];
    }

    // ── Program / Archive Stats ────────────────────────────────────────────────

    /**
     * Format program-level and archive analytics results.
     */
    public function formatProgramStats(array $data, string $msg): array
    {
        if (empty($data)) {
            return ['reply' => "I couldn't identify a specific statistic for that question. Try rephrasing, for example: *\"Which program has the most capstone submissions?\"*", 'suggested_capstones' => []];
        }

        // ── Faculty advisory early-return responses ───────────────────────────────

        // 1. Most viewed among advised
        if (array_key_exists('advisory_most_viewed', $data)) {
            $cap = $data['advisory_most_viewed'];
            if (!$cap) {
                return ['reply' => "You have no advised capstones with any views yet.", 'suggested_capstones' => []];
            }
            $reply = "The most viewed capstone among you advised is **{$cap['title']}** [LINK:{$cap['id']}]\n"
                   . "Total views: **{$cap['view_count']}**";
            return ['reply' => $reply, 'suggested_capstones' => []];
        }

        // 2. Overdone topics in advisory
        if (array_key_exists('advisory_overdone', $data)) {
            if (empty($data['advisory_overdone'])) {
                return ['reply' => "✅ No overdone topics found among the capstones you have advised. Every category is unique!", 'suggested_capstones' => []];
            }
            $lines = ["These are the topics that has been overdone:"];
            foreach ($data['advisory_overdone'] as $i => $row) {
                $lines[] = ($i + 1) . ". **{$row['category']}** — {$row['total']} capstones";
            }
            return ['reply' => implode("\n", $lines), 'suggested_capstones' => []];
        }

        // 3. Total capstones advised across all years
        if (array_key_exists('advisory_total_count', $data)) {
            $count = $data['advisory_total_count'];
            $reply = "You have advised **{$count}** capstone" . ($count === 1 ? '' : 's') . " across all years.";
            return ['reply' => $reply, 'suggested_capstones' => []];
        }

        // 4. Published capstones in advisory
        if (array_key_exists('advisory_published_count', $data)) {
            $count = $data['advisory_published_count'];
            if ($count === 0) {
                return ['reply' => "You have advised **0** published capstones across all years.", 'suggested_capstones' => []];
            }
            $lines = ["You have advised **{$count}** published capstone" . ($count === 1 ? '' : 's') . " across all years."];
            foreach ($data['advisory_published_list'] as $i => $c) {
                $lines[] = ($i + 1) . ". {$c['title']} [LINK:{$c['id']}]";
            }
            return ['reply' => implode("\n", $lines), 'suggested_capstones' => []];
        }

        // 5. Copyrighted capstones in advisory
        if (array_key_exists('advisory_copyrighted_count', $data)) {
            $count = $data['advisory_copyrighted_count'];
            if ($count === 0) {
                return ['reply' => "You have advised **0** copyrighted capstones across all years.", 'suggested_capstones' => []];
            }
            $lines = ["You have advised **{$count}** copyrighted capstone" . ($count === 1 ? '' : 's') . " across all years."];
            foreach ($data['advisory_copyrighted_list'] as $i => $c) {
                $lines[] = ($i + 1) . ". {$c['title']} [LINK:{$c['id']}]";
            }
            return ['reply' => implode("\n", $lines), 'suggested_capstones' => []];
        }

        // 6. Past N years capstones
        if (array_key_exists('advisory_past_years_list', $data)) {
            $from = $data['advisory_past_years_from'];
            $to   = $data['advisory_past_years_to'];
            if (empty($data['advisory_past_years_list'])) {
                return ['reply' => "You have no advised capstones from **{$from}** to **{$to}**.", 'suggested_capstones' => []];
            }
            $lines = ["These are the capstone that you have advised for the past 3 years:"];
            foreach ($data['advisory_past_years_list'] as $i => $c) {
                $lines[] = ($i + 1) . ". {$c['title']} ({$c['year']}) [LINK:{$c['id']}]";
            }
            return ['reply' => implode("\n", $lines), 'suggested_capstones' => []];
        }


        // ── Early-return for clean single-fact responses (no generic header) ──────

        if (isset($data['archived_total_count']) && count($data) === 1) {
            $count = $data['archived_total_count'];
            $reply = "There are **{$count}** capstone" . ($count === 1 ? '' : 's') . " in the archive right now.";
            return ['reply' => $reply, 'suggested_capstones' => []];
        }

        if (isset($data['no_imrad_count']) && count($data) === 2) {
            $count = $data['no_imrad_count'];
            if ($count === 0) {
                return ['reply' => "✅ All capstones have an IMRAD document attached.", 'suggested_capstones' => []];
            }
            $lines = ["There **{$count}** capstone/s that has no IMRAD attached.", "", "**List:**"];
            foreach ($data['no_imrad_list'] as $c) {
                $lines[] = "– {$c['title']} [LINK:{$c['id']}]";
            }
            return ['reply' => implode("\n", $lines), 'suggested_capstones' => []];
        }

        if (isset($data['publication_published_count']) && count($data) === 2) {
            $count = $data['publication_published_count'];
            if ($count === 0) {
                return ['reply' => "There are **0** published capstone/s.", 'suggested_capstones' => []];
            }
            $lines = ["There **{$count}** published capstone/s.", "", "**List:**"];
            foreach ($data['publication_published_list'] as $c) {
                $lines[] = "– {$c['title']} [LINK:{$c['id']}]";
            }
            return ['reply' => implode("\n", $lines), 'suggested_capstones' => []];
        }

        if (isset($data['copyrighted_count']) && count($data) === 2) {
            $count = $data['copyrighted_count'];
            if ($count === 0) {
                return ['reply' => "There are **0** copyrighted capstone/s.", 'suggested_capstones' => []];
            }
            $lines = ["There **{$count}** copyrighted capstone/s.", "", "**List:**"];
            foreach ($data['copyrighted_list'] as $c) {
                $lines[] = "– {$c['title']} [LINK:{$c['id']}]";
            }
            return ['reply' => implode("\n", $lines), 'suggested_capstones' => []];
        }

        if (isset($data['never_logged_in_count']) && count(array_keys($data)) <= 2) {
            $count = $data['never_logged_in_count'];
            if ($count === 0) {
                return ['reply' => "✅ All registered users have logged in at least once.", 'suggested_capstones' => []];
            }
            $lines = ["**🔐 Users Who Have Never Logged In Since Registering:** **{$count}** user(s)", ""];
            foreach ($data['never_logged_in_list'] ?? [] as $u) {
                $name  = $u['name']  ?? '';
                $email = $u['email'] ?? '';
                $lines[] = "– **{$name}** ({$email})";
            }
            return ['reply' => implode("\n", $lines), 'suggested_capstones' => []];
        }

        if (array_key_exists('active_users', $data) && count(array_keys($data)) === 1) {
            $thisMonth = now()->format('F Y');
            if (empty($data['active_users'])) {
                return ['reply' => "**🔥 Most Active Users This Month ({$thisMonth}):** No activity recorded yet.", 'suggested_capstones' => []];
            }
            $lines = ["**🔥 Most Active Users This Month ({$thisMonth}):**", ""];
            foreach ($data['active_users'] as $i => $u) {
                $lastActive = $u['last_active_at'] ? date('M d, Y h:i A', strtotime($u['last_active_at'])) : 'N/A';
                $lines[] = ($i + 1) . ". **{$u['name']}** — last active: {$lastActive}";
            }
            return ['reply' => implode("\n", $lines), 'suggested_capstones' => []];
        }

        // ─────────────────────────────────────────────────────────────────────────

        $lines = ["📊 **EduArchive Archive Analytics**\n*Live from the database*\n"];

        if (!empty($data['year_counts'])) {
            if (count($data['year_counts']) === 1) {
                $row = $data['year_counts'][0];
                // Remove generic header and use clean format matching the requested output
                $lines = [
                    "**📅 Year with the Most Capstone Submissions:**",
                    "",
                    "🏆 **{$row['year']}** — **{$row['total']}** capstone(s) submitted",
                ];
                return ['reply' => implode("\n", $lines), 'suggested_capstones' => []];
            } else {
                $lines[] = "**📅 Top Years by Capstone Submissions:**";
                foreach ($data['year_counts'] as $i => $row) {
                    $lines[] = ($i + 1) . ". **{$row['year']}** — {$row['total']} capstone(s)";
                }
            }
            $lines[] = '';
        }

        if (!empty($data['program_counts'])) {
            if (count($data['program_counts']) === 1) {
                $row = $data['program_counts'][0];
                // Clean format matching the requested output — early return, no extra header
                $lines = [
                    "**🎓 Program with the Most Capstone Submissions:**",
                    "",
                    "🏆 **{$row['program']}** — **{$row['total']}** capstone(s) submitted",
                ];
                return ['reply' => implode("\n", $lines), 'suggested_capstones' => []];
            } else {
                $lines[] = "**🎓 Programs by Capstone Count:**";
                foreach ($data['program_counts'] as $i => $row) {
                    $lines[] = ($i + 1) . ". **{$row['program']}** — {$row['total']} capstone(s)";
                }
            }
            $lines[] = '';
        }

        if (!empty($data['top_keywords'])) {
            $lines[] = "**🔑 Most Frequently Used Keywords:**";
            foreach ($data['top_keywords'] as $i => $row) {
                $lines[] = ($i + 1) . ". **{$row['name']}** — used {$row['total']} time(s)";
            }
            $lines[] = '';
        }

        if (!empty($data['top_authors'])) {
            $lines[] = "**✍️ Most Prolific Authors:**";
            foreach ($data['top_authors'] as $i => $row) {
                $lines[] = ($i + 1) . ". **{$row['author']}** — {$row['total']} capstone(s)";
            }
            $lines[] = '';
        }

        if (!empty($data['top_uploaders'])) {
            $lines[] = "**📤 Top Uploaders (by capstones uploaded):**";
            foreach ($data['top_uploaders'] as $i => $row) {
                $lines[] = ($i + 1) . ". **{$row['name']}** — {$row['total']} capstone(s) uploaded";
            }
            $lines[] = '';
        }

        if (isset($data['unviewed_count'])) {
            $lines[] = "**👻 Capstones Never Viewed Since Publishing:**";
            if ($data['unviewed_count'] === 0) {
                $lines[] = "• ✅ All published capstones have been viewed at least once.";
            } else {
                $lines[] = "• **{$data['unviewed_count']}** capstone(s) with 0 views since publishing";
                if (!empty($data['unviewed_examples'])) {
                    $lines[] = "  Examples:";
                    foreach ($data['unviewed_examples'] as $c) {
                        $yr  = $c['year']    ?? '';
                        $prg = $c['program'] ?? '';
                        // [LINK:{id}] marker so frontend can render as clickable
                        $lines[] = "  – **{$c['title']}** [LINK:{$c['id']}] ({$yr}, {$prg})";
                    }
                }
            }
            $lines[] = '';
        }

        if (isset($data['no_pdf_count'])) {
            if ($data['no_pdf_count'] === 0) {
                $lines[] = "**📭 Capstones with No PDF Attached:** ✅ All capstones have a PDF attached.";
            } else {
                $lines[] = "**📭 Capstones with No PDF Attached:** **{$data['no_pdf_count']}** capstone(s) are missing a PDF.";
            }
            $lines[] = '';
        }

        if (isset($data['no_keywords_count'])) {
            if ($data['no_keywords_count'] === 0) {
                $lines[] = "**🏷️ Published Capstones with No Keywords Tagged:** ✅ All published capstones have keywords.";
            } else {
                $lines[] = "**🏷️ Published Capstones with No Keywords Tagged:** **{$data['no_keywords_count']}** capstone(s) have no keywords.";
            }
            $lines[] = '';
        }

        if (isset($data['never_logged_in_count'])) {
            if ($data['never_logged_in_count'] === 0) {
                $lines[] = "**🔐 Users Who Have Never Logged In:** ✅ All registered users have logged in at least once.";
            } else {
                $lines[] = "**🔐 Users Who Have Never Logged In Since Registering:** **{$data['never_logged_in_count']}** user(s)";
                if (!empty($data['never_logged_in_list'])) {
                    foreach ($data['never_logged_in_list'] as $u) {
                        $name  = $u['name']  ?? '';
                        $email = $u['email'] ?? '';
                        $lines[] = "  – **{$name}** ({$email})";
                    }
                }
            }
            $lines[] = '';
        } elseif (isset($data['never_logged_in'])) {
            // Legacy fallback (count-only)
            if ($data['never_logged_in'] === 0) {
                $lines[] = "**🔐 Users Who Have Never Logged In:** ✅ All registered users have logged in at least once.";
            } else {
                $lines[] = "**🔐 Users Who Have Never Logged In Since Registering:** **{$data['never_logged_in']}** user(s)";
            }
            $lines[] = '';
        }

        if (!empty($data['active_users'])) {
            $thisMonth = now()->format('F Y');
            $lines[] = "**🔥 Most Active Users This Month ({$thisMonth}):**";
            foreach ($data['active_users'] as $i => $u) {
                $lastActive = $u['last_active_at'] ? date('M d, Y h:i A', strtotime($u['last_active_at'])) : 'N/A';
                $lines[] = ($i + 1) . ". **{$u['name']}** — last active: {$lastActive}";
            }
            $lines[] = '';
        } elseif (array_key_exists('active_users', $data)) {
            $thisMonth = now()->format('F Y');
            $lines[] = "**🔥 Most Active Users This Month ({$thisMonth}):** No activity recorded yet.";
            $lines[] = '';
        }

        if (isset($data['archived_count'])) {
            $lines[] = "**📊 Capstones: Archived vs Published:**";
            $lines[] = "• Published (publicly visible): **{$data['published_count']}**";
            $lines[] = "• Archived (hidden from public): **{$data['archived_count']}**";
            $lines[] = '';
        }

        if (isset($data['duplicate_titles'])) {
            if (empty($data['duplicate_titles'])) {
                $lines[] = "**🔁 Duplicate Capstone Titles:** ✅ No duplicate titles found in the archive.";
            } else {
                $lines[] = "**🔁 Capstone Titles Appearing More Than Once:**";
                foreach ($data['duplicate_titles'] as $i => $row) {
                    $lines[] = ($i + 1) . ". \"{$row['title']}\" — appears **{$row['total']}** times";
                }
            }
            $lines[] = '';
        }

        if (!empty($data['overdone_keywords'])) {
            $lines[] = "**⚠️ Overused Keywords (possible overdone topics):**";
            foreach ($data['overdone_keywords'] as $i => $row) {
                $lines[] = ($i + 1) . ". **{$row['name']}** — used {$row['total']} time(s)";
            }
            $lines[] = '';
        }

        if (isset($data['archived_total_count'])) {
            $count = $data['archived_total_count'];
            $lines[] = "There are **{$count}** capstone" . ($count === 1 ? '' : 's') . " in the archive right now.";
            $lines[] = '';
        }

        if (isset($data['no_imrad_count'])) {
            $count = $data['no_imrad_count'];
            if ($count === 0) {
                $lines[] = "**📭 No IMRAD Attached:** ✅ All capstones have an IMRAD document attached.";
            } else {
                $lines[] = "There **{$count}** capstone/s that has no IMRAD attached.";
                $lines[] = "**List:**";
                foreach ($data['no_imrad_list'] as $c) {
                    $lines[] = "– {$c['title']} [LINK:{$c['id']}]";
                }
            }
            $lines[] = '';
        }

        if (isset($data['publication_published_count'])) {
            $count = $data['publication_published_count'];
            if ($count === 0) {
                $lines[] = "There are **0** published capstone/s.";
            } else {
                $lines[] = "There **{$count}** published capstone/s.";
                $lines[] = "**List:**";
                foreach ($data['publication_published_list'] as $c) {
                    $lines[] = "– {$c['title']} [LINK:{$c['id']}]";
                }
            }
            $lines[] = '';
        }

        if (isset($data['copyrighted_count'])) {
            $count = $data['copyrighted_count'];
            if ($count === 0) {
                $lines[] = "There are **0** copyrighted capstone/s.";
            } else {
                $lines[] = "There **{$count}** copyrighted capstone/s.";
                $lines[] = "**List:**";
                foreach ($data['copyrighted_list'] as $c) {
                    $lines[] = "– {$c['title']} [LINK:{$c['id']}]";
                }
            }
            $lines[] = '';
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

    public function unknownRequest(string $role = 'visitor', array $hints = []): array
    {
        // Use real DB values so every example query is guaranteed to return results
        $cat1     = $hints['categories'][0] ?? 'Web-Based System';
        $cat2     = $hints['categories'][1] ?? 'Mobile Application';
        $kw1      = $hints['keywords'][0]   ?? 'machine learning';
        $kw2      = $hints['keywords'][1]   ?? 'healthcare';
        $kw3      = $hints['keywords'][2]   ?? 'IoT';
        $year     = $hints['recent_year']   ?? now()->year;
        $prevYear = $year - 1;
        $program  = $hints['top_program']   ?? 'BSIT';

        if ($role === 'admin') {
            return [
                'reply' =>
                    "I can help you with various tasks as an administrator:\n\n" .
                    "**📊 Statistics & Analytics:**\n" .
                    "• *\"How many users are registered by role?\"*\n" .
                    "• *\"Show capstone statistics\"*\n" .
                    "• *\"How many capstones were uploaded this year?\"*\n\n" .
                    "**📈 Trends & Logs:**\n" .
                    "• *\"Show the upload trend over the last 5 years\"*\n" .
                    "• *\"Show recent login activity\"*\n" .
                    "• *\"Who has uploaded the most capstones overall?\"*\n\n" .
                    "**📚 Capstone Search:**\n" .
                    "• *\"Find capstones about {$kw1}\"*\n" .
                    "• *\"Show {$program} capstones from {$year}\"*\n" .
                    "• *\"What are the top 3 most viewed capstones?\"*",
                'suggested_capstones' => [],
            ];
        }

        if (in_array($role, ['faculty', 'student'])) {
            return [
                'reply' =>
                    "I can help you search and explore capstone projects in EduArchive.\n\n" .
                    "**Try asking:**\n" .
                    "• *\"Find capstones about {$kw1}\"*\n" .
                    "• *\"Show {$program} capstones from {$year}\"*\n" .
                    "• *\"Find capstones in the {$cat1} category\"*\n" .
                    "• *\"What capstones are about {$kw2}?\"*\n" .
                    "• *\"What are the most frequently used keywords?\"*\n" .
                    "• *\"What are the top 5 most downloaded capstones?\"*",
                'suggested_capstones' => [],
            ];
        }

        // Visitor
        return [
            'reply' =>
                "I can help you explore publicly available capstone projects.\n\n" .
                "**Try asking:**\n" .
                "• *\"Find capstones about {$kw1}\"*\n" .
                "• *\"Show capstones in the {$cat1} category\"*\n" .
                "• *\"Find {$kw2} capstones from {$prevYear}\"*\n" .
                "• *\"What are the top 3 most viewed capstones?\"*",
            'suggested_capstones' => [],
        ];
    }

    // ── Student Research Section ──────────────────────────────────────────────

    /**
     * Format faculty list for adviser selection (clickable).
     *
     * @return array{reply: string, suggested_capstones: array, faculty_list: array}
     */
    public function formatFacultySelection(\Illuminate\Database\Eloquent\Collection $faculty): array
    {
        if ($faculty->isEmpty()) {
            return [
                'reply' => "No faculty members are currently available in the system.",
                'suggested_capstones' => [],
                'faculty_list' => [],
            ];
        }

        $lines = [
            "Please select your adviser:",
            "",
        ];

        $facultyList = [];
        foreach ($faculty as $f) {
            $lines[] = "• **{$f->name}**";
            $facultyList[] = [
                'id'   => $f->id,
                'name' => $f->name,
            ];
        }

        return [
            'reply'               => implode("\n", $lines),
            'suggested_capstones' => [],
            'faculty_list'        => $facultyList,
        ];
    }

    /**
     * Format capstones supervised by a specific adviser.
     *
     * @param \Illuminate\Database\Eloquent\Collection $capstones
     * @param string $adviserName
     * @return array{reply: string, suggested_capstones: array}
     */
    public function formatAdviserCapstones(\Illuminate\Database\Eloquent\Collection $capstones, string $adviserName): array
    {
        if ($capstones->isEmpty()) {
            return [
                'reply'               => "**{$adviserName}** has not supervised any capstones yet.",
                'suggested_capstones' => [],
            ];
        }


        // Determine the title based on gender prefix (Mr./Ms.)
        $prefix = 'Mr./Ms.';
        
        $lines = [
            "These are the capstones that **{$prefix} {$adviserName}** has advised:",
            "",
        ];

        foreach ($capstones->values() as $i => $c) {
            $num = $i + 1;
            $lines[] = "{$num}. **{$c->title}** [LINK:{$c->id}]";
            $lines[] = "   📅 Year: {$c->year} | 👤 Author: {$c->author}";
            $lines[] = "";
        }

        return [
            'reply' => implode("\n", $lines),
            'suggested_capstones' => $capstones->map(fn($c) => [
                'id' => $c->id,
                'title' => $c->title,
                'author' => $c->author,
                'year' => $c->year,
                'program' => $c->program ?? '',
            ])->values()->toArray(),
        ];
    }

    /**
     * Format the most popular research topic.
     *
     * @param array|null $topicData
     * @return array{reply: string, suggested_capstones: array}
     */
    public function formatMostPopularTopic(?array $topicData): array
    {
        if (!$topicData) {
            return [
                'reply' => "No category data is available yet in the repository.",
                'suggested_capstones' => [],
            ];
        }

        $reply = "Currently the most popular topic is **{$topicData['category']}**.";

        return [
            'reply' => $reply,
            'suggested_capstones' => [],
        ];
    }

    /**
     * Format capstone submissions per year.
     *
     * @param Collection $submissions
     * @return array{reply: string, suggested_capstones: array}
     */
    public function formatSubmissionsPerYear(Collection $submissions): array
    {
        if ($submissions->isEmpty()) {
            return [
                'reply' => "No submission data is available yet.",
                'suggested_capstones' => [],
            ];
        }

        $lines = [
            "**Capstone submissions per year:**",
            "",
        ];

        foreach ($submissions as $row) {
            $plural = $row->total === 1 ? 'capstone' : 'capstones';
            $lines[] = "**{$row->year}** - {$row->total} {$plural}";
        }

        return [
            'reply' => implode("\n", $lines),
            'suggested_capstones' => [],
        ];
    }

    /**
     * Format advisers who handle the most research projects.
     *
     * @param Collection $advisers
     * @return array{reply: string, suggested_capstones: array}
     */
    public function formatTopAdvisers(Collection $advisers): array
    {
        if ($advisers->isEmpty()) {
            return [
                'reply' => "No adviser data is available yet.",
                'suggested_capstones' => [],
            ];
        }

        $lines = [
            "**Advisers who handle the most research projects:**",
            "",
        ];

        foreach ($advisers->values() as $i => $a) {
            $num = $i + 1;
            $plural = $a->total === 1 ? 'project' : 'projects';
            $lines[] = "{$num}. **{$a->name}** - {$a->total} {$plural}";
        }

        return [
            'reply' => implode("\n", $lines),
            'suggested_capstones' => [],
        ];
    }

    /**
     * Format the most referenced capstone.
     *
     * @param array|null $data
     * @return array{reply: string, suggested_capstones: array}
     */
    public function formatMostReferencedCapstone(?array $data): array
    {
        if (!$data) {
            return [
                'reply' => "No reference data is available yet in the repository.",
                'suggested_capstones' => [],
            ];
        }

        $capstone = $data['capstone'];
        $count = $data['count'];

        $lines = [
            "**Most Referenced Capstone is:** {$capstone['title']} [LINK:{$capstone['id']}]",
            "",
            "**Total Referenced:** {$count}",
        ];

        return [
            'reply' => implode("\n", $lines),
            'suggested_capstones' => [[
                'id' => $capstone['id'],
                'title' => $capstone['title'],
                'author' => $capstone['author'],
                'year' => $capstone['year'],
                'program' => $capstone['program'] ?? '',
            ]],
        ];
    }
}
