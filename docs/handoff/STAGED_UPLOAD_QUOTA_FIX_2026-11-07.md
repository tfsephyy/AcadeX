# Staged Upload Quota Leak Fix and Lifecycle Management - November 7, 2026

## Overview

This maintenance release fixes a production bug where uploading PDFs fails with 422 validation errors:
- `"Your pending uploads have reached the storage limit. Submit an existing upload or contact the administrator."` (from `DocumentUploads::stage`)
- `"Pending uploads have reached your storage limit. Submit or dismiss an existing upload first."` (from `UploadTransferController::start`)

While initially observed with large files (~94 MiB+), the quota leak accumulated leftover unsubmitted staged uploads and unfinished transfers until the user's quota (256 MiB or 20 uploads) was completely exhausted. Once exhausted, uploads of **any** size (even small 1 MB files) failed permanently.

**This fix is implemented, covered by tests, and verified locally. It is NOT yet deployed to production.**

---

## Root Causes (A–E)

1. **A. Expired staged uploads still counted indefinitely against quota:**
   `DocumentUpload` records are assigned `expires_at = now() + 24h`. While `DocumentUploads::resolve()` rejects expired rows, the quota calculation queries in `DocumentUploads::stage()` and `UploadTransferController::start()` failed to filter by `expires_at > now()`. As a result, all historical unsubmitted uploads counted against the user's quota forever.

2. **B. Lack of prune cleanup for expired staged uploads:**
   `routes/console.php` only scheduled `acadex:prune-upload-transfers`, which pruned expired chunk transfers from `upload_transfers`. Staged `document_uploads` rows and their underlying encrypted files were never pruned, causing both database rows and encrypted storage usage to grow unbounded.

3. **C. "Dismiss" did not release server space once transfer completed:**
   In `capstoneUploadManager.js`, `dismiss()` only called `DELETE /uploads/transfers/{transferId}` if `upload_id` was absent. Once a transfer finished and staged an upload (`upload_id` present), dismissal only cleared client state with no server API to delete the staged document upload.

4. **D. Leaving Review page retained staged files against quota:**
   When users navigated back from `ReviewExtractedDataPage.jsx` to start over or cancel, the staged upload was not discarded. Furthermore, navigating forward called `dismiss()`, which previously risked clearing manager state.

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
- Locks each row; skips if `processing_status = 'processing'` and `processing_started_at` is under 15 minutes old.
- Skips with a warning log if the file path is referenced by any existing capstone (`pdf_path`, `imrad_path`) or resource (`file_path`).
- Cleans up leftover chunk files of any related transfer, deletes the row, and deletes the encrypted file from storage.
- Registered in `routes/console.php` with `->hourly()->withoutOverlapping()`. Picks up automatically via `php artisan schedule:work` / `acadex-scheduler.service`.

### 3. Discard API for Staged Uploads
- Added route `DELETE /api/v1/uploads/{upload}` with `->whereUuid('upload')` in `routes/api.php`.
- Implemented `CapstoneController::discardUpload()`:
  - Scoped to authenticated user (`where('user_id', auth id)`).
  - Returns 404 if not found/unowned (idempotent for repeat calls).
  - Returns 409 if already submitted (`capstone_id !== null`).
  - Returns 409 if active processing started within 15 minutes.
  - Deletes related transfer chunk files, deletes the upload row, and removes the encrypted storage file.
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
- Temporary chunk files are retained until pruned, allowing standard cleanup.

### 5. Increased Default Quota
- Updated `config/acadex.php` default `max_pending_upload_bytes` from `268435456` (256 MiB) to `1073741824` (1 GiB), properly accommodating multiple 128 MiB upload attempts.
- Updated `.env.example` and `.env.production.example` comments and default values.

---

## Verification Evidence

### Backend Tests
Ran full test suite using the isolated disposable MySQL runner:
```
php artisan test --env=testing
```
- **Result:** `110 passed (1007 assertions), 0 failed`
- **Duration:** 30.15s
- **New Feature Tests in `Tests\Feature\StagedUploadQuotaAndPruneTest` (11 passed):**
  1. `✓ expired staged upload does not count toward quota in stage and start`
  2. `✓ unexpired staged uploads still count toward quota with actionable message`
  3. `✓ delete uploads endpoint owner can discard unsubmitted upload`
  4. `✓ delete uploads endpoint other user gets 404`
  5. `✓ delete uploads endpoint submitted upload returns 409`
  6. `✓ delete uploads endpoint recent processing returns 409`
  7. `✓ delete uploads endpoint repeat call returns 404`
  8. `✓ discard removes transfer chunks and cascaded transfer row`
  9. `✓ prune staged uploads command`
  10. `✓ finalize failing on quota does not leave reservation`
  11. `✓ regression quota upload discard sequence`
- **Updated Regression Test in `Tests\Feature\DeploymentHardeningTest`:**
  - `✓ pending count ignores expired allocations and rejection removes only new file`

### Frontend Tests, Lint, and Build
In `EduArchive-Frontend-React`:
```
npm test
npm run lint
npm run build
```
- **Tests:** `49 passed (0 failed, 13 in capstoneUploadManager.test.js)`
  - `✓ dismiss with upload_id calls DELETE /uploads/{id}`
  - `✓ dismiss without upload_id calls DELETE /uploads/transfers/{transferId}`
  - `✓ dismiss ignores 404 error from DELETE /uploads/{id}`
  - `✓ dismiss while uploading or processing does nothing`
  - `✓ dismiss allowed in phase queued`
- **Lint:** `0 errors, 32 warnings` (pre-existing exhaustive-deps warnings preserved)
- **Build:** `✓ built in 12.27s` (846 modules transformed cleanly)

---

## Deployment Notes (When Approved)

1. **No database migrations required:** All changes use the existing schema.
2. **Scheduler:** The new `acadex:prune-staged-uploads` command is registered in `routes/console.php` and will be automatically invoked by the running `acadex-scheduler.service` (`php artisan schedule:work`).
3. **Configuration cache:** Run `php artisan config:cache` after pulling code to update the default `max_pending_upload_bytes` setting if not overridden in `.env`.
4. **Immediate cleanup (optional):** A one-time execution of `php artisan acadex:prune-staged-uploads` can be run immediately following deployment to clean up any historical expired staged uploads.
