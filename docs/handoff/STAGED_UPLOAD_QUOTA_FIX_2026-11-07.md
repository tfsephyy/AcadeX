# Staged Upload Quota Leak Fix and Lifecycle Management - November 7, 2026

## Overview

This maintenance release fixes a production bug where uploading PDFs fails with 422 validation errors:
- `"Your pending uploads have reached the storage limit. Submit an existing upload or contact the administrator."` (from `DocumentUploads::stage`)
- `"Pending uploads have reached your storage limit. Submit or dismiss an existing upload first."` (from `UploadTransferController::start`)

While initially observed with large files (~94 MiB+), the quota leak accumulated leftover unsubmitted staged uploads and unfinished transfers until the user's quota (256 MiB or 20 uploads) was completely exhausted. Once exhausted, uploads of **any** size (even small 1 MB files) failed permanently.

**This fix was deployed on November 8, 2026 from source commit `6fa3fac`; see the production checks below.**

---

## Root Causes (A–E)

1. **A. Expired staged uploads still counted indefinitely against quota:**
   `DocumentUpload` records are assigned `expires_at = now() + 24h`. While `DocumentUploads::resolve()` rejects expired rows, the quota calculation queries in `DocumentUploads::stage()` and `UploadTransferController::start()` failed to filter by `expires_at > now()`. As a result, all historical unsubmitted uploads counted against the user's quota forever.

2. **B. Lack of prune cleanup for expired staged uploads:**
   `routes/console.php` only scheduled `acadex:prune-upload-transfers`, which pruned expired chunk transfers from `upload_transfers`. Staged `document_uploads` rows and their underlying encrypted files were never pruned, causing both database rows and encrypted storage usage to grow unbounded.

3. **C. "Dismiss" did not release server space once transfer completed:**
   In `capstoneUploadManager.js`, `dismiss()` only called `DELETE /uploads/transfers/{transferId}` if `upload_id` was absent. Once a transfer finished and staged an upload (`upload_id` present), dismissal only cleared client state with no server API to delete the staged document upload.

4. **D. Leaving Review page retained staged files against quota:**
   Backing out of review without submitting kept the staged upload. Back now asks for confirmation and discards that upload. Advancing to additional information or successfully submitting must retain/claim the upload; those actions do not call discard.

5. **E. Failed finalization locked reservations for 24 hours:**
   When `UploadTransferController::complete()` encountered a finalization failure (such as quota validation error), the `upload_transfers` row remained unexpired with `upload_id = NULL`, continuing to reserve its full byte size for 24 hours. Re-selecting the file created a new transfer, counting the same bytes twice.

---

## Summary of Changes

### 1. Unified Pending Usage Calculation (`DocumentUploads::pendingUsage`)
- Extracted `DocumentUploads::pendingUsage(User $user): array{count: int, bytes: int}`.
- Added `->where('expires_at', '>', now())` to ignore expired staged uploads in quota queries.
- Both `DocumentUploads::stage()` and `UploadTransferController::start()` now use this single method, preventing logic divergence.
- Replaced mismatched quota messages with a shared, informative message including user's current usage and limit formatted via `UploadLimits::humanBytes`:
  `"You have X unsubmitted upload(s) using Y of your Z limit. Submit or discard them (they expire automatically after 24 hours)."`

### 2. Scheduled Prune Command (`acadex:prune-staged-uploads`)
- Implemented `App\Console\Commands\PruneStagedUploads` (`acadex:prune-staged-uploads`).
- Finds `document_uploads` where `capstone_id IS NULL` and `expires_at <= now()`.
- Locks the owner row before the upload/transfer rows, matching the allocation and submission lock order.
- Locks each row; skips if `processing_status = 'processing'` and `processing_started_at` is under 15 minutes old.
- Skips with a warning log if the file path is referenced by any existing capstone (`pdf_path`, `imrad_path`) or resource (`file_path`).
- Removes existing leftover chunk files before deleting the upload row and cascading transfer rows, then deletes the encrypted file after the row transaction commits. Missing files are tolerated; failed chunk cleanup leaves the row for a later retry.
- Registered in `routes/console.php` with `->hourly()->withoutOverlapping()`. Picks up automatically via `php artisan schedule:work` / `acadex-scheduler.service`.

### 3. Discard API for Staged Uploads
- Added route `DELETE /api/v1/uploads/{upload}` with `->whereUuid('upload')` in `routes/api.php`.
- Implemented `CapstoneController::discardUpload()`:
  - Scoped to authenticated user (`where('user_id', auth id)`).
  - Returns 404 if not found/unowned (idempotent for repeat calls).
  - Returns 409 if already submitted (`capstone_id !== null`).
  - Returns 409 if active processing started within 15 minutes.
  - Refuses to delete a file path still referenced by a capstone or resource.
  - Locks the owner row first, removes existing transfer chunk files before deleting the upload row, then removes the encrypted file after commit.
- Updated `capstoneUploadManager.js`:
  - `dismiss()` calls `DELETE /uploads/{upload_id}` (fire-and-forget, ignoring 404) if `upload_id` exists and is not submitted.
  - Allows dismissal in phase `queued` as well as failed/cancelled/completed states.
- Updated `ReviewExtractedDataPage.jsx`:
  - Removed incorrect `uploadManager.dismiss()` call on step progression (`handleNext`).
  - Added confirmation dialog on `Back` navigation that discards the staged upload and dismisses the manager.
- Updated `UploadActivity.jsx`:
  - Renders `Dismiss` button when upload is not actively transferring or in processing phase (including `queued`).

### 4. Immediate Reservation Release on Finalization Failure
- In `UploadTransferController::complete()`: if `CapstoneController::upload()` returns `>= 400` or throws `ValidationException`, the transfer record is immediately expired (`expires_at = now()`).
- This instantly frees the byte reservation so subsequent upload attempts are not blocked by duplicate counting.
- Temporary chunk files are retained until pruned. A retry using that expired transfer ID receives HTTP 410 with “This upload expired. Select the PDF again.” The upload activity displays that instruction; the user dismisses it and selects the PDF again to start a fresh transfer.

### 5. Increased Default Quota
- Updated `config/acadex.php` default `max_pending_upload_bytes` from `268435456` (256 MiB) to `1073741824` (1 GiB), properly accommodating multiple 128 MiB upload attempts.
- Updated `.env.example` and `.env.production.example` comments and default values.

---

## Verification Evidence

### Backend Tests
Ran full test suite using the isolated disposable MySQL runner:
```
$env:APP_ENV='testing'; $env:DB_CONNECTION='mysql'; $env:DB_DATABASE='acadex_remediation_test_5954d321a1'; php artisan test --env=testing
```
- **Latest full-suite result:** `112 passed (1021 assertions), 0 failed` in 30.07s.
- **Focused staged-upload result:** `13 passed (69 assertions), 0 failed` in 4.67s.
- **Feature Tests in `Tests\Feature\StagedUploadQuotaAndPruneTest` (13 passed):**
  1. `✓ expired staged upload does not count toward quota in stage and start`
  2. `✓ unexpired staged uploads still count toward quota with actionable message`
  3. `✓ delete uploads endpoint owner can discard unsubmitted upload`
  4. `✓ delete uploads endpoint other user gets 404`
  5. `✓ delete uploads endpoint submitted upload returns 409`
  6. `✓ delete uploads endpoint recent processing returns 409`
  7. `✓ delete uploads endpoint repeat call returns 404`
  8. `✓ discard removes transfer chunks and cascaded transfer row`
  9. `✓ prune staged uploads command` (including chunk cleanup, capstone/resource references, active processing, and summary count)
  10. `✓ finalize failing on quota does not leave reservation` (same transfer ID returns 410 with reselection instructions)
  11. `✓ regression quota upload discard sequence`
  12. `✓ unexpired staged rows count even when the encrypted file is missing`
  13. `✓ discard does not remove a file referenced by a resource`
- **Updated Regression Test in `Tests\Feature\DeploymentHardeningTest`:**
  - `✓ pending count ignores expired allocations and rejection removes only new file`

### Frontend Tests, Lint, and Build
In `EduArchive-Frontend-React`:
```
npm test
npm run lint
$env:VITE_API_BASE_URL='/api/v1'; npm run build
```
- **Tests:** `50 passed (0 failed, 14 in capstoneUploadManager.test.js)`
  - `✓ dismiss with upload_id calls DELETE /uploads/{id}`
  - `✓ dismiss without upload_id calls DELETE /uploads/transfers/{transferId}`
  - `✓ dismiss ignores 404 error from DELETE /uploads/{id}`
  - `✓ dismiss while uploading or processing does nothing`
  - `✓ dismiss allowed in phase queued`
- **Expired-finalization recovery:** a quota 422 followed by same-transfer 410 shows the reselection instruction; dismissal clears the expired activity and a new selection starts a fresh transfer.
- **Lint:** `0 errors, 32 warnings` (React hook dependency warnings)
- **Build:** `✓ built in 19.40s` (846 modules transformed cleanly)
- **Release artifact:** clean worktree at commit `6fa3fac`, `npm ci --no-audit --no-fund`, then `VITE_API_BASE_URL=/api/v1 npm run build`; `✓ built in 12.88s` (846 modules transformed). This artifact excludes unrelated uncommitted local PDF-viewer edits.

The backend process-scoped variables match the schema configured in `.env.testing`; `SecurityTestCase` checks the active database identity before starting any test transaction. No tests targeted the local application database or production.

---

## Deployment Notes

1. **No database migrations required:** All changes use the existing schema.
2. **Scheduler:** The new `acadex:prune-staged-uploads` command is registered in `routes/console.php` and will be automatically invoked by the running `acadex-scheduler.service` (`php artisan schedule:work`).
3. **Configuration cache:** Run `php artisan config:cache` after pulling code to update the default `max_pending_upload_bytes` setting if not overridden in `.env`.
4. **Immediate cleanup (optional):** A one-time execution of `php artisan acadex:prune-staged-uploads` can be run immediately following deployment to clean up any historical expired staged uploads.

5. **Pending list UI:** The optional `GET /uploads/pending` endpoint and dedicated discard control in the upload-error view were skipped to keep the change bounded; upload activity dismissal and review Back actions handle discards.

## Deployment status

Deployed November 8, 2026 from commit `6fa3fac` on branch `fix/staged-upload-quota-leak`.

- Backend: `/srv/acadex-staging/releases/acadex-20261108-6fa3fac/EduArchive-Backend-Laravel`
- Frontend: `/srv/acadex-staging/frontend-releases/acadex-20261108-6fa3fac/dist`
- Recovery set: `/var/backups/acadex/staged-upload-fix-20261107T160717Z-retry1` (database, active code/build, environment, encrypted storage, Apache and service configuration; checksums verified)
- `php artisan config:cache` confirms `max_pending_upload_bytes=1073741824` and `max_pending_uploads=20`; no migration was added.
- Apache/PHP-FPM, `acadex-queue.service` and `acadex-scheduler.service` are active on the new release. The scheduler lists both upload-prune commands hourly with `withoutOverlapping()` configured for staged uploads.
- One-time `php artisan acadex:prune-staged-uploads` removed **20** expired unclaimed uploads. Claimed, active processing and referenced paths remain protected by the command checks.
- Production smoke checks: `https://veload.site/` returned **200**; an anonymous request to the protected upload-status endpoint returned **401**; the public page rendered in the user's Chrome session.
- No production login, upload or submission was performed. The 128 MiB per-file limit, original `APP_KEY`, encrypted document format, and 2 GiB disk reserve remain unchanged.
