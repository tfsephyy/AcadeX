# AcadeX local setup

## Current November 1 follow-up

The deployed interface and upload feedback are documented in [the current release report](docs/handoff/UI_RELEASE_2026-11-01.md). The four user-selected local role accounts were subsequently aligned with their deployed sign-in records after a private local backup; [the account comparison](docs/ui/2026-11-01-local-account-comparison.md) explains that local-only setup. No account password belongs in this file.

The normal local frontend/API remain available, but Windows Application Control currently blocks the existing OCR virtual-environment interpreter from starting. Do not disable or bypass that security control. Embedded-text PDFs can still use the local extraction path; scanned extraction requires a working trusted OCR runtime. The deployed OCR service passed a controlled scanned-PDF recognition check. Local and production data remain separate.

## November 1, 2026 local repair and UI continuation

The current local preview is `http://localhost:5173/`, using the Laravel API at `http://localhost:8000/api/v1`. The database is the original `acadex_local`, not `EduArchiveDB`. The latter name in the ignored backend `.env` caused the session query's MySQL 1049 error; correcting that local value restored a successful CSRF/session response.

Before the correction, the original local environment and all 24 existing database tables/rows were backed up privately under `.local/ui-local-backup-20261101-094847/`. The four pending migrations already present in this repository were then applied: secure authentication state, document uploads, capstone approval backfill, and publication default. All 31 migrations are now recorded locally. The application key and original user's stored values/password were preserved. No reset, fresh migration, replacement database, production action or administrator password change was performed.

The role/mobile browser review used a separate loopback API and the existing approved, schema-restricted disposable database, with private test storage and array mail. Those synthetic users/documents are separate from the regular preview. See [the current verification report](docs/ui/2026-11-01-role-mobile-verification.md). The October 13 setup and test results below are historical.

Repository: https://github.com/tfsephyy/AcadeX.git

Cloned directly into `C:\Users\ASUS\Desktop\EduArchive` on branch `main`, starting at commit `4560e3f`.

## Run the application

Keep MySQL running in Laragon, then run these commands from the repository root:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\start-local.ps1
```

The launcher starts the Laravel API, queue worker, React dev server, and OCR service in the background. Logs and process receipts are stored in `.local`. OCR may take time to load models before its health endpoint becomes available. Running the launcher again preserves services already started by it and refuses occupied ports belonging to other processes.

| Service | Address |
| --- | --- |
| React frontend | http://localhost:5173 |
| Laravel API | http://localhost:8000/api/v1 |
| Laravel health | http://localhost:8000/up |
| OCR health | http://localhost:8001/health |
| OCR API documentation | http://localhost:8001/docs |

Use `localhost` for the frontend, matching its API cookies and configured CORS origin.

Provision the administrator with the private interactive `php artisan acadex:bootstrap-admin` command.
Do not store administrator passwords in documentation or screenshots. Rotate any previously disclosed credential privately and invalidate its old sessions before public use.

The database begins with roles and the administrator account. It contains no capstone documents or sample student/faculty accounts.

Stop the services with:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\stop-local.ps1
```

The stop script checks recorded process identities and stops their child processes. Laragon and MySQL remain running. To run the core application without OCR, pass `-WithoutOcr` to the start script.

## Installed configuration

- Node.js 22.18.0 and npm 10.9.3, using the existing installation.
- PHP 8.3.16 and Composer 2.8.11, using the existing installation.
- MySQL 8.4.3 at `127.0.0.1:3306`.
- New database `acadex_local` and a scoped `acadex_local` database user. A generated password is stored only in the ignored backend `.env`.
- At initial setup: Laravel application key generated; 27 migrations and the repository seeder applied; public storage link created. The November 1 repair retained that key and brought the existing local schema to 31 migrations without reseeding.
- Frontend dependencies installed with `npm.cmd ci`; backend Composer dependencies installed from its lockfile.
- Backend Vite dependencies installed, with a new `EduArchive-Backend-Laravel/package-lock.json`.
- OCR uses a separate Python 3.11.17 environment at `EduArchive-Backend-Laravel/ocr-service/.venv`. The managed interpreter is in the user's uv Python directory; the system's default Python 3.13 is unchanged.
- Project-local uv executable: `.local/python-tools/bin/uv.exe`.
- PaddleOCR weights downloaded to `%USERPROFILE%/.paddleocr`.
- Mail uses Laravel's `log` mailer. Verification and password reset messages appear in `EduArchive-Backend-Laravel/storage/logs/laravel.log`; email delivery requires separate SMTP configuration.

The backend `.env` and OCR `.env` are ignored by Git. The OCR launcher explicitly sets host and port; the current OCR code does not read its `.env` configuration template.

## Setup fixes

The September 22 approval migration duplicated `approved_by` and `approved_at`, which already exist in the original capstone migration. It also overlapped the September 26 `rejection_reason` migration. Their ownership is now separated, and column/index checks allow recovery from a partial MySQL migration. Rollback of the September 22 migration preserves the original approval columns.

The OCR requirements now explicitly include `setuptools<81`, needed by PaddlePaddle's runtime import of `setuptools.command.easy_install` in a fresh virtual environment.

## Verification on October 13, 2026

- React production build: PASS, with existing duplicate JSX `style` and large bundle warnings.
- Backend Vite production build: PASS.
- Laravel tests: PASS, 2 basic example tests / 2 assertions. These are not comprehensive feature tests.
- MySQL migration and seed: PASS, all 27 migrations; also verified from scratch in a separate temporary database and removed that test database afterward.
- Browser: landing page and seeded administrator login verified in Chrome; admin dashboard loaded against the local API.
- OCR dependency compatibility: PASS (`uv pip check`).
- OCR health, synthetic image recognition, and embedded PDF text extraction: PASS.
- Frontend lint: FAIL, 71 existing errors and 30 warnings. These remain outside the setup fixes.

This checks local startup and selected flows. Upload/approval workflows, all user roles, and real email delivery have not been fully tested.

## Useful maintenance commands

Frontend:

```powershell
Set-Location .\EduArchive-Frontend-React
npm.cmd ci
$acadexBuildApi = $env:VITE_API_BASE_URL
try {
    $env:VITE_API_BASE_URL = '/api/v1'
    npm.cmd run build
} finally {
    $env:VITE_API_BASE_URL = $acadexBuildApi
}
npm.cmd run lint
```

Backend (from the repository root):

```powershell
Set-Location .\EduArchive-Backend-Laravel
composer.bat install --no-interaction --prefer-dist
npm.cmd ci
npm.cmd run build
php artisan migrate --no-interaction
php scripts/run-security-tests.php
```

Run that backend test command only after configuring the approved schema-restricted disposable database through `.env.testing`; see the client handoff's testing section. Never use the ordinary local database or production as the regression-test target.

OCR dependencies (from the repository root):

```powershell
& .\.local\python-tools\bin\uv.exe pip install --python .\EduArchive-Backend-Laravel\ocr-service\.venv\Scripts\python.exe -r .\EduArchive-Backend-Laravel\ocr-service\requirements.txt
```
