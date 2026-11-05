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
