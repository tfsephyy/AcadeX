# PDF viewer hotfix — November 5, 2026 evening (Asia/Manila)

## Current release

- Frontend: `/srv/acadex-staging/frontend-releases/acadex-pdf-stall-20261105-v2/dist`.
- Backend: `/srv/acadex-staging/releases/acadex-20261105-final/EduArchive-Backend-Laravel`, unchanged.
- Source overlay: local `9d829d6` plus the two viewer files and two focused test files; not committed/pushed yet. `PDF_RELEASE.json` in the frontend directory records exact source/build hashes. Public index `index-Ber07sKt.js`; PDF chunk `usePdfBlob-Bn14H1ou.js`.
- Private recovery set: `/var/backups/acadex/pdf-stall-20261105`, database/environment/storage/frontend/routing archives checked before switching. Same-host archives are not independent disaster recovery or a restore drill.

## Diagnosis and changes

The client screenshot matches the hook's 180-second timeout. That message alone cannot identify the network as the cause. The submitted change still used 1 MiB requests, omitted a timer while waiting for response headers, reset based on rounded progress, and could rearm after loading succeeded. Late progress could also demote an already ready document back to loading.

The final viewer requests 64 KiB at a time, runs at most four requests per viewer, counts received bytes as activity, covers response-header/body stalls, and preserves ready/error states. Each request aborts after 60 seconds without bytes; continuously arriving data can take longer than 180 seconds. Existing authorization, encryption, original documents, metadata loading, retry and independent fullscreen behavior remain.

The large PDF has a flat page tree. PDF.js checks the last page and prefetches its page dictionaries. With old 1 MiB ranges this required approximately the entire 96,967,472-byte file before page 1 became available. A bounded 64 KiB run obtained page 1 after 177 requests and 11,574,064 bytes (about 88% fewer bytes). Parser timing was 35.9 seconds in that run, versus 21.9 seconds on the faster unbounded 1 MiB run: reduced transfer does not by itself prove lower latency on every connection. An unbounded small-range diagnostic returned HTTP 502; the bounded run succeeded. No server sizing change was made.

## Verification

- Local: 23 tests pass; quiet lint and production build pass, 829 modules.
- Tests include header/body stalls, retry after a stall, slow continuous bytes beyond 180 seconds, navigation cancellation, four-request limit, rounded-progress inactivity, ready/error timer cleanup, and late progress after readiness.
- Deployment: archive hashes, all 74 packaged file hashes, Apache configuration, matching public index, and `/up` HTTP 200 verified.
- Live authenticated student View Full Page: both current documents render (176 and 171 pages), no alert. The second document's last page renders inline.
- Fullscreen: both documents open and their final pages render. The 176-page document remains open beyond the old overall-timeout period without reverting to an error. Private local screenshot evidence is retained outside Git.
- Phone viewport: the attempted viewport override did not produce a verified phone-size layout. No physical-phone or client-device acceptance is claimed.
- Final operations: six users, two capstones, all 35 baseline storage file hashes and APP_KEY retained; zero owned diagnostic tokens, zero pending jobs and zero failed jobs. Apache, PHP-FPM, MySQL, database queue and OCR services active. All three private backup archive checksums pass.
- Public index and PDF bundle hashes match the final build. `/up`, `/login`, `/register` return 200; anonymous JSON `/api/v1/user` returns 401.
- Temporary workstation-only SSH rule removed; AWS displayed success and the original four inbound rules were observed unchanged. Verification completed before the user's November 5, 10:30 pm Asia/Manila deadline.

## Preservation and limits

Fresh baseline: six users, two capstones, 35 storage files. Storage hashes and APP_KEY match. Users/login audit activity changed during read-only preparation; normal browser checks also record views. Do not claim whole-database row equality. No backend code, database migration, document conversion, private environment replacement, key rotation, or queue/OCR restart belongs to this release.

The client's physical devices and connection have not been observed after deployment. This verifies the current documents in the authorized browser session; it does not guarantee every future malformed, unsupported or extremely large PDF. Admin/student/visitor share the modified transport, but independent authenticated admin and visitor browser journeys were not rerun for this frontend-only release.

## Rollback

Retain the old releases and hashed assets. For a frontend rollback, replace only the active frontend prefix in the enabled Apache public/preview configurations with the previous frontend path, run `apache2ctl configtest`, gracefully reload Apache, and verify the public index. The previous frontend is `/srv/acadex-staging/frontend-releases/acadex-pdf-stall-20261105`. The pre-hotfix frontend remains under `/srv/acadex-staging/releases/acadex-20261105-final/EduArchive-Frontend-React`. Keep the existing backend/shared environment/storage/database intact; do not restore a database merely to undo this frontend change.
