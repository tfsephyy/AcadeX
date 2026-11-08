# AcadeX implementation progress

## 2026-11-09 - Production Release: UI Refinements, ID Validation, and Modular PDF Extraction

Merged `origin/release/ui-refinement` (commit `e32fa20`) into `main` and pushed to GitHub `origin/main`. Deployed both backend and frontend to AWS EC2 (`https://veload.site`).
- Backend release: `/srv/acadex-staging/releases/acadex-20261109-e32fa20/EduArchive-Backend-Laravel`
- Frontend release: `/srv/acadex-staging/frontend-releases/acadex-20261109-e32fa20/dist`
- Applied migration: `2026_11_08_000001_add_capstone_adviser_name`
- Verified:
  - Uploads card grid: 3 cards per row default, 4 when collapsed (`library-grid`).
  - Registration ID validation: removed rigid `MBC` regex format constraint.
  - Admin Dashboard: fixed upload year series calculating calendar year of upload.
  - Faculty Dashboard: updated Adviser Dashboard UI active.
  - Modular PDF extraction active with OCR service health verified at port 8001.
  - Frontend assets `index-Dqxqu3pJ.js` and `index-Bau6mt0A.css` serving HTTP 200.
  - Database backup taken prior to migration and verified at `/var/backups/acadex/ui-refinement-20261109/database.sql.gz`.
  - All 6 services active: `acadex-queue`, `acadex-scheduler`, `acadex-ocr`, `apache2`, `php8.3-fpm`, `mysql`.
See [production release report](handoff/PRODUCTION_RELEASE_2026-11-09_UI_REFINEMENT_MODULAR_EXTRACTION.md).


## 2026-11-08 - Source published to the client's GitHub repository

Committed the 61 reviewed staged source/test/documentation files as
`1402d74946f67e2e15869ef64c74890c3c3fbd08` (Refine capstone uploads and modular
PDF metadata extraction) and pushed to `origin/release/ui-refinement` at
`https://github.com/tfsephyy/AcadeX.git`. Fresh `git ls-remote` matched the local
commit. The staged-path and secret-pattern review found no private/generated
files or flagged secrets. Existing `.local`, env/testing credentials, private
storage, keys and dependencies remain excluded. Working tree was clean after
the code push. This follow-up documentation records that verified publication.
The preceding 171 backend / 58 frontend tests and build/lint/browser checks
remain the local implementation evidence; no code changed during publication.
No merge to main, migration or production deployment occurred.

## 2026-11-08 - Upload layout, required choices and full-PDF keywords

Implemented locally: Step 2 puts adviser/keywords beneath year/program/category
and gives the abstract a full row. Step 3 pairs IMRAD/resources and references/
summary for all three roles, stacking on mobile. Both publication and copyright
now require explicit choices; new-submission API validation enforces both.

Full-document text now feeds frequency-first keyword ranking, including a
maintained research/capstone vocabulary alongside computing terms. Retain 15
unique source-matched tags without padding. Metadata fields still use their
front/CV windows. Large originals use isolated Ghostscript text output; unreadable
pages use native OCR within the shared deadline, with explicit incomplete-reading
notes. No existing document or record is reprocessed automatically.

Final verification: **171 guarded-disposable-MySQL tests / 1,566 assertions
passed**. Frontend **58 tests passed**; final production build (**851 modules**)
and quiet lint passed. Synthetic Chrome
checks passed desktop/mobile row geometry, required-choice blocking, valid payloads
and no overflow for Admin, Faculty and Student. Browser APIs were intercepted;
real database persistence/approval guards were tested separately. Final PHP syntax
and Git whitespace checks passed. Gracefully reloaded the verified owned local
queue after an empty/zero-failed check; replacement PID **25028** is running, the
private process receipt is updated, and pending/failed job counts remain zero.
No jobs were discarded. No migration, application-data rewrite or production
access. Actual client-PDF accuracy and Linux-specific process limits remain
separate acceptance. See [the implementation record](ui/2026-11-08-upload-layout-full-pdf-keywords.md).

## 2026-11-08 - Technical keywords and adviser editing (verified locally)

Implemented a maintained source-matched computing dictionary and 15-keyword
automatic cap. Removed arbitrary frequent-word acceptance and filtered explicit
keyword labels through the same technical dictionary. Shared KeywordInput limits
and normalization now run before both create/update validation; expanded comma
lists and case-insensitive duplicates are validated before persistence.

Upload review and the shared Admin/Faculty/Student edit modal now use one tag
editor with comma entry, individual editing/removal and a visible maximum error.
Added the existing AdviserField to editing and changed its shared placeholder to
exactly Enter Manually here. Untouched adviser and keyword fields are omitted
from edits, preserving legacy values and unavailable historical assignments.
No existing record rewrite, schema change or production access.

Final full guarded-MySQL suite passed: **164 tests / 1,452 assertions**. Frontend
**58 tests passed**; lint **0 errors / 32 existing warnings**; production build
passed (**851 modules**). Synthetic Chrome upload/edit checks passed for all three
roles, including comma paste, individual tag edits/removal, 15-limit Save/Next
validation, exact placeholder, saved/empty/unmatched adviser names, Faculty
selection and refresh/mobile behavior. Browser APIs were intercepted; actual
MySQL persistence/permissions and Faculty dashboard reassignment were verified
separately by the guarded integration tests. Actual client PDFs/production remain
unverified. See [the implementation record](ui/2026-11-08-technical-keywords-adviser-edit.md).
Local queue was empty with zero failed jobs before its graceful reload. Replaced
the owned local worker with PID 11836 and updated its private process receipt;
the running replacement uses the current extraction classes. No queued jobs were
discarded or original documents/configuration/application records rewritten.

## 2026-11-08 - Modular extraction rules (verified locally)

Read the attached deterministic extraction specification and split metadata into
independent services under app/Services/Extraction. PdfExtractorService now owns
validation, bounded reads and native traditional OCR only. Shared cleaned pages
retain page numbers, original text and optional positions; per-field failures
return sanitized manual-review warnings. Added named-CV contact parsing from up
to 12 tail pages, conservative spacing repairs, source-based keyword ranking,
fixed BSIT for new submissions and stronger exact normalized Faculty matching.
The review UI keeps BSIT read-only and protects explicit manual edits/clears.
No schema change, application-data rewrite or production access.

Final backend verification: **154 tests / 1,346 assertions passed** in the guarded
disposable MySQL schema. Frontend 55 tests passed; lint has 0 errors and the existing
32 warnings; production build passed (849 modules). Fixed an old large-file test
fixture whose actual size differed from its declared upload size. Individual
extraction regressions, wrapped labels/dates and formatted Roman page numbers pass.
A final margin regression also verifies removing unfamiliar first-page repeated
headers without losing legitimate titles reused in later headers.
Synthetic browser checks passed across all three upload roles. A generated
three-page image-only PDF passed actual native Ghostscript/Tesseract extraction.
The 150-page synthetic text pipeline averaged about 37 ms across three runs;
this does not establish real-document/production latency.

Gracefully restarted the owned local queue worker after an empty-queue/zero-failed
check; final replacement PID 6028 is running and its private process receipt is updated.
Original PDFs, private configuration and application records were not rewritten.
Actual client PDF quality and Linux large-file sampler execution are unverified.
See [the service and verification record](ui/2026-11-08-modular-pdf-extraction.md).

## 2026-11-08 — Local upload submission schema repair (verified locally)

Student POST /api/v1/student/capstones returned 503. Redacted local log inspection
confirmed SQLSTATE 42S22 / missing adviser_name. Fresh runtime and private-env
identity checks agree on loopback EduArchiveDB (five users, ten capstones), not
the historical ASUS acadex_local target. Exactly one migration is pending:
2026_11_08_000001_add_capstone_adviser_name. The earlier feature task tested this
only in the disposable schema; current user request authorizes repairing the
active local upload workflow. Creating/verifying a fresh private SQL/env/storage
backup before applying that one additive migration. No production action.

Completed: created and verified private recovery set
`.local/adviser-schema-backup-20261108-072705` (SQL dump completion/hash,
environment/APP_KEY hash, all 118 storage-file copies/hashes and original row
snapshot). Applied only the reviewed adviser-name migration to the verified
local EduArchiveDB. Fresh inspection shows adviser_name present, no pending
migrations, five users and ten capstones. Two preservation checks passed for
872 original application rows/values, environment/APP_KEY and all 118 original
files. Runtime operational tables (sessions/cache/jobs/migrations) are excluded
from row-equality claims. No production connection or migration occurred.

Focused guarded-disposable regression passed: **14 tests / 142 assertions** for
adviser submissions, approvals, upload ownership and sanitized failure messages.
The local queue worker remains active. The reported POST failed before the
staged PDF was claimed, so retrying the retained submission can reuse that file
while its existing reference remains valid. No synthetic submission was made
against the application DB; the user's own retry remains actual-flow acceptance.
No code fallback or validation/approval bypass was added. No commit or push.
This supersedes earlier local adviser-migration-pending entries below.

## 2026-11-08 — PDF-only extraction and worker recovery (done locally)

Found the local queue receipt pointing to a stopped process; one metadata job
was waiting. The configured metadata model URL was absent, so AI was not an
observed local latency cause. The code still called optional model enrichment
and prepared a full viewing preview before metadata extraction. Removed the
model service/call/config and deterministic wording rewrites/inferred keywords;
bounded metadata text and native/Paddle OCR to 12 pages. Viewing previews now
belong to post-submission indexing. Existing adviser extraction/matching remains.

New tests exposed and corrected abstract termination at the word "keywords" in
body text and a location header leaking into a synthetic title. An overbroad
cleanup edit was caught and corrected during source review before acceptance;
the original author/year parsers were restored.

Focused extraction/recovery checks passed: 18 tests / 207 assertions. Full guarded
disposable-MySQL suite passed: **138 tests / 1,203 assertions**. Eight lightweight
Python tests (text selection, allocation safety, bounded PDF loop with synthetic
page objects) passed; Python syntax passed. Actual Paddle model/scan integration
is not verified in this workstation's missing OCR virtual environment.

Restored an owned hidden local queue worker and updated its process receipt;
launcher/worker poll every second. Local configuration cache cleared. The waiting
job drained; diagnostic counts show no pending/failed jobs and the same four
completed staged uploads. No account/capstone/document fixture was created in the
application DB; synthetic database tests use the separate restricted schema.
No private env/APP_KEY change, schema migration or production action occurred.
Final verification supersedes the checkpoint above: **140 backend tests / 1,218
assertions passed**, including a real database-worker extraction of a synthetic
150-page PDF with the actual parser, completed review metadata/adviser fields,
no model requests and no preview preparation. Eight lightweight Python tests,
PHP/Python syntax and whitespace checks passed. No frontend code changed here.

The benchmark uncovered readable front matter being averaged below the OCR
threshold among sparse pages. Corrected the detector and added a test prohibiting
OCR for that real text-PDF fixture. The final three-run benchmark averaged
17.10 ms bounded versus 64.18 ms all-page text reading; the earlier unintended
OCR fallback took approximately 11 seconds. These are synthetic parser timings,
not full-upload or real scanned-document acceptance.

Gracefully restarted/replaced the owned local worker to load final code; its
receipt is current and read-only diagnostics show no pending/failed jobs. The
Paddle service/venv is absent locally, so live model/scan quality remains
unverified. No production deployment, migration, commit or push occurred.
See [the extraction repair record](ui/2026-11-08-pdf-only-extraction.md).

## 2026-11-08 — Local Vite 5174 CORS repair (verified)

Observed two local Vite servers on 5173/5174 and the API on 8000. The private
environment configured only frontend 5173, so the single-origin CORS response
sent 5173 even for the user's 5174 page. Added explicit localhost 5173/5174 CORS
origins and matching Sanctum stateful domains only when APP_ENV=local; configured
production/staging origins stay unchanged. No wildcard origins were introduced.
Cleared the local Laravel configuration cache; no service restart was required.

Verification: 22 focused guarded-disposable tests / 122 assertions passed
(CORS config, CSRF, authentication and production checks), changed PHP syntax
and whitespace checks passed. Live OPTIONS for user/CSRF/login from both ports
returned 204 with the exact requesting origin and credentials=true; an untrusted
origin received no CORS allowance. Fresh Chrome opened localhost:5174/login,
rendered the form, read CSRF 200 and anonymous user 401 without CORS/network
failures. This normal local page check can create/update an anonymous session;
no account login or document/record mutation was performed.

Private env files, APP_KEY, existing feature work and documents are retained.
No migration, production action, commit or push occurred. The earlier new
adviser-name migration remains applied only in the disposable test schema.

## 2026-11-08 — Dashboard, registration and adviser follow-up (done locally)

Initial Git worktree was clean. Implemented calendar upload-year aggregation with
zero-filled years, approval filter correction, navigation-aware My Uploads grids,
Faculty desktop arrangement/two-line trends, flexible registration ID validation,
student publication selection behind the review gate, and shared editable adviser
extraction/matching. Added an additive nullable `capstones.adviser_name` migration;
server resolves eligible matches again on submission/edit. At that first checkpoint,
local tests and browser verification were pending. No application database migration or production action
has been performed for this task.

Earlier checkpoint: new focused backend checks passed (21 tests / 243 assertions), 53
frontend tests and quiet lint passed, and the production build passed (848 modules)
with a process-only same-origin API setting. The first full backend run found one
existing edit-workflow expectation failure: student edits must still reset to
unpublished. Restored that edit rule while preserving the newly requested Step 3
submission choice. Full rerun and browser acceptance were pending at that checkpoint.
Admin grid browser checks passed at desktop/tablet/mobile; the chart probe later
needed the installed Recharts version's separate tick-label layer selector.

Final local verification: **132 backend tests / 1,160 assertions**, **53 frontend
tests**, quiet lint, final production build (**848 modules**), changed/new PHP
syntax and Git whitespace checks passed. The final browser probe passed Admin,
Faculty and Student My Uploads grids at desktop/tablet/mobile and live sidebar
toggles; Faculty card/chart/ranking placement; every Admin year/count tooltip,
including zeroes, and chart API failure/retry; editable adviser matching/duplicate
selection; and all three student publication-selection payloads. Browser requests
were intercepted with synthetic responses; no application DB mutation occurred.
Actual synthetic text-PDF parsing and deterministic OCR-page lines passed adviser
extraction tests; arbitrary scanned-PDF quality remains unverified.

The adviser-name migration has run only in the guarded disposable MySQL schema.
Existing local application and production databases, environment/APP_KEY and
private documents remain outside this task's writes. The code needs the forward
migration before adoption on an existing target, after a verified coherent backup.
No deployment, commit or push occurred. See
[the complete implementation/evidence record](ui/2026-11-08-dashboard-registration-adviser.md).

## 2026-11-08 — AI Capstone Research Assistant production release

Deployed the chatbot controller/service, Groq-primary/Gemini-fallback
configuration, and the production React build to
`/srv/acadex-staging/releases/acadex-20261108-ai-research-86c2487` and
`/srv/acadex-staging/frontend-releases/acadex-20261108-ai-research-86c2487/dist`.
The release was packaged from base commit `86c2487` plus selected local runtime
changes; no GitHub commit or push was made. Existing hashed frontend assets were
retained.

Created and verified root-only recovery set
`/var/backups/acadex/chatbot-release-20261108T022610Z`, including database,
environment, encrypted storage, current releases and service configuration.
The original environment checksum and shared `.env`/storage targets remain
unchanged. `php artisan migrate --force` reported **Nothing to migrate**;
production `migrate:status` showed no pending migrations. `optimize:clear`,
config, route and view caches completed.

Apache syntax passed; Apache and PHP-FPM were gracefully reloaded. Queue and
scheduler are active on the new backend path; OCR remains untouched. HTTPS root
and new JS/CSS assets returned 200, anonymous JSON `/api/v1/user` returned 401,
and the database connectivity check passed.

Production has no Groq or Gemini API keys configured. The chatbot is deployed
with its deterministic local fallback active; provider calls require keys added
through the private environment channel. No provider keys were copied or used.
No production feature tests were rerun, per request. See the [release record](handoff/PRODUCTION_RELEASE_2026-11-08_AI_CAPSTONE.md).

## 2026-11-07 - Staged upload quota lifecycle fix

Verified the checked out source against the initial diagnosis. Pending usage counts
every unexpired, unclaimed row; prune/discard take the owner lock first, preserve
capstone/resource references, and remove existing chunk files before cascading
transfer metadata. Finalization quota failures expire their transfer; retrying the
same ID returns 410 with PDF reselection guidance. Review Back confirms and
discards, while progression and successful submission retain/claim the upload.

Local verification used the guarded disposable database: full backend suite **112
passed / 1,021 assertions**, focused staged-upload suite **13 passed / 69
assertions**; frontend **50 passed**; lint **0 errors / 32 warnings**; production
build **846 modules**. Deployed on November 8 from commit `6fa3fac`; no migration
was added. The 1 GiB quota was cached, both services use the new release, and the
one-time prune removed **20** expired uploads. Production root returned 200,
anonymous upload status returned 401, and the page rendered in Chrome. Recovery
backup checksums passed; see the fix handoff for its path and details.

## 2026-11-07 - ASUS local setup complete, not deployed

User authorized backup, pending local migrations and feature verification.
Verified the actual loopback `acadex_local` target (five users, zero capstones).
Created and verified private SQL/configuration/storage backups under ignored
`.local/local-setup-backup-20261107-asus`, then applied exactly the nine pending
migrations. None remain pending. Every original row value in the 24 original
non-migration tables, all four original storage files and exact environment/APP_KEY
matched afterward. A browser sign-in-page check added two anonymous sessions;
original sessions were separately verified against the backup and retained.

Fixed local startup to follow Vite's development API address (8010 here) and
start the cleanup scheduler with the queue worker. Process receipts retain known
executables. Full stop/restart and repeat-start reuse passed. The frontend, API
and OCR health checks pass, and the sign-in page renders. Two old synchronous
metadata-test expectations were updated to verify queued extraction/status.

Fresh checks: 99 guarded disposable-MySQL tests / 950 assertions, 44 frontend
tests, quiet lint, production build (846 modules), PHP syntax and whitespace
passed. Actual isolated HTTP transfer resumed a roughly 5 MiB synthetic PDF at
the confirmed 2 MiB offset, deduplicated replay/finalization, and completed real
extraction through an independent database queue worker. Decrypted bytes match
the original; no pending/failed jobs remained. Owned helper fixtures/server were
cleaned up. Composer locks/platform match; no dependency changes were needed.

See [the complete local report](handoff/LOCAL_SETUP_2026-11-07_ASUS.md) for backup,
preservation, operating instructions and external/large-transfer boundaries.
No production connection, deployment, password reset, key regeneration, seed,
commit or push occurred. Prior workstation-specific entries remain historical.

## 2026-11-07 - Client source pulled on the ASUS workstation

Fast-forwarded `release/ui-refinement` from `9d829d6` to client commit
`a6025cf5a782b37dad9260352794df8b39f36473` (November 7, 5:00 PM Asia/Manila).
The remote branch check confirms this is the latest published branch tip; `main`
remains at `6740efc`. Retained all six modified and three untracked local files.
Resolved overlapping PDF component changes by combining upstream reading-position
support with the existing local 64 KiB/four-request/inactivity fix. Both sets of
documentation are retained. Recovery stash:
`088e745e286fd15afaf7f00aff2576faa2edb576`; no local commit or push was made.

Current verification: 44 frontend tests passed; all 21 changed/new PHP files passed
syntax checks. Quiet ESLint and the production build passed (846 modules,
process-local `VITE_API_BASE_URL=/api/v1`). Git whitespace checks passed, there are
no unresolved conflicts or staged files, and HEAD is 0 ahead / 0 behind the remote
branch. No database tests were run. A read-only `migrate:status` check found nine pending local migrations:
November 5 `000001`-`000006` and `000008`, and both November 7 migrations. The
Google identity migration (`000007`) is already applied. No schema, application
records, environment, APP_KEY, private documents, or production resources were
changed. The earlier client-workstation runtime repair is not evidence that this
ASUS workstation has been migrated. Local runtime setup and deployment remain
separate from this source pull.

## 2026-11-07 — Interface/PDF follow-up, done (local), not deployed

Preserved the pre-existing dirty worktree, upload activity implementation and
adviser removal. Implemented remaining slug-based launches and chatbot links,
the navigation/title changes, copyright display wording, the three-card analytics
layout, User Management navigation refinements and Faculty repository contrast.
Admin and Faculty now use a shared workspace shell and notification list, with
the bell beside the account control and readable theme-specific unread surfaces.
The existing Faculty notifications URL and pagination remain available.

PDF page persistence is shared by original/IMRAD viewers and fullscreen, keyed by
capstone ID, document type and signed-in account, with browser-local visitor
fallback and storage-error tolerance. Fullscreen zoom controls support 25–300%.

Local verification: 26 frontend unit tests passed, including storage
isolation, invalid/stale progress and viewport-page selection. Two database-free
PHP slug tests passed (3 assertions); PHP syntax checks passed for the two changed
chatbot files. The production build with `VITE_API_BASE_URL=/api/v1` passed (838
modules); Vite required execution outside the filesystem sandbox. Git whitespace
checks passed.

Headless Chrome verified all four roles with intercepted synthetic APIs and an
eight-page synthetic PDF: scroll-save/reload, numeric URLs, account/document
isolation, independent original/IMRAD progress, fullscreen handoff and zoom to
25%. An initial fullscreen cleanup saved a detached DOM's final page, and a
document switch reused stale reader state; both were corrected and the complete
four-role extended browser run passed afterward without script errors. A later
repeat caught a queued observer reading a detached document; a connection guard
and one-time restoration observer were added. The final four-role browser run
passed, followed by six repeated reload/original/IMRAD/fullscreen cycles each in
the Admin and Visitor viewers. The repeated probe was corrected to wait for PDF
readiness rather than asserting during an expected loading transition. Read and
unread notifications, related slug links, read controls, Escape, analytics removal,
copyright wording, desktop/light and mobile/dark browse layouts also passed.
User Management was checked at 1440/768/390px without document overflow or nested
navigation scrolling. No database tests or production operations were performed.
See [the detailed local report](ui/2026-11-07-panel-pdf-followup.md) for boundaries.

Last updated: 2026-11-07. The client source update and this workstation's retained November 5 PDF hotfix are combined locally; see the synchronization entry at the end. Earlier local-runtime observations belong to the client workstation that recorded them. No database migration or deployment was performed by this pull.
Read first: [ACADEX_REQUIREMENTS.md](ACADEX_REQUIREMENTS.md) and
[ACADEX_DECISIONS.md](ACADEX_DECISIONS.md).

Legend: `pending` · `in_progress` · `done (local)` · `done (deployed)` · `blocked` · `unverified-deployed`.

> "Done (local)" means code exists and the recorded local checks passed. It does **not**
> mean the production server runs it. Production remains unverified until a deployment
> with access is performed and acceptance checks are recorded here.

## Baseline (2026-11-05)

- Repository: `https://github.com/tfsephyy/AcadeX.git`
- Branch/HEAD at start: `80f69bf Update release publication references` (2026-11-01)
- Worktree at review start: dirty with the implementation already present; all existing changes were preserved.
- Local tools: Node 22.23.4, npm 10.9.9, PHP 8.3.16 (ZTS, Laragon), Composer 2.8.11,
  Docker CLI 29.9.2 (**daemon not running**), no local `mysql`/`redis-server` on PATH.
- Backend local DB: `acadex_local` via Laragon MySQL; private `.env` present and untouched.
- Existing queue config: `QUEUE_CONNECTION=database`; no Redis PHP extension loaded.
- Production access from this workstation: **not established**. No AWS/SSH credentials
  were used or requested for this work.

## Current phase

Phase 1 — 16-item implementation and review corrections: **done (local)**.
Deployment and live authenticated acceptance remain pending production access.

## Work log

### Phase 1 — implementation (all 16 items, local)

**R1 — Independent PDF loading:** added `usePdfBlob.js` and `PdfLoadState.jsx`;
admin/student/visitor detail pages render metadata first and load PDFs with
progress, timeout, error, and retry. View recording no longer blocks metadata.
The review pass replaced full-Blob loading with authenticated PDF.js range
requests and added cross-origin range-header exposure. New uploads use a
random-access authenticated chunk format; existing V1 files remain readable but
need the backup-preserving conversion command before they receive the same speedup.

**R2 — Logo/theme:** removed the sidebar logo white plate; sidebar uses
`variant="sidebar"`. Brand SVG assets remain unchanged. Visual theme checks
remain part of deployment verification.

**R3 — Google registration:** Google Identity Services frontend button plus
server-side signed-token verification through Google's PHP client library
(`GoogleIdentityService`). The verified
Google email is authoritative; manual email-code and password steps are skipped
for Google registration. Existing password accounts are never auto-linked or
taken over; `google_id` must match for Google sign-in.

**R4 — Registration security:** named throttles (register/login/forgot/reset/
verification/Google), honeypot, signed registration challenge with minimum
completion time, optional Turnstile (enforced only when configured), generic
forgot-password responses. Registration integration test updated to issue the
challenge.

**R5/R6 — Background processing + extraction:** `upload()` now stores/encrypts
the PDF, stages a `DocumentUpload`, returns a stable `upload_id`, and dispatches
`ExtractUploadMetadataJob` (atomic claim, dedupe, retries, timeout, persisted
`queued`/`processing`/`completed`/`failed` states, uploader notifications).
`store()` dispatches `ExtractPdfTextJob` instead of synchronous full-text
extraction. `PdfExtractorService::extractPathWithSource()` supplies cleaned
source text, whitespace normalization, and repeated-margin removal. Optional
Ollama (`MetadataAssistantService`) is opt-in, timeout-bounded, and grounded
against source text; extraction failures become `unavailable` metadata rather
than blocking uploads.

**R7 — Database:** migrations `000001`–`000008` add capstone slug/processing
and library indexes, adviser availability, upload processing/original name,
notification delivery/dedupe/email fields, citation events, password-reset IP
hash, and Google ID. All are forward, non-destructive migrations.

**R8 — Slugs + IEEE:** `CapstoneSlug` assigns unique slugs once at creation;
`Capstone` route binding accepts numeric IDs or slugs. `CitationService` and the
frontend generator support APA/MLA/IEEE; generations are recorded in
`citation_events` and labelled "citation generations" everywhere.

**R9 — Faculty dashboard:** new `FacultyDashboardController` (`/faculty/dashboard`)
with adviser-scoped totals, pending review, recent assigned submissions,
most-viewed, most-cited (citation generations), and 6-month upload/view trends;
repository-wide numbers are returned and displayed separately. Page, nav entry,
and `/faculty/dashboard` route added.

**R10 — Adviser notifications:** `store()` creates deduplicated in-app
notifications for admins and the selected adviser, and dispatches
`SendAdviserSubmissionEmailJob` for the adviser (title, uploader, date, link;
deduplicated by notification row). Notification routes moved to a shared
authenticated group and `NotificationController` is recipient-scoped, so faculty
can read/mark their own notifications.

**R11 — Faculty library:** `browse?assigned=1` restricts faculty queries to
`adviser_id = current user` (pending submissions included for review); existing
adviser reviewer policy, approval/rejection, and ownership/edit rules are
unchanged. Assigned capstones page and slug links added.

**R12 — Uploader info:** "Uploaded by" (from the uploader user record, never the
author field) shown on admin/student/visitor detail pages, capstone modals, and
repository cards; visitor detail and library cards updated.

**R13 — Keywords:** `normalizeKeywords()` on the backend and comma-splitting in
`ReviewExtractedDataPage` (trim, ignore empties, case-insensitive dedupe,
editable/removable entries before save).

**R14 — Adviser pool:** `AdviserController` list and availability toggle reuse
faculty user accounts (`adviser_available`); upload pickers and `store()`
validation only accept active, approved, available faculty; deactivation does
not alter historical assignments. Admin adviser pool page added.

**R15 — Admin user UI:** admin pages share the WorkspaceSidebar layout and
responsive table wrappers; no structural UserManagement redesign was required
beyond confirming shared layout. Deployed visual check remains pending.

**R16 — Upload modal:** "Upload & enter manually" and the manual-entry escape
hatch were removed from all three role modals. The review page now polls
`/uploads/{id}/status` with retry, so queued/processing/completed/failed states
are clear and processing survives navigation/closure (a notification is sent on
completion/failure).

### Phase 0 — project memory

- Created `docs/ACADEX_REQUIREMENTS.md`, `docs/ACADEX_PROGRESS.md`,
  `docs/ACADEX_DECISIONS.md`.
- Extended `AGENTS.md` to require reading them at session start/resume.
- No application code changed yet.

### Review pass — implementation defects and performance (2026-11-05)

- **R1 remained slow after the first frontend fix.** PDF.js waited for a complete
  Blob, and legacy server handling authenticated the whole encrypted file before
  decrypting it again for the response. Changed the viewer to fetch byte ranges;
  new uploads use independent authenticated 1 MiB blocks, and CORS exposes the
  range headers PDF.js needs. Added local tests for partial retrieval and corrupt
  block rejection. Existing V1 records are not rewritten automatically.
- Added `acadex:upgrade-document-encryption` for existing files. It requires a
  separate backup confirmation, checks disk headroom, stores exact encrypted
  backups and a private manifest, verifies conversion, and validates referenced
  paths stay inside private local storage. A synthetic legacy file conversion
  passed locally; the command has not been run against production.
- The first Google signup button called the sign-in path, and the registration
  handler omitted its API import. Corrected the registration flow and switched
  from the Google token-info endpoint to signed ID-token verification through
  `google/apiclient`, with bounded network timeouts. Registration still needs
  configured client IDs for live verification.
- Slugs for numeric-only titles collided with existing numeric-ID route binding;
  such titles now receive a `capstone-` prefix. The migration avoids a per-row
  existence query.
- The checkout lacked the Redis Compose file described by the implementation
  notes. Added the localhost-only Redis service and adjusted the worker unit to
  restart after Laravel's successful worker restart signal. Docker Compose syntax
  validates, but Docker is unavailable here and the service has not been started.
- `composer audit` found eight Symfony advisories in the locked packages. Updated
  the compatible Symfony 7.4 components to patched releases; the audit now reports
  no advisories.
- Frontend lint caught and fixed the Google registration import, a synchronous
  hook update, stale unused imports, and assigned-library loading state issues.
- The first full backend test run used an old disposable schema and left fixtures
  behind. Added a guarded `--fresh` mode to the test runner; after fresh migrations
  on the schema-restricted disposable database, the complete suite passes.

### Findings that drive implementation

1. **R1 root cause (frontend):** admin/student/visitor capstone detail pages await the
   full encrypted PDF blob before clearing `loading`; view recording is also awaited.
   A large/slow PDF therefore keeps "Loading capstone..." visible indefinitely.
   Relevant paths:
   - `EduArchive-Frontend-React/src/pages/admin/CapstoneMainPage.jsx`
   - `EduArchive-Frontend-React/src/pages/student/StudentCapstoneMainPage.jsx`
   - `EduArchive-Frontend-React/src/pages/visitor/VisitorCapstoneMainPage.jsx`
   - backend `CapstoneController::servePdf` / `PdfEncryptorService::openVerifiedDocument`
2. **R5 root cause:** `CapstoneController::upload()` runs metadata extraction/OCR
   synchronously, and `store()` runs whole-PDF text extraction synchronously.
3. **R3:** no OAuth package/config exists yet.
4. **R14:** adviser picker lists all approved faculty; no availability state exists.
5. **R8:** no slug column; citation UI has only APA/MLA; no citation tracking table.
6. **R9:** no faculty dashboard route/page; faculty layout has upload/approval/library only.
7. **R10:** adviser notification is in-app only and only for student uploads; notification
   routes are currently inside the admin-only group, so faculty cannot read them.
8. **R2:** brand SVGs need inspection for baked backgrounds.
9. **R15:** admin `UserManagement.jsx` needs structural/CSS review for the nav scrollbar
   and responsive tables.

## Requirement tracker

| Req | Priority | State | Local evidence | Deployed evidence |
| --- | --- | --- | --- | --- |
| R1 capstone loading/viewer | high | done (local) | PDF.js authenticated byte ranges; 1 MiB authenticated chunks for new files; legacy conversion command; local range/corruption tests | not deployed; old production files need conversion, authenticated PDF timing unavailable |
| R2 logo/theme | medium | done (local) | sidebar white plate removed; `variant="sidebar"` | not deployed — visual theme check pending deployment |
| R3 Google registration | high | done (local) | GIS Step 2 registration path; Google PHP client validates signed ID token; no auto-linking | not deployed — live OAuth pending matching frontend/backend client ID |
| R4 registration security | high | done (local) | named throttles, honeypot, signed challenge, optional Turnstile, generic forgot-password | not deployed |
| R5 background processing | high | done (local) | queued job, persisted statuses, pollable `/uploads/{upload}/status`, retry, notifications; Redis Compose and worker examples | not deployed — Docker runtime and worker unverified |
| R6 extraction/OCR/Ollama | high | done (local) | bounded extraction, cleaned source, opt-in grounded Ollama; unit tests pass | not deployed — Ollama live run pending host |
| R7 database | high | done (local) | migrations `000001`–`000008`, forward/non-destructive | not deployed — production migration pending backup + access |
| R8 slugs + IEEE | medium | done (local) | slug service + ID-or-slug binding; APA/MLA/IEEE with tracking | not deployed |
| R9 faculty dashboard | medium | done (local) | `FacultyDashboardController` + page + route; assigned vs repository scoped | not deployed |
| R10 adviser notifications | high | done (local) | deduplicated in-app + queued email with link; shared notification routes | not deployed — email delivery pending worker + mail config |
| R11 faculty library | medium-high | done (local) | `browse?assigned=1` enforced server-side; assigned page + routes | not deployed |
| R12 uploader info | low | done (local) | uploader from user record on detail pages, modals, and cards | not deployed |
| R13 keywords | medium | done (local) | backend normalization + comma-splitting UI with dedupe/edit/remove | not deployed |
| R14 adviser list management | medium | done (local) | `AdviserController` + admin pool page; availability on faculty accounts | not deployed |
| R15 admin user UI | medium | done (local) | shared admin layout; responsive tables | not deployed — visual QA pending deployment |
| R16 upload modal | medium | done (local) | manual-entry option removed; review page polls status with retry | not deployed |

## Verification log

| Date | Scope | Command/flow | Result |
| --- | --- | --- | --- |
| 2026-11-05 | repo state | `git status --short`, `git log` | branch `release/ui-refinement`, HEAD `80f69bf`; worktree has preserved modifications and new implementation files |
| 2026-11-05 | toolchain | node/npm/php/composer/docker versions | recorded above; Docker daemon down |
| 2026-11-05 | PHP syntax | `php -l` on all new/changed backend files | no syntax errors |
| 2026-11-05 | routes | `php artisan route:list --path=api/v1` | new routes listed: `/uploads/{upload}/status`, `/uploads/{upload}/retry`, `/capstones/{capstone}/citation`, `/faculty/dashboard`, `/admin/advisers`, shared `/notifications`, `/register/challenge`, `/auth/google/*` |
| 2026-11-05 | backend guarded tests | `php scripts/run-security-tests.php --fresh`, then `php scripts/run-security-tests.php` | 80 passed, 725 assertions against a disposable schema restricted by the runner; no production/local application DB used |
| 2026-11-05 | backend focused tests | guarded runner filters `StreamingDocumentTest`, `CapstoneSlugTest` | 8 PDF stream tests passed (29 assertions); 2 slug tests passed (3 assertions) |
| 2026-11-05 | legacy conversion | guarded `UpgradeDocumentEncryptionTest` | synthetic V1 file was backed up byte-for-byte, converted to V2, fully authenticated, and left at the same database path (1 test, 9 assertions) |
| 2026-11-05 | frontend checks | `npm test`, `npm run lint -- --quiet`, `VITE_API_BASE_URL=/api/v1 npm run build` | 15 tests passed; lint passed; production build passed (824 modules) |
| 2026-11-05 | dependencies | `composer audit --locked --format=summary` | no known security advisories after Symfony updates |
| 2026-11-05 | runtime config | `docker compose -f deploy/redis.compose.yml config --quiet` with temporary validation password | syntax passed; Docker daemon unavailable, so Redis was not started |
| 2026-11-05 | live unauthenticated probe | `/up`, CSRF token, Sanctum cookie, `/api/v1/user` | 200/200/204/401 as expected; no authenticated capstone/PDF range timing was possible |
| 2026-11-05 | deployment | — | **not deployed** — no verified production access; nothing above is deployed verification |

## Blockers / environment limits

- No verified production/AWS/SSH access. Deployment and deployed verification
  cannot be claimed from this session; all 16 items are **done (local)** only.
- Existing production documents use legacy encrypted formats until the conversion
  command runs. New uploads use the faster range-capable format. Conversion needs
  a verified encrypted backup and free space for the old file, temporary output,
  encrypted backup, and reserve.
- Docker daemon is not running and the Redis PHP extension is not installed.
  Queue code degrades to the `database` driver locally; the Redis runtime path
  (D-003) is implemented but unverified until Docker Desktop is available.
- Google OAuth client credentials and Cloudflare Turnstile keys are not
  available. The Google/Turnstile code paths report "not configured" or are
  skipped safely; live OAuth/Turnstile verification cannot be done here.
- Ollama is not assumed to be installed. The integration is opt-in and
  offline-safe; a live run is pending a host with the runtime.
- The feature suite was run only through the guarded disposable MySQL runner
  (`acadex_remediation_test_[a-f0-9]{10}`). Continue using that runner; never
  point tests at `acadex_local` or a production database.

## Next actions

1. Obtain approved production access (backup, then migrate), set env
   (`QUEUE_CONNECTION`, `GOOGLE_CLIENT_ID`, matching frontend
   `VITE_GOOGLE_CLIENT_ID`, optional `OLLAMA_URL`/`TURNSTILE_*`),
   start the queue worker, and deploy.
2. Run migrations `000001`–`000008` against the production database and verify
   slug backfill and adviser-availability defaults.
3. Run the deployed acceptance checks for R1–R16 (browser pass for viewer, themes,
   dashboard, notifications, and upload polling).
4. Dry-run `acadex:upgrade-document-encryption`, verify the separate full backup
   and available disk space, then convert legacy files and confirm representative
   authenticated range requests before measuring production open times.
5. Start Redis with the Compose service and switch production queue to
   `redis` once healthy; do the same for Ollama/Turnstile/Google if enabled.

## 2026-11-05 — Google OAuth environment preparation

Added ignored local slots for the production Google Web client ID: EduArchive-Frontend-React/.env.production.local contains VITE_API_BASE_URL=/api/v1 and blank VITE_GOOGLE_CLIENT_ID; the existing ignored Laravel .env now has a blank GOOGLE_CLIENT_ID. The public Client ID is set in both local frontend env files and the local Laravel .env; the client secret was not copied. The frontend files are local-only and Vite reads them at build/start time. Not deployed or live-verified.

## 2026-11-05 — Local Google sign-in test setup

Saved the production website and localhost JavaScript origins on the existing Web client. Audience is External, but publishing remains Testing and Google disables Publish app until Branding is complete; homepage/privacy/terms URLs are still missing and policy pages are not hosted. Added the missing Google sign-in button/session handling to Login.jsx. Local frontend is running at http://localhost:5173 and Laravel at http://localhost:8010; login/register pages and registration challenge returned HTTP 200, and the Google buttons render. Frontend tests: 15 passed; ESLint: 0 errors, 33 warnings. No Google account sign-in or account creation was performed; production auth remains undeployed and unverified.

## 2026-11-05 — Public policy pages prepared locally

Added public /privacy and /terms React routes and linked both from the landing-page footer. The drafts describe observed Google identity fields, account and academic metadata, capstone visibility, notifications, document OCR/optional local AI processing, provider categories, the current Sydney hosting record, and user requests. Vite production build passed, frontend tests passed (15), lint passed with 0 errors and 33 existing warnings. Pages have not been deployed or entered in Google Branding. Before publication, the project owner must confirm the legally responsible controller/contact, retention obligations, provider/location details, and institutional terms.

## 2026-11-05 — Existing password account Google linking

Fixed Google sign-in for existing password accounts with an explicit account-linking step. An account owner signs in with their Acadex password, opens their profile, confirms that password again, and links a server-verified Google identity whose verified email matches the Acadex account. Unique Google subjects and audit logging prevent cross-account linking; after linking, the existing Google login button signs in normally. The login error now directs users to this flow. Link controls are available on admin, faculty, student, and visitor profiles.

Local verification: guarded disposable-MySQL auth tests passed (2 tests, 10 assertions), PHP syntax checks passed, frontend tests passed (15), ESLint passed with no errors, and Vite production build passed. Real Google credentials were not used in tests. Not deployed; live Google login remains unverified until deployment and actual account linking.

## 2026-11-05 — One-click Google login for verified existing accounts

Adjusted the Google login flow so a successful Google ID token automatically links to an existing Acadex password account when both systems confirm the same email address and Acadex had already verified that email. The first Google sign-in now completes login rather than asking the user to password-link in Profile. Unverified Acadex accounts still must complete email verification; Google identity conflicts, account approval, lock, and archive rules remain enforced. Explicit password-confirmed linking is retained as a profile option.

Local verification: focused Google authentication tests passed (4 tests, 21 assertions) using the guarded disposable database, covering automatic linking, unverified-email rejection, explicit linking, and mismatched credentials. PHP syntax and route checks passed. No real Google token was used, and this code is not deployed; production behavior changes only after deployment.

## 2026-11-05 — Local Google login schema repair

The running local code failed with `Unknown column google_id` because the Google identity migration had not been applied to the configured `acadex_local` database. Confirmed `.env` targets exactly `acadex_local`, verified the migration was pending, then applied only `2026_11_05_000007_add_google_id_to_users.php`. `migrate:status` reports it ran and `Schema::hasColumn('users', 'google_id')` is true. This adds a nullable unique field and preserved existing user rows. Other November 5 feature migrations remain pending. This is local verification only; no production database was accessed or changed.

## 2026-11-05 — Production deployment access check

The user authorized deployment with explicit protection of existing data. Confirmed the release branch commit is `4b21b2a`, DNS for `veload.site` currently resolves to the existing public host, and a direct HTTPS probe returns 200. Strict-host-key SSH attempts to both the DNS host and configured SSH alias timed out on port 22. The Chrome computer-use layer could not identify the active tab URL confidently and stopped, so no browser-console actions were taken. AWS CLI and Python SDK are unavailable on this workstation. No production host was reached, no backup was made or verified in this attempt, and no production command, migration, configuration, or data was changed. Deployment is pending a working authorized SSH or AWS Systems Manager access path; do not broaden public SSH ingress or switch targets based only on the timeout.

## 2026-11-05 — Feature release and follow-up

Deployed source `309e37a` to `/srv/acadex-staging/releases/acadex-20261105-309e37a` after four integrity-checked private backup archives in `/var/backups/acadex/release-20261105-309e37a`. Original values in 17 non-transient tables, six accounts, one capstone, 30 private file hashes and APP_KEY matched before reopening. Eight forward migrations applied. A systemd worker processes the existing database queue; Redis/Docker and Ollama are not enabled. Public pages, CSRF/challenge endpoints and authenticated document metadata pass. A controlled upload moved queued to completed; its owned staged file/reference/notification and verification tokens were removed without saving a capstone.

The referenced 97 MB PDF was converted with a byte-identical encrypted backup. Streaming hashes confirm decrypted content is identical; the other original files remain identical, account/capstone counts are unchanged and no verification tokens remain. Authenticated range response: 206, 1,024 bytes in about 0.06 s. Google branding uses the live home/privacy/terms URLs; audience now reads External / In production.

Live browser inspection found two remaining viewer costs: Apache stripped the initial Content-Length, and all 176 page text/annotation components mounted at once. The trusted Laravel front controller now retains its calculated length through Apache; a portable vhost example is included. The follow-up mounts pages near the viewport, retains visited text/links and provides an explicit all-page text option for browser Find. Registration Step 2 verifies the Google token before displaying its email, hides manual verification for that choice, skips the password page, and uses the main action to submit after profile completion. Final registration verifies the token again; existing accounts are rejected without linking during signup.

Follow-up local checks: 17 authentication tests / 93 assertions on the guarded disposable schema, 15 frontend tests, quiet lint and production build passed. Preparing a second immutable release; follow-up browser changes are not yet deployed at this checkpoint.

## 2026-11-05 — Published source checkpoint

The serving application is now `/srv/acadex-staging/releases/acadex-20261105-final`, source `ed4bb6d`. The queue unit points to that backend and uses the database driver. The Google Step 2 follow-up is deployed; Google Console was observed as External / In production. Actual new-account Google signup, notification email delivery, and every role/mobile acceptance flow are not certified by that setting alone.

The viewer now starts with explicit authenticated 1 MiB requests and mounts nearby pages. Optional qpdf linearization creates a separate encrypted viewing preview; it retains the original for downloads. The deployed preview was checked for valid linearization and equal page count. Full plaintext hashes of the backed-up original and its V2 storage conversion matched; original account/capstone counts and APP_KEY were preserved. The preview adds a derived private file, rather than overwriting the source.

**Remaining critical issue:** on the existing large scanned PDF, PDF.js still requests many trailing ranges before exposing the first page. Individual range responses and valid preview bytes do not establish acceptable end-to-end opening time. Do not mark R1 complete or promise that a Git pull resolves the reported delay. This source checkpoint is published so the client's maintainer has the latest implementation and its limitations.

Fresh local checks before publication: 15 frontend tests passed; quiet lint and production build passed (829 modules). Guarded disposable-MySQL checks passed: `AuthenticationSecurityTest` 17 tests / 93 assertions; `DocumentAuthorizationTest` plus `PdfPreviewFallbackTest` 5 tests / 287 assertions. No test suite ran against production.

Publication cleanup: live checks still report six users and one capstone, no pending/failed jobs, and no owned verification tokens. Apache, PHP-FPM, MySQL, the database queue worker and OCR service were active. Removed the temporary range diagnostic CustomLog and temporary credential files. The explicitly approved temporary workstation-only SSH rule was removed in AWS; the four pre-existing inbound rules remain. These checks establish operational cleanup, not completion of the outstanding PDF performance criterion.

## 2026-11-06 — Existing local checkout setup after pull

User requested setup of the pulled updates, including the database and other
runtime requirements. Initial worktree was clean on `release/ui-refinement`,
HEAD `9d829d6`; `git fetch origin` and upstream comparison reported 0 ahead / 0
behind. No merge, reset, production connection or deployment was performed.

This workstation is `C:\Users\Josephh\Desktop\EduArchive`. Its private `.env`
identifies `APP_ENV=local`, loopback MySQL and `EduArchiveDB`, rather than the
previous workstation's `acadex_local`. Verified the active database before
changes. A complete SQL dump, private environment copy, original table-row
snapshot, and 113 storage-file copies (689,586,104 bytes) were saved under ignored
`.local/local-update-backup-20261106-142135`. Dump completion/hash and all copied
file hashes were checked; a restore rehearsal was not performed.

Applied the 12 pending forward migrations after the backup, bringing the local
schema from 27 to 39 recorded migrations. `migrate:status` reports all `Ran`.
Original row values were compared after migration (allowing only the documented
legacy approval backfill); all five users, ten capstones, existing passwords,
private `.env`/APP_KEY and original stored-file hashes were preserved. No seeder,
fresh migration, document conversion or key generation was run. Cleared only
compiled config, route and view caches.

Frontend `npm.cmd ci` completed after stopping this checkout's Vite process,
which had locked a native package. Fifteen frontend tests, quiet lint and the
production build passed (829 modules). The build used process-local
`VITE_API_BASE_URL=/api/v1`; no production environment file was copied.

Local launcher now applies 128 MiB upload / 140 MiB POST / 512 MiB memory limits
and a 600-second queue worker timeout with three retries, matching the current
database queue retry interval of 660 seconds. Updated `.env.example` with the
registration, optional Turnstile/Ollama and background extraction settings.
PowerShell parser and `git diff --check` passed at the launcher checkpoint.

Composer dependency installation is complete. The large Google services download
needed a process-local 1,800-second socket timeout. Its 38,363-entry archive and
subsequent optimized class scan were unusually slow on this workstation. After
all packages were installed, stopped the optimization pass and completed a normal
development autoloader/package-discovery pass using a temporary ignored Composer
manifest with optimization disabled and an identical copy of the lockfile. Both
temporary files were removed; the original `composer.json` and lockfile hashes
are unchanged. Composer reports nothing left to install/update/remove, Laravel
package discovery succeeds, and all PHP platform requirements pass.

Local runtime checks pass for the migrated columns, citation table, existing
capstone slug backfill, Google SDK loading, and database queue configuration
(660-second retry interval). Native Ghostscript/Tesseract OCR recognized a
synthetic document without using any database or existing archive document.
SMTP configuration was preserved; delivery was not exercised. Google client ID
and Turnstile keys are unset, so those integrations are not enabled locally.
The separate PaddleOCR environment and qpdf are absent; Redis/Ollama remain
optional and disabled. No database-backed test suite was run against the local
application database. Production status and all November 5 limitations remain
unchanged.

**Local setup complete.** Started the API, database queue worker and frontend
with `start-local.ps1 -WithoutOcr`; all three process identities match their
launcher receipts and remain running. Queue/frontend stderr logs are empty.
Repeating the launcher reused all three existing processes. The launcher now
prints the native OCR fallback instead of a PaddleOCR URL in this mode.

HTTP smoke checks: frontend browser navigation and its transformed JavaScript
entry returned 200; Laravel `/up` returned 200; Sanctum CSRF-cookie returned 204;
anonymous `/api/v1/user` returned 401; registration challenge returned a signed
token with a four-second minimum and Turnstile disabled. An initial frontend
probe used `Accept: application/json`, causing Vite's expected 404; the corrected
browser-navigation probe (`Accept: text/html`) passed. No login, signup, real
document upload, notification email or end-to-end role acceptance was performed.
After dependencies finished, original row/environment/file preservation checks
passed again (five users, ten capstones, 113 original stored files). PowerShell
syntax and Git whitespace checks passed; temporary Composer manifests/locks
were removed and the dependency lockfiles remain unchanged.

## 2026-11-06 — Cancel/minimize uploads and floating progress (local)

Implemented the requested Upload Capstone PDF controls for admin, faculty and
student. The shared picker starts an app-owned transfer; the activity modal
provides Cancel upload and Close/X. Close/Escape/backdrop minimizes it to a
floating upload icon with measured byte percentage, filename and current state.
The request survives library unmounts and internal page navigation. Reopening
restores the same progress and elapsed time. After upload, the floating activity
polls queued/processing/completed/failed status and exposes Review details using
the existing upload reference, without redirecting the user on completion.

Cancel aborts the browser request; late responses/progress cannot overwrite a
retry. The UI states that a request cancelled after bytes were sent may still
finish server processing. Logout/account change clears the in-memory activity
and cancels owned requests/polling. One upload is tracked at a time; reopening
the picker while an activity exists reopens it instead of sending a duplicate.
The review page shares status updates and resumes background polling on exit.
No file/metadata is persisted in browser storage; full refresh/tab close is not
a resumable upload operation. Backend, database and production are unchanged.

Local verification at this checkpoint: 23 frontend tests passed (eight new
upload-lifecycle tests covering minimize/unsubscribe, cancellation races, retry,
duplicate prevention, polling, review ownership, expiry and account cleanup).
Quiet ESLint and production build passed (833 modules). Headless Chrome with
intercepted synthetic authentication/upload/status responses verified actual
browser request cancellation, minimize/reopen, navigation to a different page,
background completion without redirect and review handoff for all three roles.
Light desktop and dark 390px mobile views were inspected. A mock category
response initially used the wrong shape and caused a review-page crash; corrected
the test mock to match the existing array API, with no category source change.
Final verification completed November 7 (Asia/Manila): all three roles passed
Tab focus containment, Escape minimization and the full browser flow. The dark
390px mobile floating control and reopened activity dialog were checked. Browser
probes never sent synthetic users/files to Laravel or used the application DB.
Not deployed; real large-transfer and deployed end-to-end acceptance remain
separate from these local checks.

### Duplicate title guard (2026-11-07)

Added a duplicate-title check that blocks Step 2 → Step 3 progression in the
capstone upload wizard. Backend: new `GET /capstones/check-title?title=…`
endpoint performs a case-insensitive lookup against the capstones table.
Frontend: `ReviewExtractedDataPage.jsx` calls this endpoint when the user
clicks "Next". If the title already exists the button shows a spinner, the
title card turns red with an error message, and navigation is blocked. Editing
the title clears the error. The backend `store()` unique rule remains as a
second safety net. Route is registered once in the shared authenticated group
so all roles (admin, faculty, student) use the same endpoint. Not deployed.

### Adviser Pool removal (2026-11-07)

Removed the admin Adviser Pool management page and all adviser-related features
per user request. Changes (local only, not deployed):

**Deleted files:**
- `src/pages/admin/AdminAdvisers.jsx` — admin adviser pool page component
- `app/Http/Controllers/Api/V1/AdviserController.php` — backend adviser controller

**Backend:**
- `routes/api.php` — removed adviser routes (`GET /advisers`, `PUT /advisers/{user}/availability`),
  removed `GET /capstones/faculty-list` route, removed `AdviserController` import
- `CapstoneController.php` — `getFacultyList()` method removed (done in prior session)

**Frontend — routes & nav:**
- `App.jsx` — removed `AdminAdvisers` lazy import and `/admin/advisers` route
- `AdminLayout.jsx` — removed "Adviser Pool" nav item

**Frontend — API layer:**
- `api/admin.js` — removed `getFacultyList`, `getAdvisers`, `setAdviserAvailability` exports

**Frontend — upload Step 3 (Additional Info pages):**
- `AdminCapstoneAdditionalInfoPage.jsx` — removed adviser state, search, payload field, and JSX
- `CapstoneAdditionalInfoPage.jsx` (faculty) — removed adviser SectionCard, search callback,
  state variables, useEffect, and summary row; restructured Adviser+Summary grid to Summary-only
- `StudentCapstoneAdditionalInfoPage.jsx` — same removals as faculty page

**Frontend — edit modal:**
- `EditCapstoneModal.jsx` — removed adviser state, search callback, useEffect, `getFacultyList`
  import, `HiOutlineUser` import, `adviser_id` from update payload, and adviser JSX section

**Preserved (read-only):**
- Adviser name display on capstone detail/listing pages (CapstoneMainPage, visitor pages,
  FacultyAssignedCapstones, etc.) — these show existing `adviser_id` data from the DB
- Adviser filter on published/visitor capstone browse pages (PublishedCapstoneController,
  VisitorCapstoneController) — read-only filter for existing data
- DB columns (`adviser_id` on capstones, `adviser_available` on users) — left dormant
- Backend `store()` validation for `adviser_id` (nullable) — harmless, accepts null

**Verification:** `npx vite build` succeeds with no errors (`✓ built in 20.06s`).
Backend route list no longer contains adviser management or faculty-list endpoints.


## 2026-11-07 — Layouts, upload recovery and reference counting (local verification complete)

Preserved the existing dirty worktree, including adviser removal and previous
UI/upload work. Added responsive My Uploads defaults, Pending Approvals tables
and switchers, four-column desktop own-upload/approval cards, and category
visibility/grid controls in each role's repository page. New resumable transfer
API saves encrypted 2 MiB chunks with owner checks, quota reservations, locked
offset acknowledgement, idempotent finalization and a stable staged upload.
Browser IndexedDB saves the selected file and activity for same-browser reload
recovery; extraction reconnects to the existing queued job. Stable PDF upload
references serialize final submission and return the original capstone on replay.

Citation totals now query distinct saved inbound reference relationships plus
copy events only. Copy events carry a unique per-user UUID for retry protection.
APA/MLA remain; IEEE generation and controls are removed. Ranking queries exclude
zero views and zero reference totals. Existing generation events remain stored
but are excluded from the new total.

Verification checkpoint: new guarded disposable local MySQL schema, separate
schema-restricted test identity and random test APP_KEY; no tests target the
application database. Both forward migrations applied there. Focused new tests
passed (5 tests / 81 assertions); regression run including ownership, upload lock,
approval, document access and visitor access passed (26 tests / 511 assertions).
Frontend tests passed (30); production build passed with process-local
VITE_API_BASE_URL=/api/v1. Browser cross-role checks are still running. An existing
conditional-hook error in the review page was corrected by moving its title-check
state hooks before the early return; final lint is pending. No application DB
migration, production connection or deployment has occurred in this task.


### Final local verification — November 7, 2026

Implementation and local verification completed for the six layout/upload/count
requests above. [Detailed behavior, runtime preparation and evidence](ui/2026-11-07-layout-upload-reference-update.md).

- Frontend production build passed (843 modules), 32 frontend tests passed and
  quiet ESLint passed after the review-page hook ordering correction.
- Guarded disposable MySQL regression: **28 tests / 549 assertions passed**.
  Includes a committed real database-queue delivery, independent worker
  completion with deterministic extraction, repeated finalization/submission,
  copy-event retries, relationship deduplication/self-link exclusion, ranking
  thresholds, and existing document/visitor/approval/upload-lock protections.
- Forced failure after staging rolls back the DB record and deletes the unclaimed
  encrypted PDF; retry uses confirmed chunks and leaves one final document.
- Chrome synthetic-API browser checks passed across admin/faculty/student/visitor:
  desktop/mobile defaults, all category/navigation grid combinations, no mobile
  page overflow, upload/extraction reload recovery for uploading roles, clipboard
  success/failure, citation opening/format/download without counts, and no IEEE.
  Browser probes did not send data to the application DB. Screenshots inspected.
- Chatbot Most Referenced now uses the same copy-plus-relationship total; zero-view
  analytics/advisory results are excluded. Dashboard wording is now Most Cited.
- PHP syntax passed for 18 changed/new PHP files; Git whitespace checks passed.

The new migrations were applied only in the disposable schema. The existing local
application schema and production were not migrated or deployed. Before serving
the update, a maintainer must verify a target backup, apply both forward migrations,
keep the queue worker running and enable the Laravel scheduler for hourly expired
chunk cleanup. Recovery is within the same browser/origin/account and requires
site storage; interrupted transfers expire after 24 hours. Real 128 MiB transfers,
OCR quality/performance and deployed end-to-end behavior remain unverified by this
local synthetic suite. Production APP_KEY, accounts and original private documents
were not accessed or changed. Existing dirty worktree changes are retained.


## 2026-11-07 — Runtime schema repair and interface controls (local verification complete)

Confirmed local configured MySQL resolves to `eduarchivedb`; upload_transfers was
missing and both November 7 migrations were pending. Faculty role, faculty_program,
approval and verified-email columns were present. Fresh private backup verified
under ignored `.local/local-update-backup-20261107-082948`: SQL completion/hash,
environment and 117 stored-file copies. Applied the two pending forward migrations
through the guarded local maintenance runner. Original row values/passwords,
APP_KEY/environment and all original file hashes matched afterward; five users
and ten capstones retained. No production connection or deployment occurred.

Faculty frontend previously stored backend field errors without exposing errors
from a hidden earlier step. Added field-to-step routing and an always-visible
validation message, matching role-specific payloads and ID/program checks. Backend
faculty/manual/Google tests pass in the guarded disposable schema (27 tests / 250
assertions including auth and upload recovery at this checkpoint). Faculty retains
verification and approval gates. A generic database API failure response and
frontend SQL/HTML filtering protect readable upload failures.

Shared category heading/icon control, shared approval icon actions and four-column
Assigned Capstones grid are implemented. Frontend tests pass (36); initial quiet
lint passes. Browser interface/registration and real isolated HTTP upload/extraction
verification are still pending at this checkpoint.


### Final local verification — runtime repair and interface controls

All five requested changes are implemented and locally verified. See
[the detailed repair/evidence record](ui/2026-11-07-runtime-registration-controls.md).

The configured local `eduarchivedb` now contains both November 7 migrations and
all required transfer columns. Immediate post-migration preservation passed;
final hashes match the original environment/APP_KEY and all 117 original files.
Five existing accounts and ten capstones remain. Existing rows match except an
account's activity/update timestamps, which were retained.

Faculty validation errors now open their associated step and show a global alert.
A real browser exposed and verified a second fix: Continue prevents its default
click action so switching into a submit-button step cannot submit retained
credentials automatically. Faculty program-only registration, code verification,
duplicate-username recovery, explicit submission and approval success message
passed through a separate HTTP API. Approval and verification rules remain intact.

Category icon/heading controls passed in all four panels; approval icon buttons
passed preview/confirmation/cancel checks in Admin/Faculty table and card layouts.
Assigned Capstones passed four/two/one-column desktop/tablet/mobile checks.

An actual roughly 5 MiB known synthetic PDF passed server encryption, lost first
chunk acknowledgement, refresh resume at the confirmed 2 MiB offset, real queue
extraction, queued/processing refresh and expected-title restoration. One transfer/
upload, no duplicate capstone and no pending/failed job remained. The isolated
helper, its accounts/upload records/files and cached test configuration were
cleaned up. Full 128 MiB transfers and production behavior remain separate.

Final checks: 36 frontend tests, quiet lint and production build (846 modules)
passed; guarded disposable-MySQL regression passed **49 tests / 686 assertions**.
Changed PHP syntax and Git whitespace checks passed. Nothing staged or deployed.

Verification correction: an initial HTTP helper resolved a Windows absolute cache
path incorrectly and created one owned synthetic email-verification row in the
local application DB. Stopped it, removed only that row, verified no marker remains,
and added an actual HTTP database/storage/mail-environment assertion before further
mutations. Subsequent browser mutations and all database-backed test suites used
the schema-restricted disposable target. Do not describe the initial attempt as
isolated or claim that account activity timestamps stayed byte-identical.

## 2026-11-05 evening — Client PDF timeout verification and frontend release

Reviewed the client's screenshot and the two local viewer modifications. The screenshot text originates from the hook's overall timer, not the per-range timeout; slow networking alone was an unproven explanation. Found the first request still at 1 MiB, missing timeout coverage while waiting for response headers, percentage-based timer resets, and a timer that could rearm after successful loading. Added actual-byte activity, 64 KiB requests, a four-request concurrency limit, header/body stall detection, and ready/error protection including late PDF.js progress.

Local verification: 23 tests passed, including slow continuous transfers beyond 180 seconds, header/body stalls, retry, cancellation, concurrency, unchanged rounded progress, and readiness protection. Quiet lint and the production build passed (829 modules). No database test ran against production.

Deployed frontend `/srv/acadex-staging/frontend-releases/acadex-pdf-stall-20261105-v2/dist` after fresh archive-checked private database/environment/storage/frontend/routing backups at `/var/backups/acadex/pdf-stall-20261105`. The public index matches the release and the 74 packaged file hashes were verified. Backend remains `/srv/acadex-staging/releases/acadex-20261105-final`; no migrations, key/configuration replacement, storage rewrite, or queue/OCR restart occurred. Source changes and tests remain uncommitted locally.

Current production has six users, two capstones and 35 storage files. Private file hashes and APP_KEY matched the pre-release baseline. An intervening login changed users/login_audits before the switch; do not describe all database rows as byte-identical. The release itself does not write application records. Browser acceptance uses the existing authorized student session, so ordinary view analytics can change.

Final live verification, completed before 10:30 pm Asia/Manila: both the 176-page and 171-page capstones render through View Full Page and fullscreen, with no alert. Final pages render for both documents in fullscreen, and the 171-page document's last page also renders inline. The 176-page document remains open beyond the old overall-timeout period without reverting to an error. These are observations in the authorized Chrome student session, not a physical-client-device certificate. Phone viewport emulation did not produce a verified phone-size layout, so no mobile acceptance claim is made.

Final operational checks: all 35 baseline storage hashes and APP_KEY match; six users and two capstones remain; no owned diagnostic tokens, pending jobs or failed jobs remain. Public index and PDF bundle hashes match the final release; health/login/register return 200 and anonymous JSON user access returns 401. Apache, PHP-FPM, MySQL, database queue and OCR services are active. All three private backup archive checksums pass. Removed the temporary workstation-only SSH rule and observed AWS success plus the original four inbound rule IDs/values. Previous releases/assets and backups remain available. See [the hotfix report](handoff/PDF_VIEWER_HOTFIX_2026-11-05.md).

## 2026-11-07 — Production redeployment

Deployed client source commit `a6025cf5a782b37dad9260352794df8b39f36473` and
the retained local PDF viewer fixes. The frontend serves the newly built artifact
from `/srv/acadex-staging/frontend-releases/acadex-20261107-a6025cf/dist`, while
the backend serves from `/srv/acadex-staging/releases/acadex-20261107-a6025cf`.
Previous backend/frontend releases and hashed browser assets were preserved.

Before changing the application or schema, created and verified the private
recovery set `/var/backups/acadex/redeploy-20261107T133643Z`. It contains the
production SQL dump, active code/build, environment and application key,
persistent storage, relevant service/configuration files, OCR package inventory,
and preservation manifests. The SQL gzip, runtime archive, and backup checksums
passed.

Applied exactly two pending additive migrations:
`2026_11_07_000001_add_citation_copy_idempotency` and
`2026_11_07_000002_create_upload_transfers`. Production reports no pending
migrations. Database counts for users, capstones, document uploads, jobs, failed
jobs and citation events match the pre-release baseline. The new upload-transfer
table is empty. The original private environment checksum and all 285 storage
file hashes match the backup.

Updated the active Apache frontend/backend paths, restarted the queue worker on
the new backend, and enabled `acadex-scheduler.service` to run the hourly
expired-transfer cleanup. Apache, PHP-FPM, MySQL, queue, scheduler and OCR are
active; OCR stayed on its existing release and was not restarted. At the user's
request, retained the additional SSH source rule `143.44.156.189/32` alongside
the two original `/32` rules.

HTTPS `/`, `/login` and `/register` return 200; the live root and entry JS/CSS
hashes match the release; unauthenticated JSON `/api/v1/user` returns 401. The
four resumable-transfer routes and hourly schedule are registered. Production
login, role actions, uploads and real document workflows were not replayed; the
client had already tested feature workflows locally. See the
[production release record](handoff/PRODUCTION_RELEASE_2026-11-07.md).


## 2026-11-09 — Production release of UI refinement, modular extraction, and disk space remediation

Deployed unified release `7933e7f` to production (`https://veload.site`).

Key resolutions:
1. **EC2 Storage Exhaustion Remediated:** Pruned 13.6 GB of redundant legacy snapshot copies of encrypted storage from `/var/backups/acadex/` while preserving the live persistent storage (`/srv/acadex-staging/shared/storage`) and active database dumps. Available disk space increased from 1.7 GB (95% full) to 10 GB (65% used). Added `MIN_FREE_STORAGE_BYTES=1073741824` to `laravel.env` to prevent spurious storage locks.
2. **Admin Dashboard Capstones by Year Chart Fixed:** Aligned `AdminDashboardController::uploadYearSeries` and `AdminDashboard.jsx` to group by the capstone record's recorded `year` metadata instead of upload date (`YEAR(created_at)`). The bar chart now displays the exact repository years (2023: 18, 2024: 12, 2025: 1) matching the Capstone Library filter.
3. **Faculty Account Role Corrected:** Promoted `cjjas127@gmail.com` (Jamaica Rhea Bautista) from student (`role_id = 3`) to faculty (`role_id = 4`), allowing immediate access to the Faculty Adviser Dashboard.
4. **All System Services Unified:** Updated Apache virtualhosts and systemd service units (`acadex-queue.service`, `acadex-scheduler.service`, `acadex-ocr.service`) to run from the active release `/srv/acadex-staging/releases/acadex-20261109-7933e7f/EduArchive-Backend-Laravel`. All 5 services are active and verified healthy.
