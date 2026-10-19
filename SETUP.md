# AcadeX local setup

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
- Laravel application key generated; all 27 migrations and the repository seeder applied; public storage link created.
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
npm.cmd run build
npm.cmd run lint
```

Backend (from the repository root):

```powershell
Set-Location .\EduArchive-Backend-Laravel
composer.bat install --no-interaction --prefer-dist
npm.cmd ci
npm.cmd run build
php artisan migrate --no-interaction
php artisan test
```

OCR dependencies (from the repository root):

```powershell
& .\.local\python-tools\bin\uv.exe pip install --python .\EduArchive-Backend-Laravel\ocr-service\.venv\Scripts\python.exe -r .\EduArchive-Backend-Laravel\ocr-service\requirements.txt
```
