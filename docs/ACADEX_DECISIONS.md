# AcadeX architectural decisions

Append-only working log. Each entry records context, decision, and consequences.
Read with [ACADEX_REQUIREMENTS.md](ACADEX_REQUIREMENTS.md) and
[ACADEX_PROGRESS.md](ACADEX_PROGRESS.md).

## D-001 — Capstone metadata and PDF bytes are independent requests (2026-11-05)

**Context:** the admin/student/visitor detail pages originally awaited the PDF
before clearing the page-level loading state. The first local change separated
metadata and PDF loading, but the review found the viewer still fetched one full
Blob. The backend also made two full passes over V1 encrypted files: authenticate
the complete document, then decrypt it again for the response.

**Decision:** keep `GET /capstones/{id}` as the metadata request. Render the page as
soon as it succeeds. Fetch the PDF separately through PDF.js with authenticated
byte ranges aligned to the server's 1 MiB independently authenticated blocks. Do
not await view recording. Keep V1/legacy readers; provide an explicit encrypted
backup and verified conversion command for existing files.

**Consequences:** the page is usable while the document opens, and PDF failures no
longer blank the record. Each returned V2 block is authenticated before any of its
plaintext is released. Full-document downloads and extraction still verify every
block. Existing files remain compatible and do not speed up until converted.

## D-002 — Slug compatibility, not replacement (2026-11-05)

**Context:** existing links, notifications, and stored frontend state use numeric IDs.

**Decision:** add a unique `slug` column and backfill it. Route binding accepts a
numeric ID or a slug. New links use slugs. No route or ID is removed.

**Consequences:** old bookmarks keep working; duplicate titles receive suffixes.
Slug generation lives in one backend service and one frontend URL helper, separate
from citation code.

## D-003 — Redis queue via Docker, database fallback (2026-11-05)

**Context:** the host is a single 2 GiB `t3.small`; Redis and workers are not
currently installed. The application already supports `QUEUE_CONNECTION=database`.

**Decision:** ship a Docker Compose service for Redis with persistent storage and a
queue-worker systemd example. Production `QUEUE_CONNECTION` becomes `redis` only
after the service and worker are confirmed healthy. Local development may use the
database queue. Jobs must be idempotent under either driver.

**Consequences:** processing can move off the request path immediately; Redis is an
operational dependency for production once enabled. Queue workers are not started
automatically by this repository.

## D-004 — Ollama is optional and grounded (2026-11-05)

**Context:** the hosting baseline cannot run PaddleOCR and a local LLM concurrently
with comfortable headroom. Paid AI APIs are prohibited by the request.

**Decision:** `OLLAMA_URL`/`OLLAMA_MODEL` are opt-in. When unset or unhealthy,
deterministic extraction is used. When enabled, Ollama only cleans/organizes
already-extracted text; every returned field is validated against the source and
discarded if ungrounded. Per-call timeouts and a failure cache prevent repeated
slow calls.

**Consequences:** no mandatory new paid service. Extraction quality can improve on
capable hosts without making the archive depend on it.

## D-005 — Google accounts are linked only by verified Google identity (2026-11-05)

**Context:** auto-linking an existing local account by email alone enables takeover
when the local account was not verified or was created with a different identity.

**Decision:** a Google callback may sign in an existing account only when
`google_id` matches. If the email already belongs to a non-Google account, the
request is refused with guidance to sign in/reset instead of linking. New Google
accounts are created with `email_verified_at` set, a random unusable password, and
the same approval state as manual registration.

**Consequences:** no duplicate accounts and no silent linking. Users who registered
manually can still use password login; a future explicit "link Google" flow would
require an authenticated confirmation step.

## D-006 — Citation counts are explicitly "citation generations" (2026-11-05)

**Context:** the application cannot observe citations in external papers.

**Decision:** record copy/download actions from the citation generator in
`citation_events` and expose the aggregate as "citation generations". Never label it
as verified external citations.

**Consequences:** faculty/admin "most cited" is measurable and honestly scoped.

## D-007 — Existing encrypted documents convert only after backup (2026-11-05)

**Context:** new V2 uploads can serve authenticated PDF ranges, while existing V1
secretstream and Laravel-encrypted files cannot do random access without changing
their stored format. The client requires the production APP_KEY, private files,
and database references to remain intact.

**Decision:** never rewrite legacy files as a side effect of viewing or deployment.
The explicit `acadex:upgrade-document-encryption` command requires confirmation,
checks disk headroom, saves and hashes an exact encrypted copy, streams conversion
to a same-directory temporary file, verifies it, atomically replaces the source,
and writes a private manifest. It rejects paths outside private local storage.

**Consequences:** compatibility is retained, but current production files keep the
old open latency until an operator runs the conversion after a verified backup.
The command has only been reviewed locally; it has not run on production.

## D-008 — Explicit linking for existing password accounts (2026-11-05)

**Context:** users who first registered with email/password need to use Google
later, but linking solely because Google returns the same email would bypass
explicit account confirmation.

**Decision:** an already authenticated user must confirm their current Acadex
password, present a server-verified Google ID token, and use the same verified
email before the Google subject can be linked. Google subjects remain unique. A
successful link is audited, and future Google sign-ins require that stored subject.

**Consequences:** existing password accounts can add Google safely from their
profile and then use the normal Google sign-in button. Linking and sign-in code
are implemented and locally tested; deployment is still required for the live
site.

## D-009 — Automatic linking for previously verified email accounts (2026-11-05)

**Context:** requiring every existing password user to visit Profile and enter
their password made Google sign-in fail to provide the expected one-click login.

**Decision:** on Google sign-in, automatically link the Google subject when its
server-verified email exactly matches the email of an existing Acadex account
whose email is already verified. Preserve the existing approval, lock, archive,
unique-subject, and subject-mismatch checks. Do not auto-link an Acadex account
with an unverified email; it must complete the existing verification process.
This supersedes D-005's refusal to link a verified email conflict and D-008's
requirement to confirm the password for an already verified account.

**Consequences:** users with already verified matching email addresses can sign
in with Google immediately; their first successful Google login binds that
Google identity. Explicit profile linking remains available as a password
confirmed option. Focused security tests pass locally; production must be
deployed separately.

## D-010 — Derived encrypted viewing previews (2026-11-05)

Prepare an optional qpdf-linearized copy during background upload processing and
with `acadex:prepare-pdf-previews` for existing capstones. Store it encrypted under
a source-path/size/modification-time cache key, use it only for authorized viewing,
and retain the uploaded original for download. Missing qpdf, insufficient disk,
or preparation errors fall back to the original. Private plaintext temporaries
are removed after processing. Deployment must install qpdf separately; this is
not a Composer dependency. Preview validity and page counts were checked on the
live document, but PDF.js first-page latency remains unresolved at publication.

## D-011 — Existing local checkout setup after pull (2026-11-06)

The Josephh workstation's private environment identifies a local loopback MySQL
database named `EduArchiveDB`, containing existing users and capstones. Preserve
that environment and database rather than substituting the previous workstation's
`acadex_local` schema. Install dependencies from the current locks and apply only
pending forward migrations after a verified private database/environment/storage
backup. The local launcher uses the database queue with a 600-second worker
timeout and the configured 660-second retry interval, and explicit 128 MiB upload
limits. External integrations still require their own configuration; local setup
does not authorize or establish a production deployment.

The local dependency installation uses the standard development autoloader after
the large Google SDK's optimized scan proved excessively slow. A temporary
ignored Composer manifest disabled optimization for that installation only;
the original project manifest and lockfile were retained byte-for-byte and the
temporary files were removed. This local workaround does not change the release
configuration or installed dependency versions.

## D-012 — App-owned upload activity and explicit cancellation (2026-11-06)

Upload request ownership moves from the route-mounted modal hook to one
app-level provider under AuthProvider and outside the routed Suspense boundary.
The admin/faculty/student pickers share one modal. Closing or changing pages
removes only its presentation; explicit Cancel aborts the transfer. A generation
guard prevents late progress/responses from a cancelled request overwriting a
retry or a different account's activity. In-memory state is cleared on logout,
account change or app teardown, and no filenames/files are persisted in browser
storage.

One floating control shows transfer percentage only when measured totals exist,
and queued/processing/completed/failed status after the server returns a stable
upload ID. Polling uses the existing owner-protected status endpoint, pauses
while that upload's review page owns polling, and backs off on transient errors.
Completion preserves the current route; Review details opens the retained
reference and extracted data. Cancellation after the file was sent is labelled
as cancelling the request, since server-side storage/processing may already be
running. This change adds no server cancellation endpoint or schema migration.

## D-013 — Browser-local PDF progress and shared notifications (2026-11-07)

Store only an integer PDF page in localStorage under a versioned key containing
the canonical capstone ID, original/IMRAD type and account ID (or visitor scope).
Use canonical IDs so numeric and slug bookmarks share progress. Restore only
after page placeholders exist; observe the active viewer's scroll container,
debounce writes and flush on hiding/navigation. Capture page selection during
scroll rather than measuring DOM after it has been removed or replaced. Mount a
separate reader for each canonical document/type when switching PDFs. The hidden inline viewer stops
writing while fullscreen owns progress. Storage denial must not prevent viewing.
Progress is local to a browser, not server-synchronized; no documents, titles,
tokens or account credentials are stored in these entries.

Reuse the Admin workspace shell for Faculty so profile, notification bell,
popup and read/unread controls stay consistent. Keep existing API recipient
scoping, role-specific navigation and the direct Faculty notification page.
Navigation and copyright wording are display-only; routes, permissions and
stored copyright values remain unchanged. No new schema migration is required.


## D-014 — Resumable transfers and copy/reference totals (2026-11-07)

Supersedes D-012's in-memory-only/full-refresh boundary and D-006's generation
metric. New upload pickers use owner-scoped UUID transfers with encrypted 2 MiB
chunks. Server row locks govern offsets and finalize each transfer once into the
existing DocumentUpload/queued extraction workflow. Browser IndexedDB retains
the selected PDF until the stable upload reference is saved, then removes file
bytes. Account changes/logout/dismissal clear the browser checkpoint. Reloads
reuse the same transfer; browser Web Locks coordinate tabs where available.
No plaintext chunk is persisted server-side; finalization uses a bounded private
temporary file, removed in finally. Expired chunks have an explicit hourly prune
command; deployments must run Laravel's scheduler as well as the queue worker.

Count saved inbound pivot relationships plus citation_events with action=copy.
The pivot already has a unique source/target pair; copies gain a unique per-user
UUID to make acknowledgement retries safe. Opening, formatting, viewing and
downloading citations have no counting side effects. Historical generation events
remain intact but are excluded. Both rankings and detail totals use the same SQL
expression, independent of the viewer's visibility of the citing source. The
legacy citation_generations API key remains a compatibility alias for the new
total; visible labels describe saved references and successful copies. IEEE is
removed, with APA/MLA retained. The browser observes clipboard success before
sending a copy event; the server cannot verify external use of the copied text.


D-014 verification follow-up: delete finalized transfer rows with their parent
DocumentUpload (cascade) rather than setting upload_id null, avoiding conflicting
user/document cascade paths. If a finalization transaction rolls back after a PDF
was staged, delete that unclaimed encrypted PDF and preserve confirmed chunks for
retry. A forced-failure test and a real committed database-queue test passed in
the isolated schema. The detailed November 7 evidence lists the release prerequisites.


## D-015 — Repair the configured local schema and reveal registration errors (2026-11-07)

The prior source-only update left two forward migrations unapplied in the active
local application schema. This explicit repair request authorizes applying them
after a fresh verified private backup, without resetting/seeding the DB or changing
the application key. Database tests and synthetic browser workflows must still
use the separate schema-restricted disposable database, never application data.

Keep Faculty's existing lowercase role, MBC-format institutional ID, BSIT/BSCpE
program, verified email and administrator approval rules. Faculty does not require
student year/section. Return rejected fields to the appropriate visible step and
show the first actionable message so backend validation cannot appear silent.
Do not suppress real validation or auto-approve Faculty to make signup pass.


D-015 follow-up: Continue explicitly cancels its click default action before
advancing steps. React can reuse the same DOM button with type=submit during the
transition; retained credentials must never cause implicit final submission.
Real-browser error correction and explicit Faculty submission passed.

Verification-helper lesson: Laravel's Windows cache-path resolution may treat a
drive-qualified path as relative unless configured otherwise. Use a verified
relative cache path (or a helper-only absolute prefix), and assert the HTTP app's
actual test database/storage/mail configuration before any mutation. One initial
synthetic verification row reached the local application DB and was removed;
the detailed report records cleanup and the preservation boundary. No production
access or account-approval relaxation was used.

## D-016 — Byte inactivity, small ranges and bounded concurrency (2026-11-05 evening)

The client's screenshot matches the hook's overall timeout message; it does not prove a bad connection. The old hook could also rearm after readiness or treat an unchanged rounded percentage as a stall. Testing the real 176-page PDF showed that its flat page tree made PDF.js prefetch page dictionaries scattered across nearly the entire 97 MB file with 1 MiB requests.

Use 64 KiB ranges and at most four simultaneous requests per viewer. Server encryption blocks remain 1 MiB and unchanged. Reset inactivity from actual received bytes and PDF.js progress, including bytes that do not change the rounded percentage. Cover waiting for headers and body data. Stop the hook timer on ready/error, and ignore late progress after a terminal state. Keep existing authorization and the independent fullscreen transport. This supersedes D-001's requirement to align viewer requests with the encrypted block size.

The bounded 64 KiB parser check requested about 11.6 MB before page 1 became available, versus approximately 97 MB before. It does not eliminate page-tree traversal or promise instant opening. Keep the previous frontend assets and rollback paths; deploy no backend or persistent-data changes for this fix.

## D-017 - Preserve workstation fixes during client synchronization (2026-11-07)

Fast-forward `release/ui-refinement` to the client's `a6025cf` without publishing
local work. Retain both the upstream reading-position integration and this
workstation's November 5 byte-inactivity/range fix. Keep a recovery stash of the
entire original tracked/untracked change set. The retained byte-inactivity
decision is numbered D-016 here to avoid colliding with the client's D-011.
Incoming runtime/DB verification describes the originating client workstation;
verify this laptop separately. The pull does not authorize deployment or establish
that pending local migrations have been applied.

## D-018 - Backed-up ASUS local setup and repeatable startup (2026-11-07)

The user explicitly authorized completing this workstation's local setup. Verify
the runtime's actual loopback `acadex_local` identity, preserve its existing key,
configuration, database rows and storage together, and apply only reviewed pending
forward migrations after a verified coherent private backup. Never substitute
the client workstation's database name or seed/reset the existing application.

The local launcher reads Vite's development environment to choose the loopback API
port and starts the database worker plus Laravel scheduler. Preserve existing env
files; do not hard-code this laptop's port into shared frontend source. Keep
process ownership receipts with known executable paths for reliable stop/restart.
All synthetic feature checks use the guarded disposable schema and independent
private storage/mail configuration, with actual runtime assertions before writes.
Account for new anonymous browser sessions separately from original-row checks.

## D-019 — Run production upload cleanup through a release-aware scheduler (2026-11-07)

The resumable-upload release schedules `acadex:prune-upload-transfers` hourly.
Production previously had a database queue worker but no Laravel scheduler, so
expired temporary chunks would otherwise remain indefinitely. Run
`php artisan schedule:work` as `www-data` in the active backend release through
the enabled systemd unit `acadex-scheduler.service`. Keep its working directory
aligned with the queue worker and Apache backend on every backend release.
Continue running one queue worker on the configured database queue. Keep OCR on
its separately managed source and do not restart it for frontend/backend-only
releases unless OCR code or dependencies change.

## D-020 — Staged upload quota and cleanup lifecycle (2026-11-07)

Calculate one owner's pending usage from every unexpired, unclaimed
`document_uploads` row and its existing encrypted file size. Keep one shared
calculation for direct staging and transfer start, and include unexpired
unfinished transfer reservations in the latter. Expired rows stop reserving
quota immediately and are removed hourly by the Laravel scheduler.

Serialize staged allocation, discard and prune operations by locking the owner
row before upload/transfer rows. Before cascading transfer metadata, remove
existing encrypted chunk files. Retain a staged file whenever a capstone or
resource references its path; remove the staged encrypted file only after its
row deletion commits. Return 410 for a resumed transfer whose failed finalization
released its reservation, and ask the user to select the PDF again.

The pending encrypted-byte default is 1 GiB to allow repeated 128 MiB uploads.
Keep the per-file 128 MiB ceiling, 2 GiB free-space reserve, existing encryption
format, APP_KEY handling, and schema unchanged. The optional pending-list API/UI
was omitted. Local tests are not evidence of production verification.

## D-021 — Keep external chatbot providers opt-in until production credentials exist (2026-11-08)

The AcadeX chatbot supports Groq as primary, Gemini as fallback, and a
deterministic local response when provider credentials are unavailable. The
production environment contained Google sign-in credentials but no Groq or
Gemini API keys at deployment time.

Deploy the integration code with the local fallback active. Do not copy provider
credentials from a workstation, send capstone/user context to external model
providers, or incur provider usage until keys are added through the client's
private environment channel. Rebuild Laravel's configuration cache after such a
change. Preserve the existing Google identity configuration in
`config/services.php`.

## D-022 — Upload years, student visibility choices and adviser text (2026-11-08)

Admin upload-year charts use `created_at`, not the academic metadata `year`.
Return six consecutive calendar years through the current year, including zero
counts, oldest first. Include archived/pending records as the Uploaded total does;
the approved endpoint separately restricts to approved, unarchived records.

Student publication selections are persisted behind the existing approval gate.
Pending/rejected records never gain library/visitor access through the selection.
Approval permits the selected access tier; default remains unpublished. This
supersedes forced-unpublished submission behavior in the earlier access contract.
Existing student edits still reset the record to pending/unpublished. Flexible
registration IDs supersede D-015's MBC-specific format requirement; required,
unique and maximum-length validation and verification/approval gates remain.

Store editable adviser text separately from the Faculty foreign key. Compare
lowercase names with collapsed whitespace and use the existing approved,
unarchived, available Faculty pool. Duplicate names never choose an arbitrary
account; expose username/program to distinguish eligible matches. Revalidate
matching on save, preserving text even without a match. Extract only beneath an
APPROVAL SHEET heading on the same bounded raw/OCR page, leaving missing data
editable instead of guessing from acknowledgments or a table of contents.

The nullable adviser-name column is additive; rollback retains collected data.
Application/production migration and deployment are outside this implementation
request. Verification must use the guarded schema-restricted disposable DB.

## D-023 — Explicit local development origins for Vite's fallback port (2026-11-08)

Vite can serve a second local instance on 5174 while 5173 is occupied. Under
APP_ENV=local, add exactly http://localhost:5173 and http://localhost:5174 to
the configured CORS frontend origin and add both host:port entries to Sanctum.
Do not enable wildcard credentialed origins or add development origins in
production/staging/testing. Preserve FRONTEND_URL for links and production
configuration; do not rewrite the private environment to chase a second dev port.
Clear the local config cache so the running request-per-process PHP API sees the
change. The standard launcher retains its existing strict 5173 port behavior.

## D-024 — PDF-only metadata and bounded upload-review work (2026-11-08)

The user requests direct extraction without generated text. Remove the optional
metadata model service and its config, superseding D-004/R6's Ollama enrichment.
Keep only PDF text/OCR recognition plus whitespace/line-wrap normalization;
remove word/digit guesses, abstract rewrites, inferred technology keywords and
unlabelled abstract fallback. Missing fields stay blank and editable.

Bound metadata to the first 12 pages across the PHP text reader, native OCR and
Paddle request. This reduces front-matter work and leaves later author-contact
appendices to manual entry; preserve full documents and separate indexing.
Readable title/abstract pages must not fall into OCR solely because remaining
front matter is sparse. Ignore known margins/scanner stamps in that decision.

Viewing-preview preparation runs after final submission with indexing instead
of before Step 2 extraction. Queue restoration is an authorized local runtime
repair; do not mutate existing documents or clear jobs to make latency disappear.
The local worker uses one-second idle polling and a recorded executable/PID/start
identity. Production and live Paddle behavior require separate deployment checks.

## D-025 — Repair the active local schema for upload submission (2026-11-08)

The later user request to fix upload 503s authorizes the routine local schema
repair necessary for the already implemented adviser-name field. Fresh runtime
identity is loopback EduArchiveDB, superseding historical workstation names.
Back up and verify SQL, original row values, private env/APP_KEY and storage
before applying only the pending additive adviser-name migration. Keep the
source field and its data contract; do not silently drop adviser text to hide
the schema error. Production migration/deployment remains separately scoped.
