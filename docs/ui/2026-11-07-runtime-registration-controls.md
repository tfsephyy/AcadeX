# Runtime repair, registration and interface controls — November 7, 2026

Completed and verified locally. **No production deployment was performed.**

## Upload repair

The active local configuration resolves to MySQL `eduarchivedb`. Both November 7
migrations existed in source but were still pending there. `upload_transfers` was
absent; its migration defines every field consumed by the transfer model/controller:
UUID ID, owner, original filename, size, received bytes, chunk manifest, staged
upload ID, expiry and timestamps, with ownership/parent foreign keys and indexes.

Verified a fresh private backup under ignored
`.local/local-update-backup-20261107-082948`: completed SQL dump/hash, unchanged
environment copy and 117 storage copies with matching hashes. A restore rehearsal
was not performed. Applied only the two pending forward migrations through the
existing guarded local maintenance runner. Its immediate preservation check
confirmed original rows/passwords, environment/APP_KEY and file hashes unchanged;
five accounts and ten capstones retained. Inspection confirms the transfer table
and all required columns now exist in the configured schema.

API database failures now return readable JSON with HTTP 503 instead of exposing
SQL/debug payloads. Frontend error formatting filters SQL/HTML responses and offers
an upload retry/resume message. Validation and upload-limit messages remain useful.

## Faculty registration

The backend already accepts lowercase `faculty`, a valid institutional ID and a
BSIT/BSCpE program without student year/section. Its role, faculty-program column,
email verification and approval fields are present. Two browser problems were
reproduced and fixed:

1. Backend errors for an earlier step were stored while that step was hidden,
   leaving no visible explanation on the password step. The wizard now shows an
   alert with the first actionable validation message and opens the relevant step.
   Client ID/program validation matches the existing server contract, and the
   submitted payload includes academic fields appropriate to the selected role.
2. React could reuse the Continue button as a submit button while switching to
   the password step. With retained valid credentials, the same click could submit
   the form before the user pressed Create Account. Continue now prevents that
   default action; a real browser retry verified explicit submission is required.

Verified email and administrator approval remain required. Faculty profiles save
their program, do not create a student profile and cannot sign in before approval.
The success message explicitly describes the approval step. Google Faculty signup
was covered using a server-side synthetic identity, without real Google credentials.

## Interface changes

- All four library panels share a CATEGORY heading with an adjacent icon button.
  Double-chevron direction, tooltip, accessible label and `aria-expanded` reflect
  visibility. The heading/toggle remain available when the panel is collapsed.
  The existing three/four-column library behavior and filters are retained.
- Both Pending Approvals pages share 36px View/Approve/Reject icon buttons in
  table and card layouts. Names/tooltips include the action, and accessible labels
  identify the capstone. Existing preview, approval/rejection and confirmation
  callbacks remain unchanged.
- Faculty Assigned Capstones uses four columns at desktop widths, two at tablet
  widths and one on mobile. Existing routes, links and permissions are retained.

## Verification and cleanup

- Frontend: production build passed (846 modules), **36 tests passed**, quiet
  ESLint passed. Changed PHP files passed syntax checks; Git whitespace check passed.
- Guarded disposable MySQL: **49 tests / 686 assertions passed**, covering Faculty
  manual/Google registration, verification/approval gates, readable database upload
  failures, existing authentication, resumable transfers, ownership, approvals,
  upload locks and document/visitor access.
- Browser interface probes with synthetic intercepted data passed across all roles:
  category heading/icon placement, empty button text, tooltips/labels, icon/state
  changes, mobile overflow, three/four-column library changes, approval previews,
  confirmation/cancel behavior in both layouts, and Assigned grid at 1440/768/390px.
- A separate local HTTP API, private storage, log-only mail and a real database queue
  verified Faculty signup through code delivery/verification, duplicate-username
  correction, retained Faculty selection, explicit final submission and success.
- A real roughly 5 MiB synthetic two-page PDF verified encrypted chunk transfer,
  deliberately lost first-chunk acknowledgement, reload at the confirmed 2 MiB
  offset, one transfer/upload, independent worker extraction, reload while queued/
  processing, restored expected title `SYNTHETIC CAMPUS ARCHIVE SYSTEM`, zero pending/
  failed jobs and no duplicate capstone. The known metadata fixture replaced an
  earlier nonstandard cover fixture whose extracted title was an author name;
  this task did not change general OCR/title heuristics.
- The isolated HTTP helper was stopped, its synthetic accounts/upload records/files
  were removed, and its private cached configuration/credential fixture was deleted.
  Original application configuration, APP_KEY and all 117 original file hashes
  match the backup. Existing row values match except one account's activity/update
  timestamps; activity metadata was retained rather than overwritten.

**Verification incident:** the first HTTP helper used a Windows drive-qualified
`APP_CONFIG_CACHE` path that Laravel interpreted as relative. It consequently
created one synthetic email-verification row in the local application DB. The
helper was stopped and only that exact owned synthetic row was removed; a final
check found none remaining and no account/capstone/settings/document changes.
The corrected helper asserted its actual HTTP environment, database target,
private storage and log-only mail before any mutation, and used a cache path that
Laravel resolves correctly. This exception is recorded explicitly; the initial
attempt must not be described as fully isolated.

Browser runners, synthetic evidence, backup and private helpers remain ignored
under `.local`. Regression credentials are schema-restricted and never committed.
No existing account was used for registration/upload tests. Production state and
the earlier PDF performance limitation remain outside this local verification.
