# Production redeployment — November 7, 2026

## Release

- Backend source: `a6025cf5a782b37dad9260352794df8b39f36473` from
  `release/ui-refinement`.
- Backend release: `/srv/acadex-staging/releases/acadex-20261107-a6025cf`.
- Frontend release: `/srv/acadex-staging/frontend-releases/acadex-20261107-a6025cf/dist`.
- The frontend build includes the retained local PDF timeout/range changes in
  `ProgressivePdfDocument.jsx` and `usePdfBlob.js`. The backend `composer.lock`
  matched the previous production release; its locked `vendor` directory was
  copied into the new release. The live frontend index SHA-256 is
  `35a10316d533380201b214b735a135ec5ab578960e9d2ba74bb543e0447c7347`.
- Previous release directories remain intact. The previous frontend's hashed
  assets were retained in the new `dist/assets` directory for open tabs.

## Backup and migrations

Before changing production source or schema, created the root-only recovery set
at `/var/backups/acadex/redeploy-20261107T133643Z`. It includes a consistent
compressed MySQL dump, the active release and frontend build, the production
environment file, persistent storage, private temporary files, Apache/PHP-FPM/
systemd/certificate-renewal configuration, OCR package inventory, model-cache
location, and preservation manifests. The OCR virtual environment and model cache
were not changed. The SQL dump's gzip check, runtime archive listing, and every
backup checksum passed.

The live database had 7 users, 10 capstones, 30 document uploads, 8 citation
events, and no pending or failed jobs. Applied only these reviewed additive
migrations:

- `2026_11_07_000001_add_citation_copy_idempotency`
- `2026_11_07_000002_create_upload_transfers`

Both now show `Ran`; no migrations remain pending. The new transfer table is
empty. The saved production environment file checksum and all 285 pre-release
storage-file hashes still match. Database row counts for users, capstones,
document uploads, jobs, failed jobs, and citation events match the backup.

## Serving and operations

Updated the active Apache frontend and Laravel document-root paths to this
release. Restarted `acadex-queue.service` with the new backend working directory.
Added and enabled `acadex-scheduler.service`, running `php artisan schedule:work`
as `www-data`, because the release schedules hourly expired-upload-transfer
cleanup. The OCR service remains on its existing November 1 release and its
process start time did not change.

The SSH security group received a restricted `143.44.156.189/32` rule to enable
this release. At the user's direction the rule remains for future redeployments;
it is useful only while the operator's public IP remains the same. The two
pre-existing `/32` SSH rules remain unchanged.

## Deployed checks

- `/`, `/login`, and `/register` returned HTTP 200 over HTTPS.
- The live root HTML hash matched the new release. Its main JavaScript and CSS
  URLs returned bytes matching the release files.
- Unauthenticated JSON `GET /api/v1/user` returned 401.
- The new resumable-transfer API routes appear in Laravel's route list, the
  hourly cleanup appears in `schedule:list`, and production migration status has
  no pending entries.
- Apache, PHP-FPM, MySQL, the database queue, the Laravel scheduler, and OCR are
  active. The environment checksum, existing database row counts, and all
  285 storage-file hashes match the pre-release backup.

The client had already tested the feature workflows locally. No production login,
upload, role-specific action, or real document workflow was replayed against
client accounts or documents during this redeployment.
