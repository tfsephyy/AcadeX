# AcadeX improvement requirements (working contract)

Status key: `pending`, `in_progress`, `done`, `blocked`, `unverified-deployed`.

This file is the durable record of the 16 requested improvements. It must be read with
[ACADEX_PROGRESS.md](ACADEX_PROGRESS.md) and [ACADEX_DECISIONS.md](ACADEX_DECISIONS.md).
The client-facing deployment history remains in [../ACADEX_CLIENT_AI_HANDOFF.md](../ACADEX_CLIENT_AI_HANDOFF.md).

## Global constraints

- Preserve existing roles, approvals, authorization boundaries, encrypted documents, and production data.
- No destructive schema operations. Every schema change is a forward migration with a rollback that does not destroy records.
- Existing numeric capstone URLs must keep working when slugs are introduced.
- Production writes require an approved backup. This workstation has no verified production access.
- Local verification and deployed verification are recorded separately and are never conflated.
- Background processing must degrade safely when Redis/Ollama are unavailable.

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
- Existing account with the same email is **not** silently linked or taken over.
  Google sign-in is allowed only when the stored `google_id` matches; otherwise the
  response instructs the user to sign in with their existing credentials or reset
  the password.
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

**Dependencies:** R5.
