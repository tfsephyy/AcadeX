# AcadeX interface and upload-feedback release — November 1, 2026

Deployed to the existing `https://veload.site` installation on **November 1, 2026 at 8:03:37 PM Asia/Manila**. This is the current interface release and supersedes the earlier local-only UI checkpoints. The 128 MiB streaming storage/retrieval and bounded metadata extraction from the [metadata release](METADATA_AUTOFILL_2026-11-01.md) remain intact.

## Release identity and persistent resources

| Item | Current state |
| --- | --- |
| Application release | `/srv/acadex-staging/releases/acadex-ui-20261101T115952Z` |
| Immediate previous release | `/srv/acadex-staging/releases/acadex-ui-20261101T113521Z` |
| Frontend/backend serving paths | The three existing enabled public/private/preview Apache vhosts point to the current release |
| OCR source | WorkingDirectory intentionally remains `/srv/acadex-staging/releases/acadex-metadata-20261101/EduArchive-Backend-Laravel/ocr-service` |
| Persistent configuration | Existing shared `config/laravel.env` retained through the original symlink |
| Private storage | Existing shared `storage` retained through the original symlink |
| Runtime/source manifest | `ACADEX_UI_MANIFEST.json` in the release; records the deployed file hashes and source publication identity |
| Publication branch | `codex/ui-refinement` in the client-owned GitHub repository; the final commit is also recorded in the deployment manifest after publication |

The backend matched **120 source files** against the serving metadata release before preparation. The candidate cloned that working backend/dependencies and overlaid only the verified frontend and documentation. No backend code change, schema migration, seeder, key generation, database import or OCR restart was needed. Apache and PHP-FPM were gracefully reloaded. MySQL and the existing OCR worker were retained.

The actual PHP-FPM runtime was checked through its private socket against the candidate: Sodium streaming support present, `upload_max_filesize=128M`, `post_max_size=140M`, `memory_limit=512M`, effective file ceiling **134,217,728 bytes**. A shell PHP upload limit is not evidence of the web worker's effective limit.

## Interface changes

- Official client-supplied SVG artwork replaces the legacy project mark in public/auth pages, footer, sidebar, book imprint and favicon. App theme selection governs variants independently of the device theme.
- The final sidebar uses the **same light/dark SVG wordmark as the landing page**, at **116px**. Collapse retains that same SVG and scale inside a **41px symbol viewport**, hiding the outlined lettering and preserving the original cap/book artwork. It does not switch to the square app icon. A neutral inset makes the light-theme artwork readable on the existing institutional-green sidebar. The public wordmark remains 140px, or 128px in the narrow phone header.
- All role layouts share a 256px expanded sidebar and 72px collapsed icon rail. Navigation destinations, active states, accessible labels/tooltips, account actions and administrator notifications remain available. Mobile drawers retain full labels, focus containment, Escape and focus restoration.
- The earlier responsive refinements, consistent charcoal theme, dialogs, keyboard controls, readable tables and metadata Back navigation are included. Server authorization remains authoritative.
- Authentication route splitting, removal of an unused dependency/starter assets and viewport-based PDF canvases reduce avoidable loading/rendering work. Every PDF page retains its text and annotation layer. The measured pre-release 30-page reader reduced initial canvases from 30 to 1 under matching conditions; larger visible areas may render two nearby canvases. Search, last-page scrolling and fullscreen were checked.

## Upload delay diagnosis and corrected feedback

The old native progress element had no measured value and appeared as a static gray line in Chrome. Upload transfer and server document reading were shown as one combined phase. The old in-progress Skip action also aborted the browser request and uploaded the same file again; aborting a browser request does not terminate work already executing on the server. A second request can wait behind that work, particularly on the single-process local development server.

All three uploader roles now share one request handler and feedback component:

1. Actual browser transfer events drive a measured percentage when the total is known.
2. Once transfer finishes, an explicit document-reading or secure-saving phase shows a green indeterminate indicator and elapsed time. It does not invent an extraction percentage or promise an estimated finish time.
3. **Upload & enter manually**, chosen before upload, sends the existing `skip_extraction=1` flag and genuinely bypasses extraction.
4. **Use manual entry when ready**, chosen during an automatic request, keeps that single request and opens manual metadata entry when file preparation finishes. It does not resend the file or claim that the server's current work was cancelled.
5. Unknown transfer totals, longer waits, reduced motion, validation failure and retry have explicit feedback. A failed request restores the controls and retains the selected file.

Local OCR was not running, and Windows Application Control blocked its existing virtual-environment interpreter from starting. No security setting was weakened or bypassed. The deployed OCR service was active; a controlled image-only synthetic PDF was actually recognized by it in approximately **1.13 seconds**. This confirms that recognition path for the fixture, not a promise of that duration for large/scanned documents. Existing first-12-page sampling and bounded fallback behavior are unchanged.

## Production preservation and recovery

The final release's private backup is **`/var/backups/acadex/ui-20261101T120312Z`**. Four archives were created and passed compressed-file integrity checks:

- Consistent MySQL dump.
- Shared environment/key and persistent storage.
- Previous release, including dependency/source/build state.
- Enabled Apache/PHP-FPM/OCR/certificate-renewal configuration.

A new full restoration drill was not performed. The backups remain private on the existing server; no new hosting resource, instance, public service, billing upgrade or paid dependency was introduced.

During the switch, maintenance mode and the existing host-wide upload lock allowed active upload work to drain. Before opening the new release, logical row fingerprints matched across **19 non-transient data tables**, all **six existing accounts** remained, capstone count was unchanged, the environment checksum/application-key digest matched, and all **27 preexisting private files** retained their checksums. After live acceptance and its cleanup, the same 27-file inventory/checksums and environment checksum were checked again. The existing production data was never replaced with local accounts, fixtures or a database dump.

For a code-only rollback, validate and restore the backed-up Apache serving paths to the immediate previous release, retain the same shared environment/key/storage/database, then gracefully reload Apache/PHP-FPM and verify the routes. Both adjacent releases use the same streaming reader. Keep all old/new hashed assets needed by open browser sessions reachable. Do not import the backup database merely to undo frontend code, and do not roll back to a pre-streaming document reader.

## Verification and limits

| Check | Evidence |
| --- | --- |
| Frontend | Production build passed with `/api/v1`; quiet lint passed; **15 unit tests passed** |
| Backend | **75 tests / 705 assertions passed** using the guarded, approved schema-restricted disposable MySQL database; backend source remained unchanged afterward |
| Full responsive/theme matrix | **200 cases** across public and 21 active role routes at 320, 390, 768 and 1440px; no script errors, failed static assets or horizontal document overflow. This full matrix preceded the final logo-only adjustment |
| Final logo adjustment | **Eight role/theme cases** checked the exact landing SVG, unchanged SVG/scale during collapse, expanded/collapsed geometry and phone drawer. Public/theme reload checks were repeated after the final adjustment |
| Upload feedback | **22 cases** across Chromium, Firefox and WebKit; actual isolated Laravel API with a deliberate 3.5-second response delay to expose intermediate UI states; auto/manual/during-processing choices each sent exactly one request |
| Slow transfer / failure | Throttled transfer displayed a real intermediate **3%** value; server validation message, retained file and successful retry were verified |
| Other local workflows | Actual synthetic upload/extract/review/Back/save for student, faculty and admin at 320px; table keyboard scrolling, assistant response and visitor saved-panel behavior passed |
| Long PDF readers | Chromium for all roles; Firefox/WebKit for student: searchable text, last page, browser find, fullscreen, sidebar resizing and phone reflow passed |
| Live public site | Root/login/register 200; anonymous JSON user 401; CSRF token 200; Sanctum cookie initialization 204; WWW redirect preserved path/query; required assets loaded |
| Live authenticated UI/API | All four intended roles loaded their own page and authenticated API using five-minute verification tokens; sidebar retained the landing artwork on collapse; no script errors or failed static assets |
| Live upload/review | Administrator, faculty and student each uploaded a small controlled text PDF through the real API and reached populated metadata review. No capstone record was saved and no participant email was sent |
| Acceptance cleanup | All three new synthetic staged files/references were removed; all temporary verification tokens were deleted; zero probe tokens remained |
| OCR | Service healthy and controlled scanned PDF recognition passed; existing worker/source/runtime unchanged |
| Runtime identity | Deployed source/build hashes matched the **182-file release manifest** before documentation/publication annotations |

Live tokens were attached only to this site's API requests, never to font/third-party requests. They exercised role UI/API access without obtaining, resetting or entering the user's password. Ordinary password-form acceptance, physical-phone/native Safari acceptance, full assistive-technology certification, real email delivery, arbitrary huge-file/concurrent load, and every destructive/account action were not exhaustively repeated. The local backend regression suite never targeted the production database. Live acceptance used normal scoped API operations with controlled temporary artifacts, not migrations or database-test runners.

Browser timings from the earlier [performance review](../ui/2026-11-01-logo-performance-review.md) are lab observations rather than field measurements. Production gzip delivery and static ETag validators were confirmed; no new API/private-document cache was introduced. Large/scanned uploads can still take time, and the new UI reports that processing honestly.

Private machine-readable evidence remains under ignored `.local/upload-feedback-20261101/` on the working machine and the restricted release/backup directories on the server. Source/build changes and portable reports are published through Git; environments, credentials, password hashes, tokens, dumps, real documents, dependencies and generated caches are excluded.
