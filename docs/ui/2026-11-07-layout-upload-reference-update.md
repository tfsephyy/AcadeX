# Layout, upload recovery and reference totals — November 7, 2026

Implemented locally. **Not deployed.** Both new migrations were verified only
in a new isolated, schema-restricted disposable MySQL database. The existing
application database, its configuration/key and stored documents were not changed.

## Behavior and page mapping

| Visible page | Existing routes | Result |
| --- | --- | --- |
| My Uploads | `/admin/capstone-library`, `/faculty/capstone-library`, `/student/capstone-library` | Desktop table default, mobile card default; explicit choice remains available; desktop cards have four columns |
| Pending Approvals | `/admin/approvals`, `/faculty/approvals` | Same responsive defaults and switcher; table retains View/Approve/Reject actions |
| Capstone Library | `/admin/published`, `/faculty/uploads`, `/student/uploads`, `/visitor/capstones` | Category hide/show; three desktop card columns; four with both categories hidden and navigation collapsed; one mobile column and two at intermediate widths |

Existing role authorization, routes, filters and selections remain intact.
Category visibility changes presentation without clearing the selected filter.
An explicit My Uploads/Approval layout choice remains active across viewport
changes until that page is reopened.

## Upload and extraction recovery

- The app saves the selected PDF and account-scoped activity in IndexedDB before
  sending bytes. A UUID identifies the same transfer across reloads. A browser
  Web Lock coordinates recovery of that transfer across tabs where supported.
- The server acknowledges sequential 2 MiB encrypted chunks. Replaying identical
  bytes at an acknowledged offset is safe; mismatched data/offsets are rejected.
  Refresh reconnects to the authoritative server offset rather than trusting
  an interrupted browser percentage.
- Locked finalization validates/reassembles the PDF in private temporary storage,
  reuses existing encrypted staging, and queues extraction after the transaction
  commits. Repeated finalization returns the same upload ID. Encrypted transfer
  chunks are deleted after that commit; private plaintext is removed in `finally`.
- The stable upload checkpoint is saved before deleting the browser's PDF copy.
  Restoring queued/processing/completed activity reads the existing owner-scoped
  status endpoint. Extraction runs in the queue worker independently of a page.
- Final submission locks the staged PDF reference. A replay returns the original
  capstone for the same title/author, without repeated record creation, indexing
  dispatch or submission notifications. Reusing the reference for different
  title/author data is rejected. Failed saves roll back reference relationships.
- Cancel stops the browser request. Resume reuses the same transfer, including
  when finalization succeeded but its response was lost. Dismissing an unfinished
  transfer requests server cleanup. Logout/account changes clear local recovery.
- Recovery needs site storage in the same browser/origin/account. Storage denial
  or insufficient browser quota shows an upload error before transfer starts.
  Incomplete server transfers expire after 24 hours. Explicitly cancelled work
  is not automatically restarted merely by refreshing. Review-field drafts are
  separate from transfer/extraction progress and are not added to this checkpoint.

## Counting rules

One shared SQL expression totals saved inbound `capstone_references` relationships
plus `citation_events` with `action=copy`. The pivot already has a unique source/
target constraint. Submission/update normalize IDs, remove duplicates/self links,
and serialize record updates. Copy requests require a UUID unique per account;
the same copy receipt can be retried without increasing the total again.

The UI records a copy only after `navigator.clipboard.writeText` succeeds. A lost
acknowledgement is retried with its original event ID; pending receipts are scoped
to the signed-in account and flushed after reconnect/startup. Opening a detail or
citation section, changing format, and downloading citation text never add a count.
Historical generation/download events remain stored but are excluded from totals.

APA/MLA remain; IEEE formatting and controls are removed. Detail totals, dashboard
Most Cited and the chatbot's most-referenced result use the same expression.
The legacy `citation_generations`/`citation_count` fields remain compatibility
aliases; visible text describes saved references and successful citation copies.
Most Viewed and Most Cited omit zero-count capstones and retain empty states.

## Runtime preparation for a future release

After verifying a private backup of the target database/environment/storage:

1. Apply forward migrations `2026_11_07_000001_add_citation_copy_idempotency` and
   `2026_11_07_000002_create_upload_transfers` before serving this frontend/backend.
   They add fields/tables and preserve existing documents and records. Their
   rollback methods deliberately retain recovery/counting records.
2. Keep the existing asynchronous queue worker running. Restart it for new code
   using the usual reviewed release procedure; `sync` is not a background worker.
3. Run Laravel's scheduler every minute (or a managed `schedule:work` process).
   `acadex:prune-upload-transfers` runs hourly and removes only expired transfer
   rows/chunks. It does not delete staged documents or capstone records. Manual
   invocation is available for maintenance; monitor temporary-storage growth.
4. Preserve the production APP_KEY, private storage and database together.

Neither application-database migration nor deployment was performed in this task.
The existing November 5 production checkpoint and PDF performance limitation
remain separate from this source update.

## Verification

- Production frontend build passed, 843 modules, using process-local
  `VITE_API_BASE_URL=/api/v1`. Frontend tests: **32 passed**. ESLint quiet: passed.
- Guarded disposable-MySQL suite: **28 tests / 549 assertions passed**, covering
  new transfer/replay/counting/ranking behavior and existing ownership, upload
  locks, approval, document authorization and visitor access.
- A committed disposable transfer queued exactly one actual database job across
  repeated finalization. A queue worker completed it without a page request;
  later finalization returned that upload with no new job. This test substitutes
  deterministic metadata extraction; it does not certify OCR accuracy or speed.
- A forced database failure after final PDF staging rolled back the upload record
  and removed its unclaimed encrypted file. Retrying retained the acknowledged
  chunks and produced one final PDF, with no orphaned duplicate document.
- Chrome browser checks with intercepted synthetic API responses passed across
  admin, faculty, student and visitor at 1440px desktop/390px mobile: defaults,
  switches, category/navigation grid changes and mobile overflow. Admin/faculty/
  student resumed an interrupted transfer after refresh, reloaded during
  processing without uploading again, and opened the restored extracted details.
- All four roles passed actual clipboard success and rejected-write checks,
  read-only citation opening/format switching/download, and IEEE removal.
  These browser probes never sent synthetic users/files to the application DB.
- Desktop/mobile screenshots inspected; synthetic evidence and browser runner are
  under ignored `.local/upload-ui-check`. Local evidence is not deployed acceptance.
- PHP syntax: 18 changed/new PHP files checked; zero failures. Git whitespace
  checks passed. Existing worktree changes were preserved and nothing was staged.
