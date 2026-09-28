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
                    "This is separate from whether the capstone is *visible* in EduArchive (controlled by `is_published`).",
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
                    "- **Published** (`is_published = true`) — the capstone is visible in the EduArchive library for all users.\n" .
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

        $lines = ["📊 **EduArchive Archive Analytics**\n*Live from the database*\n"];

        if (!empty($data['year_counts'])) {
            $lines[] = "**📅 Top Years by Capstone Submissions:**";
            foreach ($data['year_counts'] as $i => $row) {
                $lines[] = ($i + 1) . ". **{$row['year']}** — {$row['total']} capstone(s)";
            }
            $lines[] = '';
        }

        if (!empty($data['program_counts'])) {
            $lines[] = "**🎓 Programs by Capstone Count:**";
            foreach ($data['program_counts'] as $i => $row) {
                $lines[] = ($i + 1) . ". **{$row['program']}** — {$row['total']} capstone(s)";
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
            $lines[] = "**📤 Top Uploaders:**";
            foreach ($data['top_uploaders'] as $i => $row) {
                $lines[] = ($i + 1) . ". **{$row['name']}** — {$row['total']} capstone(s) uploaded";
            }
            $lines[] = '';
        }

        if (isset($data['unviewed_count'])) {
            $lines[] = "**👻 Capstones Never Viewed Since Publishing:**";
            $lines[] = "• Total: **{$data['unviewed_count']}** capstone(s) with 0 views";
            if (!empty($data['unviewed_examples'])) {
                foreach ($data['unviewed_examples'] as $c) {
                    $lines[] = "  – {$c['title']} ({$c['year']}, {$c['program']})";
                }
            }
            $lines[] = '';
        }

        if (isset($data['no_pdf_count'])) {
            $lines[] = "**📭 Capstones with No PDF Attached:** **{$data['no_pdf_count']}**";
        }

        if (isset($data['no_keywords_count'])) {
            $lines[] = "**🏷️ Published Capstones with No Keywords Tagged:** **{$data['no_keywords_count']}**";
        }

        if (isset($data['never_logged_in'])) {
            $lines[] = "**🔐 Users Who Have Never Logged In:** **{$data['never_logged_in']}**";
        }

        if (!empty($data['active_users'])) {
            $lines[] = "**🔥 Most Active Users This Month:**";
            foreach ($data['active_users'] as $i => $u) {
                $lines[] = ($i + 1) . ". **{$u['name']}** — last active: {$u['last_active_at']}";
            }
            $lines[] = '';
        }

        if (isset($data['archived_count'])) {
            $lines[] = "**📊 Archived vs Published:**";
            $lines[] = "• Published (visible): **{$data['published_count']}**";
            $lines[] = "• Archived (hidden): **{$data['archived_count']}**";
            $lines[] = '';
        }

        if (!empty($data['duplicate_titles'])) {
            $lines[] = "**🔁 Capstone Titles Appearing More Than Once:**";
            foreach ($data['duplicate_titles'] as $i => $row) {
                $lines[] = ($i + 1) . ". \"{$row['title']}\" — appears **{$row['total']}** times";
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

        if (isset($data['total_capstones'])) {
            $lines[] = "**📚 Archive Size:**";
            $lines[] = "• Total capstones in archive: **{$data['total_capstones']}**";
            $lines[] = "• Published and visible: **{$data['published_capstones']}**";
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
}
