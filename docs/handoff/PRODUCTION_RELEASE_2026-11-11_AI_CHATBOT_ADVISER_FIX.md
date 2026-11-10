# Production Release — AI Chatbot Improvements & Capstone Repository Adviser Filter Fix — November 11, 2026

## Executive Summary

- **Backend Release:** `/srv/acadex-staging/releases/acadex-20261111-7e53407/EduArchive-Backend-Laravel`
- **Frontend Release:** `/srv/acadex-staging/frontend-releases/acadex-20261111-7e53407/dist`
- **Base Commit:** `7e53407` on branch `ai_chatbot_audit_improvement`
- **Public Domain:** `https://veload.site`
- **Release Archive SHA-256:** `6e4cc731e7fda54f4a2d021ced0d255d9169fe6cac29099d26a1fec49937f3ae`

This production release deploys the audited and verified AI Chatbot enhancements, the complete Capstone Repository Adviser filter fix, and associated performance and security fixes.

---

## What Was Deployed and Verified

### 1. Capstone Repository Adviser Filter Fix
- **Direct Extraction from Capstones:** Dropdown filter options (`browseFilterOptions`, `filterOptions`, `VisitorCapstoneController::advisers`, `PublishedCapstoneController::advisers`) now retrieve all unique advisers directly from saved capstone records—both registered faculty members and manual entries without system accounts.
- **Deduplication:** Adviser names are normalized and grouped using `NameNormalizer::key()`, stripping academic titles (`Dr.`, `Prof.`, `Engr.`) and credentials (`Ph.D.`, `M.S.`, `MIT`), and normalizing casing and whitespace to eliminate duplicate entries.
- **Two-Phase Symmetric Filtering:** `AdviserMatching::applyFilter` matches by numeric user ID or by string name across both foreign key (`adviser_id`) and text record (`adviser_name`) columns.
- **Admin Library Cleaned Up:** Fixed `CapstoneLibrary.jsx` to load filter options via `getCapstoneFilterOptions()`, eliminating a 1,000-record network query and fixing a bug that previously mapped uploaders instead of advisers.

### 2. AI Chatbot Formatting, Grounding & Security
- **Zero-Dependency Markdown & Table Renderer:** Replaced raw markdown formatting symbols (`###`, `---`, `----`, raw pipe tables, code fences) with pure `React.createElement` structured rendering in `chatMarkdownRenderer.js`.
- **Score-Prioritized Passage Retrieval:** Fixed the passage retrieval budget bug in `PdfPassageRetriever.php` so highest-scoring relevant pages are never truncated by low-scoring early pages.
- **Strict Role-Based Repository Scoping:** Hardened `ChatbotQueryService::baseQuery()` so visitors cannot access non-public, unapproved, or unpublished capstone records through chat queries.
- **Multi-Turn Conversational Anaphora Resolution:** Resolves follow-up queries referencing previous messages (*"tell me more about the first one"*, *"its methodology"*, *"#1"*) without amnesia.
- **AI Citation Sanitization:** Clamps or removes hallucinated `[PAGE:n]` citations pointing outside actual extracted document pages in `ChatbotAiService.php`.
- **Deterministic Knowledge Engine Expansion:** Comprehensive definitions across frontend, backend, databases, architecture, machine learning, IoT, security, and research methodology in `ChatbotResponseService.php`.

---

## Pre-Deployment Backup and Persistent Assets

- **Pre-Deployment Backup:** `/var/backups/acadex/backup-20261111-pre-ai-adviser-deployment` (mode `0700`)
  - `database.sql.gz` (238 KB, gzip integrity verified with `gzip -t`)
  - `laravel.env` (1.5 KB)
  - `apache-sites-available`
  - `apache-sites-enabled`
  - `systemd-dropins`
- **Preserved Persistent Resources:**
  - Production `APP_KEY` and configuration: `/srv/acadex-staging/shared/config/laravel.env`
  - Production encrypted document storage: `/srv/acadex-staging/shared/storage`
  - Production database: `acadex_staging` (no destructive schema changes; all 42 migrations verified as `Ran`)

---

## Production Verification Results

- `https://veload.site/`: **HTTP 200** with new production asset bundles.
- `https://veload.site/assets/index-B6I22GkV.js`: **HTTP 200** (active main entry bundle).
- `https://veload.site/assets/index-CSqW-C7A.css`: **HTTP 200** (active main stylesheet).
- `https://veload.site/sanctum/csrf-cookie`: **HTTP 204**.
- `https://veload.site/api/v1/user`: **HTTP 401** unauthenticated JSON response.
- `http://127.0.0.1:8001/health`: **HTTP 200** `{"status":"ok"}`.
- Live Database Extraction Test: Verified `AdviserMatching::extractOptions` executed against production database, returning all 6 distinct advisers cleanly formatted without errors.
- Systemd Services: `acadex-queue`, `acadex-scheduler`, `acadex-ocr`, `apache2`, `php8.3-fpm`, `mysql` all **active and running**.
- Error Logs: **0 errors** in `/var/log/apache2/acadex-error.log` and `/srv/acadex-staging/shared/storage/logs/laravel-2026-11-10.log` post-switch.
