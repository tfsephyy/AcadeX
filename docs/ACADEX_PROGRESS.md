# AcadeX implementation progress

Last updated: 2026-11-05 (implementation reviewed and corrected locally; deployment pending production access).
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
