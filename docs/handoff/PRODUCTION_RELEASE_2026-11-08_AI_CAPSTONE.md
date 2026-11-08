# Production release — AI Capstone Research Assistant — November 8, 2026

## Serving release

- Backend: `/srv/acadex-staging/releases/acadex-20261108-ai-research-86c2487/EduArchive-Backend-Laravel`
- Frontend: `/srv/acadex-staging/frontend-releases/acadex-20261108-ai-research-86c2487/dist`
- Base repository commit: `86c2487646e7570aa74625583bad64d31c26734e` on
  `fix/staged-upload-quota-leak`.
- The release package included the working-tree chatbot controller, new
  `ChatbotAiService`, updated `config/services.php`, and the production React
  build. The package SHA-256 was
  `37d60be780a379f5b368408ecf46ec4384a21792da6f1dde6468ac08cfab3520`.
- The React build completed successfully with 846 modules. The package paths
  and each packaged file checksum were validated before extraction. The previous
  frontend's hashed assets were copied into the new `dist/assets` directory so
  open browser tabs can still finish loading.
- These runtime changes were synchronized to EC2 as a verified release archive.
  They were not committed or pushed to GitHub during this deployment; the local
  checkout remains the source for the working-tree changes and must be reconciled
  into the client's repository before a later Git-based release.

## Recovery set and persistent resources

Before switching paths, created the root-only recovery set at
`/var/backups/acadex/chatbot-release-20261108T022610Z` (directory mode `0700`).
It contains a consistent MySQL dump, the private Laravel environment file,
encrypted shared storage, the active backend/frontend releases, Apache and
PHP-FPM configuration, certificate renewal configuration, queue/scheduler units,
and OCR runtime metadata. The file checksums and all compressed archive integrity
checks passed.

The original environment file checksum remained
`5496344176954f9fa2134dc124f9b142eee4a67b9a85143d4461c55f2ceb40e9`. The new
backend `.env` and `storage` links still resolve to
`/srv/acadex-staging/shared/config/laravel.env` and
`/srv/acadex-staging/shared/storage`. No key regeneration, environment
replacement, document re-encryption, or storage migration occurred.

## Migrations, configuration and services

Ran `php artisan migrate --force`; Laravel reported **Nothing to migrate**.
The subsequent `migrate:status` connection check showed every production
migration as `Ran` and no pending migration. No production schema change was
made by this release.

`optimize:clear`, `config:cache`, `route:cache`, and `view:cache` completed on the
new backend release. Google identity configuration was retained in
`config/services.php` for existing sign-in.

The shared production environment currently has `GOOGLE_CLIENT_ID`, but no
`GROQ_API_KEY` or `GEMINI_API_KEY`. The assistant therefore uses its deterministic
local response fallback. No provider keys were copied from the workstation and
no Groq/Gemini requests were made. Add provider keys only through the client's
private environment channel, then rebuild the Laravel configuration cache to
activate those providers.

Apache syntax passed before the switch. Apache and PHP-FPM were gracefully
reloaded with the new paths. The queue restart signal was broadcast, and both
the queue worker and Laravel scheduler are active with the new backend working
directory. OCR was not restarted or changed. The previous backend/frontend
release directories remain available for rollback.

## Smoke checks

- `https://veload.site/`: HTTP 200.
- The new frontend entry JavaScript and CSS both returned HTTP 200:
  `index-7kWkGdvA.js` and `index-B37yQty7.css`.
- Anonymous JSON `GET /api/v1/user` returned HTTP 401.
- `migrate:status` connected to production MySQL and showed no pending
  migrations.
- Apache, PHP-FPM, MySQL, queue, and scheduler were active after the switch.

No production login, account workflow, upload, or feature regression suite was
run, as directed for this release. The requested frontend build and standard
live smoke checks were completed.

## Rollback

Restore the Apache and systemd working-directory paths from the saved release
configuration or set them back to the November 8 staged-upload release
`acadex-20261108-6fa3fac`, validate Apache syntax, reload PHP-FPM and Apache,
then realign the queue and scheduler. Keep the current shared environment,
application key, database and encrypted storage in place. No database restore is
needed for this release because no migration was pending or applied.
