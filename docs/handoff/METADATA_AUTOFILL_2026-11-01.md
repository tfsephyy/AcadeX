# Metadata autofill correction — November 1, 2026

Deployed **November 1, 2026, 4:54:58 PM Asia/Manila** to the existing AWS instance serving `https://veload.site`, under the user's continuing deployment authorization. Current release: `/srv/acadex-staging/releases/acadex-metadata-20261101`. This supersedes the initial large-PDF manual-only metadata fallback documented in [the 128 MiB release](UPLOADS_128MIB_2026-11-01.md). The 128 MiB upload ceiling and streaming reader remain in place.

## Cause and resulting behavior

The first safety release deliberately bypassed metadata extraction above 20 MiB to avoid loading a large original into the whole-PDF parser. The review form still claimed automatic extraction. Additionally, the reported scanned PDF contains a tiny scanner-watermark text layer on each page: Python's previous `if embedded` check incorrectly skipped image OCR, so simply allowing a large file through would not have restored its metadata.

- Files above 20 MiB now use the existing Linux Ghostscript installation to create a private working PDF containing at most the first 12 pages. The complete stored original is not changed. Smaller files retain the existing extraction pipeline.
- The sample is limited to the existing automatic-processing ceiling (at most 20 MiB); Linux `prlimit` bounds address space to 512 MiB, CPU to 30 seconds and output size. Process wall time is limited to 40 seconds. Temporary files use the private directory and are removed after processing or failure. These are process budgets, not a promise of zero memory pressure under arbitrary load.
- The existing host-wide upload-processing lock and quotas remain active. PHP final-submission/full-text indexing guards remain; this change does not promise full-document indexing for large files.
- Image OCR now runs when the embedded text has fewer than 80 trimmed characters. Recognized text replaces sparse text when available; empty OCR preserves readable short embedded text. Placeholder `Untitled` / `Unknown Author` are not treated as extracted suggestions.
- Student, faculty and admin upload navigation passes extraction status and scope to the shared review page. Its notice accurately describes first-12-page suggestions or manual entry when extraction fails. Layout is unchanged. The upload is securely staged before extraction, and a scanning failure does not discard it.
- Automatically suggested fields are title, authors, year, program, abstract and keywords. Category remains a user choice. Information outside the sample, unusual layouts or unreadable scans may still require manual correction.

## Deployment and preserved resources

- Private backup: `/var/backups/acadex/metadata-20261101T085433Z`. Database dump, persistent environment/storage, previous release and service configuration were backed up; compressed-file integrity checks passed. A full restore drill was not repeated.
- All **26 preexisting private files** retained their checksums across the switch. The environment checksum and application-key digest were unchanged. No schema migration, seeder, database restore, existing-document conversion or account reset ran.
- Enabled Apache public/private/preview vhost paths now reference the current release. Apache configuration passed; Apache and PHP-FPM reloaded. Actual FPM settings remain `upload_max_filesize=128M`, `post_max_size=140M`, `memory_limit=512M`, effective file ceiling **134,217,728 bytes**.
- The existing `acadex-ocr` unit's WorkingDirectory now points to this release's `EduArchive-Backend-Laravel/ocr-service`. The existing single worker restarted. Its user, environment, shared virtual environment, models, ExecStart and worker count were preserved. Do not start a duplicate model worker or loosen the private virtual-environment permissions.
- No AWS resource was created/resized; no plan or paid service was selected. AWS quota/credit eligibility and future usage costs are not certified by these checks. DNS remains unchanged while registrar access is unavailable.
- `ACADEX_METADATA_MANIFEST.json` identifies the overlay and its 15 runtime/build files, verified against deployed SHA-256 values. The parent is local commit `273373a9a662402b4def798869f198ae705a886f`. Frontend built assets are deployed; older hashed assets were retained for open sessions.

## Fresh verification

| Check | Result |
| --- | --- |
| Guarded full backend suite | **75 tests / 705 assertions passed**, isolated schema-restricted disposable MySQL; includes all three uploader roles, large-PDF autofill and safe sampling-failure fallback |
| Frontend | **8 tests passed**, lint passed, production build passed; existing large-bundle warning remains |
| Python | **3 sparse-text/OCR fallback tests and 2 preprocessing tests passed** |
| Native Linux synthetic sample | 100.01 MiB / 15-page input reduced to a 7,883-byte / 12-page working sample; all six known metadata fields matched; original unchanged; PHP peak 20 MiB |
| Native failure | Invalid PDF rejected; sample cleaned up and source unchanged |
| Reported uploaded PDF | Deployed extractor returned nonempty title, author, year, program, abstract and keywords from the actual **93.16 MiB** document; approximately **51.27 seconds**, PHP peak **32 MiB**; stored encrypted original checksum unchanged |
| Public routes / service state | Root and login 200, anonymous JSON user 401, CSRF check 200; Apache, FPM, MySQL and OCR active; OCR health passed |
| Deployment identity | All 15 runtime/build manifest file hashes matched; OCR WorkingDirectory confirmed against live systemd state |

The reported-document diagnostic was read-only against its scoped upload record; it used a restricted temporary copy, removed it afterward, and emitted field-presence booleans rather than private document text. Production was not used as a database-test target. This confirms extractor output, not a fresh browser submission of the user's form or general concurrency/capacity certification. The already-open blank review form must return to upload and upload again to receive the new suggestions.

## Recovery and future maintenance

Preserve the production key/environment/database/encrypted-storage recovery set together. Continue to retain the streaming reader introduced by the 128 MiB release: older pre-streaming readers cannot read newly accepted documents. To disable automatic processing temporarily, use the existing extraction setting while keeping storage/retrieval compatible. To roll back this metadata overlay to the initial 128 MiB release, restore both Apache paths and the OCR unit's prior WorkingDirectory using the backed-up configurations, restart the existing OCR worker, verify health, and recheck application routes. Do not overwrite current data with the backup or discard uploads accepted after it. DNS/Cloudflare changes are separate and remain pending the client's registrar access.
