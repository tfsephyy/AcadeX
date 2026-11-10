# AcadeX improvement requirements (working contract)

Status key: `pending`, `in_progress`, `done`, `blocked`, `unverified-deployed`.

This file is the durable record of the 16 requested improvements. It must be read with
[ACADEX_PROGRESS.md](ACADEX_PROGRESS.md) and [ACADEX_DECISIONS.md](ACADEX_DECISIONS.md).
The client-facing deployment history remains in [../ACADEX_CLIENT_AI_HANDOFF.md](../ACADEX_CLIENT_AI_HANDOFF.md).

**Current production state (2026-11-09):** Unified release cadex-20261109-e32fa20 is live in production with backend and frontend. Migration 2026_11_08_000001_add_capstone_adviser_name applied. UI responsiveness (3-card grid default, 4 on collapsed), removed rigid MBC ID requirement, fixed Admin Dashboard upload year series, Faculty Adviser Dashboard, and modular PDF extraction active and verified. See [the production release record](handoff/PRODUCTION_RELEASE_2026-11-09_UI_REFINEMENT_MODULAR_EXTRACTION.md).

## November 10, 2026 — Unified AI Capstone Research Assistant

Status: implemented and verified locally; ready for publication/deployment.

Consolidates all chatbot interactions into a single adaptive assistant:
- **Automatic & Manual Mode Switching**: Automatically defaults to Smart Mode on repository/discovery pages; switches to PDF Only Mode when opening a capstone PDF; reverts to Smart Mode when closing or navigating away. Manual mode overrides (Smart, PDF Only, General AI) are respected within the active document session. PDF Only Mode is disabled when no document is active.
- **Three Specialized AI Modes**:
  1. *Smart Mode*: Context-aware general-purpose assistant. Prioritizes the active PDF when questions relate to the opened capstone; answers general knowledge and technical questions without document restrictions; distinguishes document facts with `[PAGE:n]` citations from AI context.
  2. *PDF Only Mode*: Strictly grounded in the active PDF text. Answers using only facts supported by the document with exact page citations `[PAGE:n]`; refuses to answer or guess when information is absent.
  3. *General AI Mode*: General academic and programming chatbot operating without document restrictions or repository constraints.
- **Page-Delimited PDF Text Indexing & Retrieval**: `PdfPassageRetriever` scores extracted text delimited with `--- [PAGE:n] ---` markers, retrieving relevant passages within budget rather than truncating whole documents.
- **Clickable Page References**: Citations rendered as `<button className="chatbot-page-ref-btn">📄 Page {n}</button>` that smoothly scroll the PDF viewer to `data-document-page="{n}"`.
- **Integrated Research Features**:
  - *AI Summary*: Structured academic summary (Objectives, Methodology, Technologies Used, Major Findings, Document Limitations) with page references.
  - *Research Gaps & Improvements*: Strictly separates documented limitations from AI-suggested future directions.
  - *Similar Capstones*: Verified repository recommendations based on shared category, program, or keywords with clickable cards and direct comparison triggers.
  - *Capstone Comparison*: Structured side-by-side comparative matrix evaluating objectives, stack, and findings without hallucination.
  - *Dynamic Suggested Questions*: Contextual chips tailored to the active capstone or discovery topics.

Verification: 187 guarded disposable-MySQL backend tests / 1,607 assertions passed; 73 frontend tests passed; production build passed (854 modules); ESLint clean.

## November 8, 2026 upload review layout and full-PDF keywords

Status: implemented and verified locally; no deployment. The current user request supersedes the computing-only
keyword scope below: scan the whole PDF and rank frequent technical, research and
capstone terms. Keep the existing 15-tag limit and manual editing; no generated
filler. Retain bounded processing with visible warnings when coverage is incomplete.

- Step 2: year/program/category, then adviser/keywords side by side, then a
  full-width abstract. Stack paired fields on small screens.
- Step 3 in all three upload roles: require explicit copyright and visitor-access/
  publication selections, with server validation for new submissions. Pair IMRAD
  with additional resources, and references with submission summary on desktop.
- Preserve prior work, approval/access policy, original files and existing records.
  No migration or production deployment is requested.

Verification: 171 guarded disposable-MySQL tests / 1,566 assertions, 58 frontend
tests, build and quiet lint passed. Synthetic Chrome verified all three roles on
desktop/mobile. See [the implementation record](ui/2026-11-08-upload-layout-full-pdf-keywords.md).
Source published to the client's `release/ui-refinement` branch as `1402d74`;
the remote commit was verified on November 8. Production deployment remains separate.

## November 8, 2026 technical keywords and existing-capstone editing

Current attached implementation request; supersedes the earlier ten-keyword
limit and arbitrary-frequency/explicit-list keyword acceptance.

- Automatic suggestions use only literal source matches from a maintained
  computing dictionary, ranked by frequency/title/abstract relevance, with no AI
  and at most 15 unique terms. Explicit labels must also pass that dictionary.
  Exclude repeated general words and never pad to the limit.
- Upload and edit share comma-separated multiple entry, case-insensitive
  deduplication, individual tag editing/removal and visible validation at 15.
  Normalize before server validation so embedded comma lists cannot bypass the
  maximum or cause a valid multi-term input to fail the per-term length limit.
- Adviser placeholder is exactly `Enter Manually here` in upload and edit.
  Existing-capstone edits display the saved text or an empty field when missing;
  retain normalized Faculty matching, explicit duplicate selection and eligibility.
- Save deliberate adviser changes to text/account separately; unknown names stay
  unlinked. No account creation or role/approval permission changes.
- Omit untouched adviser/keyword fields during edits. Never re-extract or truncate
  old records automatically. Legacy lists above 15 remain intact for unrelated
  edits; intentionally changed keyword lists must satisfy the new maximum.
- Verify persistence/refresh and reassignment in the guarded disposable MySQL DB,
  plus synthetic browser coverage of all three role-specific upload/edit panels.
  No application-data migration or production deployment is requested.

## November 8, 2026 modular deterministic metadata rules

Current implementation request from the attached extraction specification. This
supersedes the earlier explicit-keywords-only/12-front-pages-only metadata rules:

- Keep PDF validation/I/O in PdfExtractorService; share cleaned, numbered pages
  with optional coordinates through MetadataPipeline and independent title,
  author, year, adviser, abstract, keyword and contact services.
- Remove repeated margins and numerical/Roman page numbers with structural and
  positional evidence; never discard the first three lines blindly. Preserve
  meaningful title content and the first-page publication date.
- Bound metadata to 12 front pages and check up to 12 tail pages for named CV
  profiles. Large originals require bounded private samples; missing tools or
  unreadable/missing profiles require manual review, never guessed contacts.
- Use native traditional Tesseract only for scanned metadata; no Paddle/model
  API or generative/corrective AI. Retain conservative explicit spacing repairs,
  source-only frequency/technical-vocabulary keywords (maximum ten), and raw
  extracted text internally for comparison without exposing it in upload APIs.
- Preserve title wording/capitalization; stop at introductory project statements.
  Separate author lines; read the first-page publication date; extract the adviser
  directly above Adviser inside APPROVAL SHEET; stop executive summaries at
  contents/acknowledgment/chapter headings.
- Normalize Faculty names by case, spaces, punctuation, common honorifics,
  credentials and explicit surname-first ordering. Keep distinct initials and
  existing Faculty eligibility; duplicate normalized matches need explicit choice.
- New uploads always save BSIT server-side and show it read-only during review.
  Retain existing records without a bulk program rewrite. Keep structured author
  contacts and existing personal-information permissions.
- Field failures produce sanitized manual-review notes while other fields and
  upload processing continue. Late results must preserve manual edits, including
  deliberate clearing of values and contacts/keywords.

Implementation and verification are local; production deployment is not requested.

## Global constraints

- Preserve existing roles, approvals, authorization boundaries, encrypted documents, and production data.
- No destructive schema operations. Every schema change is a forward migration with a rollback that does not destroy records.
- Existing numeric capstone URLs must keep working when slugs are introduced.
- Production writes require an approved backup. The November 7 release used the verified private recovery set recorded in the latest progress entry.
- Local verification and deployed verification are recorded separately and are never conflated.
- Background processing must degrade safely when Redis/Ollama are unavailable.
- Existing-local setup after a pull must install locked dependencies, back up and
  migrate the verified local schema, and retain its APP_KEY, accounts and storage.
  See the November 7 ASUS local setup entry in the progress log; it is separate
  from production deployment and does not certify outstanding feature acceptance.

## November 8, 2026 dashboard, registration and adviser follow-up

Status: implemented and locally verified; no deployment requested. See
[the implementation record](ui/2026-11-08-dashboard-registration-adviser.md).

- Admin upload-year bars count `created_at` calendar years, show the last six years
  in ascending order with integer counts and zero-filled gaps, and describe their
  scope (all records, including archived records). Approved-year counts must filter
  approved, unarchived records.
- My Uploads cards across Admin, Faculty and Student use three desktop columns
  with expanded navigation and four with collapsed navigation; retain mobile layout.
- Manual and Google registration accept different ID formats, retain the placeholder
  example, required checks for non-visitors, size limits and uniqueness.
- Faculty summary cards form one desktop column beside a two-series line graph;
  Most Viewed and Most Cited share the next desktop row and stack on small screens.
- Students can choose Library Visibility & Publication in Step 3. Persist the choice
  while preserving pending review, adviser/admin approval and visitor restrictions.
  This supersedes the earlier forced-unpublished-on-submission rule.
- Shared Step 2 extracts the name immediately above Adviser on the APPROVAL SHEET,
  permits manual correction and matches Faculty accounts ignoring case/whitespace.
  Match only approved, unarchived, available Faculty under the existing assignment
  rule. One match links automatically; none retains text without a link; multiple
  matches offer account selection. Preserve the name and optional account separately.
- New additive adviser-name migration is verified only in the disposable database
  until a separately authorized backed-up application migration/deployment.

**November 8 local repair update:** the user's later upload-503 repair request
authorized applying the adviser-name migration to the verified local EduArchiveDB
after a fresh SQL/env/storage backup. Applied and preservation-verified locally;
no migrations remain pending there. Production remains outside this repair.

## November 8, 2026 local CORS repair

Status: implemented and verified on the running local API and in Chrome.
Allow the user's localhost:5174 frontend alongside 5173 for credentialed local
API requests and session-domain configuration. Keep production/staging restricted
to the configured frontend origin. Preserve private env files and existing work.
Live preflight and browser user/CSRF checks passed; 22 focused backend tests passed.

## November 8, 2026 PDF-only extraction and local worker recovery

Status: implemented and locally verified; worker restored. Final checks: 140
backend tests / 1,218 assertions and eight lightweight Python tests passed.
See [the extraction repair record](ui/2026-11-08-pdf-only-extraction.md).
This request supersedes R6/D-004's optional metadata AI enrichment.

- Remove model-based metadata generation entirely, including its service/config.
- Preserve words read from PDF text/OCR; no dictionary-based abstract rewriting,
  inferred keyword labels, or invented values. Missing fields stay blank/editable.
- Bound metadata text reading and native/Paddle OCR to first 12 pages. Keep the
  original file, 128 MiB upload limit and existing OCR safety limits intact.
- Move optional viewing-preview preparation after final submission so it cannot
  delay Step 2. Retain the existing encrypted viewing fallback.
- Restore the stopped local database queue worker and verify pending extraction
  drains. Preserve existing private config, application key, records and documents.
- Verify extraction and authorization against the guarded disposable DB; local
  queue diagnostics/recovery are separate from synthetic tests and deployment.

## R1 — Capstone loading and document viewer (priority: high)

**Problem observed by the client:** opening an uploaded capstone can stay on
"Loading capstone..." or take unusually long.

**Acceptance criteria**

- Capstone metadata renders without waiting for the PDF bytes.
- PDF viewer has its own loading, progress/indeterminate state, timeout, error, and retry.
- A failed/slow PDF request cannot leave the whole page in an indefinite loading state.
- Timed-out/aborted requests are reported with an actionable message and can be retried.
- View-recording and other analytics never block metadata rendering.
- Large PDFs do not cause all pages to allocate canvases at once.
- Fix verified locally; deployed verification recorded separately.

**Dependencies:** none. **Evidence:** browser test against a seeded local capstone and a
large synthetic encrypted PDF.

**November 5 evening evidence:** the deployed viewer uses 64 KiB authenticated ranges, at most four concurrent requests per viewer, 60-second byte-inactivity detection, and terminal-state protection. Both current production capstones (176 and 171 pages) open through View Full Page. The current local suite has 23 passing tests; lint and the production build pass. Detailed verification and remaining client-device boundaries are in [the hotfix report](handoff/PDF_VIEWER_HOTFIX_2026-11-05.md). This does not certify arbitrary future PDFs or the client's physical devices.

## R2 — Logo background and theme compatibility (priority: medium)

**Acceptance criteria**

- Brand SVGs have transparent backgrounds (no baked white plate) where the interface
  supplies its own surface.
- Logo remains legible in light and dark themes in sidebar, auth pages, and landing/nav.
- Original mark, proportions, and brand colors are preserved.
- Assets remain optimized SVG; no raster replacement.

**Dependencies:** none.

## R3 — Google registration (priority: high)

**Acceptance criteria**

- "Continue with Google" is available in registration Step 2 (academic/role step).
- Verified Google email is used; manual email code and Step 3 password are skipped.
- Selected role/program/year/section and approval rules match manual registration
  (student/faculty accounts still require administrator approval; visitors follow the
  existing visitor rules).
- Registration rejects an existing email or Google identity without creating or
  linking an account. Sign-in follows D-009: a previously verified Acadex email
  may link only to the same server-verified Google email; unverified local emails,
  conflicting Google subjects, and account restrictions remain protected.
- The signed Google ID token, audience, issuer, expiry, and verified email are
  validated server-side; no client-supplied email is trusted. The registration
  POST also uses the application's session-bound CSRF protection.
- Behaviour is implementable without Google credentials in this environment; the
  UI/API report "not configured" rather than failing dangerously.

**Dependencies:** Google's maintained PHP API client and a matching web client ID
in the server and frontend build environments (not available on this workstation).

## R4 — Registration security and spam prevention (priority: high)

**Acceptance criteria**

- Named throttles cover register, login, forgot-password, reset, verification send,
  and verification check. Limits consider IP and normalized email/account.
- Verification-code sends have per-email and per-IP cooldowns and daily caps.
- Forgot-password does not disclose whether an email exists.
- Registration rejects bots with a honeypot and minimum completion time; optional
  Cloudflare Turnstile is enforced when configured.
- Login keeps account lockout and adds email+IP throttling.
- Sensitive events are logged without secrets or full document contents.

**Dependencies:** none; Turnstile credentials optional.

## R5 — Background capstone processing (priority: high)

**Acceptance criteria**

- PDF transfer completes first; extraction/OCR/metadata/AI work runs in a queued job.
- Upload response exposes a stable upload reference and `queued` status.
- Statuses `queued`, `processing`, `completed`, `failed` are persisted and pollable.
- Polling updates the UI without a manual refresh.
- Closing the modal or navigating away does not cancel processing.
- Jobs have timeouts, bounded retries, logging, and duplicate protection.
- Failure leaves the stored file and capstone record intact and retryable.
- Uploader receives an in-app notification on completion/failure.
- Redis queue via Docker is documented/configured; workers have a systemd example.
- Queue configuration degrades to an existing supported driver when Redis is absent.

**Dependencies:** Redis (Docker) and a queue worker in deployment.

## R6 — PDF extraction, OCR, and local AI (priority: high)

**Acceptance criteria**

- Direct text extraction is preferred; OCR is used only for sparse/scanned input.
- Ollama is used only when configured and healthy; no paid AI APIs are introduced.
- Text cleaning normalizes whitespace, rejoins broken words, fixes common OCR
  substitutions, and removes repeated page headers/footers/page numbers.
- AI output can only clean/organize values; every AI-suggested field is checked
  against the source text and discarded when not grounded.
- Missing information stays missing; no fabrication or silent fact changes.
- Extracted values remain editable before submission.
- OCR/AI work is bounded in pages, input size, and time.

**Dependencies:** Ollama runtime (optional). Hosting note: the current `t3.small`
(~2 GiB RAM) is not sized to run PaddleOCR and a local LLM simultaneously; Ollama
is therefore opt-in and disabled by default.

## R7 — Database review and optimization (priority: high)

**Acceptance criteria**

- New fields only where required; forward-only, non-destructive migrations.
- Indexes for adviser/approval/archive, uploader/date, notification read state,
  slug, processing state, citation events, and keyword lookups.
- Foreign keys retained/validated; duplicate keyword records prevented.
- Existing data backfilled safely (slug, adviser availability, processing state).
- Query hot spots reviewed and eager loading added where N+1 was found.
- No production data reset, truncation, or re-seed.

**Dependencies:** approved backup before production migration.

## R8 — Slugs and IEEE citations (priority: medium)

**Acceptance criteria**

- Capstones receive unique readable slugs generated from titles; duplicates get
  deterministic suffixes.
- Existing numeric URLs keep resolving.
- New frontend detail links use slugs.
- Slug generation is a separate utility/function from citation formatting.
- APA, MLA, and IEEE are available; IEEE follows `[1] A. Author, "Title," ...`.
- Citation generation is tracked for "most cited" metrics and labelled as
  "citation generations", not verified external citations.

**Dependencies:** DB migration.

## R9 — Faculty dashboard (priority: medium)

**Acceptance criteria**

- Shows adviser-assigned totals, assigned pending review, recent assigned
  uploads, most-viewed assigned, most-cited assigned, and upload/engagement trends.
- Repository-wide numbers are visually separated from assigned numbers.
- "Most cited" is labelled as citation generations.
- Dashboard matches the existing AcadeX design and is responsive.

**Dependencies:** R8 tracking, R10 assignments.

## R10 — Adviser assignment and notifications (priority: high)

**Acceptance criteria**

- Uploader picks an adviser from an administrator-managed list during submission.
- Assignment stored in `capstones.adviser_id` and shown consistently.
- On successful submission the adviser receives an in-app notification and a queued
  email containing title, uploader name, submission date, and a direct link.
- Notifications support read/unread.
- Retries/repeated requests do not duplicate in-app or email notifications.
- Adviser must be an active, approved, available faculty account.

**Dependencies:** mail transport, queue worker, R14 availability.

## R11 — Faculty capstone library (priority: medium-high)

**Acceptance criteria**

- Faculty can browse capstones assigned to them as adviser.
- They can view details/documents and perform existing permitted approvals.
- Backend enforces access; UI-only hiding is not accepted.
- Existing adviser review policy is preserved (approve/reject assigned submissions,
  no general edit/delete merely from assignment).

**Dependencies:** R10.

## R12 — Uploader information (priority: low)

**Acceptance criteria**

- "Uploaded by" appears on capstone cards, detail pages, and repository views.
- Uses the uploader's user record, never the author field.
- Uploader and author remain distinct concepts.

**Dependencies:** none.

## R13 — Multiple keyword entry (priority: medium)

**Acceptance criteria**

- Comma-separated input splits into keywords; whitespace trimmed; empty entries ignored.
- Case-insensitive duplicates are removed.
- Users can review, edit, and remove entries before saving.
- Existing keyword records remain compatible and displayed consistently.
- Backend normalizes and de-duplicates as well.

**Dependencies:** none.

## R14 — Adviser list management (priority: medium)

**Acceptance criteria**

- Administrators can add eligible faculty to the adviser pool, update availability,
  deactivate, and reactivate.
- Uses existing faculty user accounts; no parallel adviser identity table.
- Deactivation does not alter or remove historical assignments.
- Upload adviser pickers only offer active, available faculty; admin views can see all.

**Dependencies:** DB migration, R10.

## R15 — Admin user management UI (priority: medium)

**Acceptance criteria**

- Matches the structure/visual language of other admin pages.
- No unnecessary horizontal/vertical scrollbar in the upper navigation.
- Consistent spacing, tables, buttons, filters, typography, and form controls.
- Responsive on desktop, tablet, and mobile.
- All existing management actions preserved.

**Dependencies:** none.

## R16 — Upload modal improvements (priority: medium)

**Acceptance criteria**

- "Upload & enter manually" is removed.
- PDF upload + extraction remains the primary flow.
- Review/correct metadata before final submission still works.
- Transfer, queued, processing, completed, and failed states are clear.
- Errors are actionable and retryable.
- Cancel remains available during transfer and aborts the browser request.
- Close/Escape minimizes an active upload without aborting it. A floating
  upload icon shows measured transfer progress or the server processing state,
  remains visible across internal page navigation, and reopens the details.
- Background completion does not redirect the user. Review details explicitly
  opens the existing upload reference; no second upload is needed.
- Track one upload per signed-in browser session, clear it on logout/account
  change, and keep full-tab-close/refresh limitations explicit. Cancellation
  after all bytes are sent cannot promise that server processing is stopped.

**Dependencies:** R5.

## November 7, 2026 interface follow-up (current task)

- Complete slug-based detail links across cards, approvals, saved lists and chatbot;
  preserve numeric URL compatibility and existing role authorization.
- Match Faculty repository statistics to the dashboard surfaces and text tokens.
  Share Admin/Faculty notification controls with a bell beside the profile and
  legible, distinct read/unread states in both themes.
- Persist PDF page locally per canonical capstone ID, PDF type and account
  (browser-local visitor fallback). Restore on reopening, including fullscreen;
  support fullscreen zoom below the initial scale.
- Display own-upload navigation/page titles as **My Uploads**, repository browse
  navigation/page titles as **Capstone Library** across the four existing panels.
  Preserve routes, page functionality and role permissions.
- Remove the lighter User Management navigation background and nested navigation
  scrolling; align icons, spacing and controls with the shared design system.
- Remove Unique Viewers, Engagement and Peak Day cards from individual analytics;
  reflow the three remaining cards.
- Display **Not Yet Copyrighted** for the existing `unprotected` status. Keep its
  stored value and visibility rules.
- This task requests implementation. No production deployment is included.


## November 7, 2026 layouts, resumable uploads and reference totals

Current implementation request; supersedes R8's IEEE requirement, D-006's
generation counting, and R16/D-012's full-refresh limitation.

- My Uploads and Pending Approvals default to tables at desktop widths and cards
  on mobile. Keep layout selection; desktop cards use four columns.
- Capstone Library across all four roles offers a category hide/show control,
  three desktop columns, four when navigation and categories are both collapsed,
  and readable mobile cards. Existing route names and permissions stay intact.
- Recover interrupted transfers from confirmed chunks and reconnect to queued or
  running extraction after refresh. Stable owner-scoped transfer/upload references
  prevent duplicated files, jobs, and final capstone submissions.
- Total references equal saved inbound reference relationships plus successful
  citation copies. Viewing, opening a citation section, formatting and downloading
  do not count. Replayed copy events and repeated relationship saves count once.
- Remove IEEE formatting and controls; retain APA and MLA.
- Most Viewed and Most Cited exclude zero counts and show empty states.
- Implementation and verification are local; deployment is a separate task.


Local status: implemented and locally verified; deployment pending. See the final
November 7 progress entry and [implementation evidence](ui/2026-11-07-layout-upload-reference-update.md).
Both new migrations have been verified only in the disposable test database.


## November 7, 2026 runtime repair and interface controls

- Repair the configured local MySQL upload schema after a fresh verified private
  backup; retain accounts, existing rows, APP_KEY and documents. Verify actual
  upload/extraction/reload recovery with synthetic data in an isolated test DB.
- Faculty registration must accept its role/program without student year/section,
  preserve verification/approval requirements, and reveal actionable field errors
  even when they concern an earlier registration step.
- Each role's library places an icon visibility toggle directly beside CATEGORY,
  with state-dependent icon, tooltip, accessible label and expanded state.
- Pending Approval View/Approve/Reject controls are consistent icon buttons in
  both table and card layouts, retaining confirmation and action behavior.
- Assigned Capstones uses four desktop columns, with tablet/mobile adaptation.
- Local implementation/repair only; no production deployment requested.


Local status for the runtime-repair/interface-control follow-up: **done locally**.
The configured application migrations are applied, Faculty and real resumable
upload/extraction checks passed, icon controls and responsive Assigned cards passed.
See the final progress entry and [repair evidence](ui/2026-11-07-runtime-registration-controls.md).
Production deployment was not requested or performed.

## November 7, 2026 staged upload quota and cleanup

- Exclude expired staged uploads from per-owner quotas and show current usage in
  the shared quota error.
- Prune expired unclaimed rows and encrypted files hourly; preserve active
  processing, claimed uploads, and any file path referenced by a capstone or
  resource. Remove leftover transfer chunks before cascading transfer metadata.
- Let owners explicitly discard eligible staged uploads. Backing out of review
  confirms and discards; moving forward and successful submission must retain or
  claim the upload.
- Expire a failed-finalization reservation so a subsequent attempt can proceed;
  show a clear reselection message when the same expired transfer is resumed.
- Raise the pending encrypted-byte quota default to 1 GiB while preserving the
  128 MiB per-file ceiling, encryption format, application key, and 2 GiB disk
  reserve. No schema migration is needed.

Status: implementation and local verification passed; deployed November 8 from
commit `6fa3fac`. No migration was added. The hourly scheduler is active, the
one-time prune removed 20 expired staged uploads, and production smoke checks
passed. See the [deployment and verification report](handoff/STAGED_UPLOAD_QUOTA_FIX_2026-11-07.md).

## November 7, 2026 client source synchronization (ASUS workstation)

The requested Git pull brings in client commit `a6025cf` while retaining this
workstation's existing PDF timeout hotfix. The incoming runtime-repair evidence
belongs to the client's workstation. Here, a read-only migration-status check
found nine pending migrations; source synchronization does not complete local
runtime setup or deployed acceptance. Requirements and feature scope are unchanged.

### ASUS setup completion after source synchronization

The authorized local setup is complete: all nine pending migrations are applied
after a verified private backup, original data/key/files are preserved, and the
launcher runs the configured API, frontend, queue, scheduler and OCR. Fresh local
feature verification passed in the separate guarded disposable database and HTTP
runtime. See [the local setup report](handoff/LOCAL_SETUP_2026-11-07_ASUS.md).
This supersedes the pending-local-migration state immediately above; deployed
acceptance and external integrations remain separate.

## November 8, 2026 production deployment — AI Capstone Research Assistant

The assistant controller/service and frontend build are deployed. Production
schema has no pending migrations. The production environment lacks Groq and
Gemini API keys, so the deterministic local fallback is active; live provider
integration acceptance remains pending private key configuration. See the
[production release record](handoff/PRODUCTION_RELEASE_2026-11-08_AI_CAPSTONE.md).
