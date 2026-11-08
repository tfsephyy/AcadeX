# ASUS local setup and data preservation - November 7, 2026

Completed locally after pulling client source `a6025cf` on
`release/ui-refinement`. **No production connection or deployment occurred.**

## Target and verified backup

The actual Laravel runtime and ignored environment both identify local loopback
MySQL `acadex_local`. Before maintenance it contained five users, zero capstones,
and no pending/failed jobs. This is distinct from the client workstation's
`eduarchivedb` described in the incoming November 7 reports. No database was
switched, reset, reseeded, or populated with copied production data.

Private recovery material is under ignored
`.local/local-setup-backup-20261107-asus/`. It contains a completed MySQL logical
dump, the existing backend/frontend environment files, all four files under
`storage/app`, and private integrity/preservation manifests. Dump completion,
the presence of all 25 original tables, SHA-256 integrity, and every copied
configuration/storage file were verified before applying migrations. The temporary
database client credential file was removed. A restore rehearsal was not performed.

## Applied changes

- Applied exactly nine reviewed pending forward migrations: November 5 `000001`
  through `000006` and `000008`, plus both November 7 migrations. The Google
  identity migration (`000007`) was already applied. No migrations remain pending.
- Added fields/indexes and the citation/transfer tables used by the new features.
  Original columns and rows remain intact; there were no existing capstones to
  backfill. The original application key and environment files are unchanged.
- The local launcher now reads the development API address through Vite's existing
  environment loader and starts the API on that loopback port. This laptop's
  frontend already expected port 8010; the old hard-coded port 8000 caused a
  mismatch. No environment file needed rewriting.
- The launcher also starts `schedule:work` alongside the existing database queue
  worker, frontend and OCR. The scheduler lists hourly expired-transfer cleanup.
  Process receipts now retain known executable paths so the stop script can
  reliably identify newly started services. Old incomplete matching receipts
  are repaired on a repeated start.
- Updated two old large-metadata tests that still expected synchronous extraction.
  They now assert queued responses, execute the extraction job, and inspect the
  owner-protected status endpoint for both successful bounded sampling and the
  safe unavailable-metadata fallback. Application extraction behavior is unchanged.

## Fresh verification

- Installed Composer dependencies match the lockfile; nothing needed installing,
  updating or removing. PHP platform requirements passed.
- Guarded schema-restricted disposable MySQL suite: **99 tests / 950 assertions
  passed**. Coverage includes authentication, Faculty registration, document
  authorization, approvals, transfer recovery, ownership, duplicate finalization,
  copy/reference totals, expired-transfer cleanup and background queue delivery.
  No tests used the local application database or production.
- Frontend: **44 tests passed**, quiet ESLint passed, production build passed
  (846 modules, process-local `VITE_API_BASE_URL=/api/v1`). Updated PHP syntax and
  Git whitespace checks passed.
- Separate guarded HTTP runtime, storage, mail and database queue: a valid
  5,244,795-byte synthetic PDF uploaded in encrypted chunks, replayed an already
  acknowledged first chunk, resumed from 2,097,152 bytes with a new HTTP client,
  finalized twice into one upload/job, and exposed persistent queued status.
  An independent worker ran actual PDF extraction and returned the expected
  synthetic title. Decrypted stored bytes matched the original PDF. No pending
  or failed jobs or duplicate transfers remained. The helper asserts its actual
  disposable schema, private storage and array mailer before inserting any fixture
  and on every HTTP request. Its owned account/upload/files were cleaned up and
  its HTTP server stopped.
- The actual local frontend and API health return HTTP 200; OCR health returns
  `status: ok`. The sign-in page was observed rendering in the browser without
  signing into any existing account. All five owned services stopped and restarted
  successfully; a repeated start reused existing services without duplicates.

## Final preservation and operating instructions

Verified original-column row fingerprints in all 24 original non-migration tables,
including every original session, plus all four original storage files and the
exact environment/application key against the pre-migration backup. Five users
and zero capstones remain. The sign-in browser check added two anonymous sessions;
they were retained, and original sessions were separately compared by backup IDs.
Do not describe all tables as byte-identical after normal browser session creation.

Open the local application at `http://localhost:5173`; its API is
`http://localhost:8010/api/v1`. Keep Laragon MySQL running. Use the root
`start-local.ps1` and `stop-local.ps1` scripts to start/stop the owned local
services, including queue/scheduler/OCR. The scripts manage services while running
on this workstation; no OS boot/login task or hosted deployment was installed.

Real external Google sign-in, outgoing email delivery, physical-device acceptance,
and a full-size 128 MiB network transfer were not certified by these local checks.
No existing account password was changed. No commits or pushes were made; the
pre-existing PDF hotfix and recovery stash remain preserved.
