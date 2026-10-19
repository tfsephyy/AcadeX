# Capstone AWS Deployment Handoff — AcadeX / EduArchive

Inspection date: **October 13, 2026 (Asia/Manila)**. Workspace: `C:\Users\ASUS\Desktop\EduArchive`. Inspected branch: `main`; HEAD: `4560e3f`. This report describes the **current working tree**, including existing uncommitted fixes, rather than an immutable GitHub release.

**Scope:** discovery, static security review, and safe local validation. No application source was changed, dependencies installed or updated, database records read/exported, migrations or seeders executed, services started/stopped, infrastructure accessed, or deployment performed. The handoff document is the only intended new repository file. Registry advisory queries and public official documentation were accessed; those are not production infrastructure checks.

**Instructions for the receiving ChatGPT:** Treat the findings and command templates as preparation material, not authorization to deploy, repair code, rotate secrets, run migrations, purchase resources, or alter an existing server. Resolve the blockers and obtain the owner's deployment scope first. Do not ask for secret values in chat. Do not copy the local `.env`, default account credentials, logs, database records, or private documents into prompts or tickets.

Status terminology throughout:

- **PASSED:** the named check was executed successfully during this inspection; only its stated scope passed.
- **FAILED:** executed and returned an error or an adverse validation result.
- **NOT RUN:** intentionally not executed, with the reason stated.
- **NEEDS VERIFICATION:** requires runtime, server, provider, browser, data-owner, or administrator evidence not available here.

Repository paths below are relative to the project root. In some sections, **B** means `EduArchive-Backend-Laravel/` and **F** means `EduArchive-Frontend-React/`.

## 1. Executive Project Summary

The user-facing project is **AcadeX**, a capstone repository for Mindoro State University. The workspace and parts of the API/email/OCR branding still use **EduArchive**. Its main functions are account approval, role-based capstone submission and review, searchable PDF metadata, publication/copyright classification, private document viewing, supplementary resources/IMRAD documents, bookmarks, analytics, activity logs, notifications, and a database-driven research chatbot.

There are **three components**, not just Laravel and React:

1. React/Vite browser SPA.
2. Laravel/Sanctum PHP JSON API with MySQL and encrypted local file storage.
3. FastAPI/Uvicorn Python OCR service using PaddleOCR/PaddlePaddle and native image/PDF libraries.

**Verdict: technically suitable for the proposed EC2/Ubuntu/Apache/MySQL stack, but NOT READY for public production deployment.** Production URL integration, document authorization, authentication lifecycle/security, vulnerable dependencies, safe initial administrator creation, and uncommitted release fixes require resolution. Ubuntu OCR behavior, actual database migration execution, mail delivery, and production browser workflows remain unverified.

Local evidence: both Vite applications compiled in memory; PHP syntax and Composer platform validation passed; the pure unit test passed. Frontend lint and the frontend/Composer security audits failed. These checks do not establish hosted acceptance.

## 2. Project Name and Purpose

Verified branding and purpose:

- `F/index.html` names **AcadeX**, Mindoro State University/MinSU, and a centralized capstone repository with automated PDF metadata extraction.
- `F/package.json` names the package `acadex-frontend-react`; its package version is `0.0.0`, not a meaningful product release version.
- `SETUP.md` calls the application AcadeX and references the AcadeX GitHub repository.
- `B/ocr-service/main.py` identifies the OCR service as EduArchive OCR Service, API version `2.0.0`.
- `B/app/Http/Controllers/Api/V1/PasswordResetController.php` uses EduArchive email branding; approval emails in `UserManagementController.php` use Acadex.
- `B/composer.json` retains Laravel's skeleton package name/description; that does not establish the business project name.

Administrator input is needed on final public branding. The OCR service's version must not be interpreted as the full application's release version.

## 3. Verified Technology Stack

Versions below are **resolved lockfile versions**, unless explicitly labeled otherwise. Manifest ranges alone are not exact installed versions.

| Component | Verified version / definition | Evidence |
| --- | --- | --- |
| Frontend React / React DOM | `19.2.4` / `19.2.4`; declared `^19.2.0` | `F/package.json`, `F/package-lock.json` |
| Frontend Vite | `7.3.1` | `F/package-lock.json` |
| React Router DOM | `7.13.1` | `F/package-lock.json`, `F/src/App.jsx` |
| Frontend Axios | `1.13.6` | `F/package-lock.json`, `F/src/api/axios.js` |
| Frontend Tailwind / Vite integration | `4.2.1` | `F/package-lock.json`, `F/vite.config.js` |
| PDF rendering used by pages | `react-pdf 10.4.1`, nested `pdfjs-dist 5.4.296` | `F/package-lock.json`; admin/student/visitor `*CapstoneMainPage.jsx` |
| Additional PDF viewer dependencies | `@react-pdf-viewer/core` and default layout `3.12.0`, root `pdfjs-dist 3.11.174` | `F/package.json`, `F/package-lock.json`; no first-party imports of the viewer packages found |
| Laravel | `12.53.0`; declared `^12.0` | `B/composer.lock`, `B/composer.json` |
| Laravel Sanctum | `4.3.1`; declared `^4.0` | `B/composer.lock` |
| PDF parsing / PHP OCR wrapper | `smalot/pdfparser 2.12.3`, `thiagoalessio/tesseract_ocr 2.13.0` | `B/composer.lock` |
| Backend asset build | Vite `7.3.7`, Laravel Vite plugin `2.1.0`, Tailwind `4.3.3`, Axios `1.20.0` | **Untracked** `B/package-lock.json`, `B/vite.config.js` |
| FastAPI / Uvicorn | `0.115.5` / `0.32.1` | `B/ocr-service/requirements.txt`; installed metadata checked |
| PaddleOCR / PaddlePaddle | `2.8.1` / `2.6.2`, CPU processing | requirements; `ocr_service.py` sets GPU use off |
| Other OCR dependencies | PyMuPDF `1.24.14`, Pillow `10.4.0`, NumPy `1.26.4`, OpenCV headless `4.10.0.84`, python-multipart `0.0.12`, setuptools `<81` | `B/ocr-service/requirements.txt` |
| Database used locally | MySQL selected in private local configuration; server version not queried | `B/config/database.php`, static migrations; `SETUP.md` reports MySQL `8.4.3` but this was not independently rechecked |
| Languages | PHP, JavaScript/JSX, Python, CSS, Blade HTML, SQL; PowerShell local launch scripts | application source and migrations |

No Express/Next.js server, TypeScript application, payment gateway, websocket application server, or SSR frontend was found. Laravel's auxiliary Vite assets are separate from the main React application.

## 4. Application Architecture

```text
Browser
  ├── React static SPA (F/dist)
  └── HTTPS /api/v1 requests with auth_token cookie
          │
      Apache → PHP runtime → Laravel API
          ├── MySQL: accounts, roles, capstones, search, audits, tokens, queues
          ├── private local disk: encrypted PDFs/resources/IMRAD
          ├── SMTP: verification, reset, approval messages
          ├── PDF parsing + optional Ghostscript/Tesseract execution
          └── private HTTP call → Uvicorn/FastAPI → PaddleOCR

Optional/maintenance processing:
  process manager → Laravel queue worker → ExtractPdfTextJob → PdfTextService
```

PDF processing has **distinct paths**:

- Upload metadata: `CapstoneController::upload()` calls `PdfExtractorService` before encrypting. Embedded text is parsed first; scanned PDFs can use the Python service, then Ghostscript/Tesseract fallback. The user can request `skip_extraction` and enter metadata manually.
- Saving the capstone: `CapstoneController::store()` extracts document text **synchronously** through `PdfTextService`. A queue worker does not automatically make this request asynchronous.
- Maintenance backfill: `capstones:backfill-pdf-text` dispatches `ExtractPdfTextJob`, or runs synchronously with its option. The job uses `PdfTextService`, not the Python OCR HTTP service.
- `FastOcrService` exists, but the source reference sweep found no active callers outside its own definition. Its Windows-only binary detection is a latent portability issue, not proof that the active upload path fails.

`ChatbotController.php` and `app/Services/Chatbot/` use PHP intent recognition, queries, permissions, and formatted responses. A Groq key/config entry exists, but no implemented Groq HTTP request was found. Do not make an external LLM a required production service based solely on the variable's presence.

## 5. Repository Structure

```text
EduArchive/
  .gitignore
  .vscode/settings.json
  SETUP.md                    # existing local notes; untracked; contains demo credentials
  start-local.ps1             # untracked Windows launcher
  stop-local.ps1              # untracked Windows stop helper
  .local/                     # ignored local tools, logs, process receipts
  EduArchive-Frontend-React/
    package.json, package-lock.json, vite.config.js, eslint.config.js
    index.html, vercel.json
    src/
      api/                    # Axios instance and role-oriented API functions
      context/                # authentication, theme, chatbot
      components/             # shared and role-oriented UI
      pages/admin/, faculty/, student/, visitor/
      App.jsx, main.jsx, CSS, assets/
    public/                   # public static assets
    dist/                     # ignored existing generated build
    node_modules/             # local dependencies, not deployable source
  EduArchive-Backend-Laravel/
    artisan, composer.json, composer.lock, phpunit.xml
    package.json, package-lock.json, vite.config.js
    app/Http/Controllers/Api/V1/, Middleware/, Requests/
    app/Models/, Services/, Jobs/, Console/Commands/
    bootstrap/app.php, bootstrap/providers.php, bootstrap/cache/
    config/
    routes/api.php, web.php, console.php
    database/migrations/, seeders/, factories/
    public/index.php, .htaccess, build/
    resources/views/, css/, js/
    storage/app/private/, app/public/, framework/, logs/
    tests/Feature/, Unit/
    ocr-service/
      main.py, ocr_service.py, validators.py, requirements.txt
      .env.example, ignored .env, ignored .venv/
    ignored .env, vendor/, node_modules/
```

Coverage included the root setup and launch helpers, manifests and lockfiles, routing/bootstrap/configuration, all migration definitions, seeders/factory, model relationships, API controllers/services/middleware/jobs/commands, frontend API/auth/routing/upload/PDF flows, Python source and requirements, tests, ignore rules, Apache/Vercel files, and static searches across first-party source. There are 44 application PHP files and 76 files under frontend `src`; 97 PHP files were syntax-checked. Vendor/generated files were examined only where relevant to framework behavior, runtime requirements, or dependency evidence. Private records, logs, document contents, and credential values were excluded from the handoff.

No applicable `AGENTS.md`, Dockerfile/Compose deployment, GitHub Actions workflow, AWS configuration, Apache virtual-host file, production systemd/Supervisor unit, or PM2 ecosystem configuration was found in the project. Laravel Sail is a development dependency; that alone is not a configured Docker environment. `F/vercel.json` contains a Vercel SPA rewrite, not an EC2 deployment configuration. The project READMEs are primarily framework boilerplate.

Existing dirty worktree at inspection:

- Modified `.gitignore`.
- Modified `B/database/migrations/2026_09_22_000001_add_approval_fields_to_capstones.php`.
- Modified `B/database/migrations/2026_09_26_154143_add_rejection_reason_to_capstones_table.php`.
- Modified `B/ocr-service/requirements.txt`.
- Untracked `B/package-lock.json`, `SETUP.md`, `start-local.ps1`, `stop-local.ps1`.

A fresh GitHub clone of HEAD will not include these local changes. Review and deliberately include the required fixes in the approved release; do not broadly stage everything, particularly the credential-bearing local notes.

## 6. Dependency and Runtime Requirements

### PHP and Composer

`B/composer.json` requires PHP `^8.2`. Laravel and the installed lockfile permit an 8.2-family-or-newer compatible runtime; select a supported PHP release and validate the exact lock against it. **Locally verified:** PHP CLI `8.3.16`, Composer `2.8.11`. These historical patch numbers are observations, not a recommendation to install outdated patches on a public server.

The lock requires Composer runtime API `^2.2`; its plugin API marker is `2.6.0`. Use compatible Composer **2.x**, with runtime/plugin API compatibility checked against the lock; do not treat the marker as a demand for exactly Composer 2.6.0. A production `composer check-platform-reqs --no-dev` is mandatory on the actual Ubuntu runtime.

Required/expected PHP facilities: ctype, cURL, DOM, fileinfo, filter, hash, mbstring, OpenSSL, PCRE, PDO, session, tokenizer, XML/libxml, iconv, and zlib; **pdo_mysql** is needed for MySQL. OPcache is recommended. CLI workers need pcntl for reliable job timeout handling on Linux. PHP HTTP stream access (`allow_url_fopen`) is used for the Python service, and active Ghostscript/Tesseract paths use `exec`; verify the service account's PHP restrictions and PATH. These are source requirements, not instructions to globally relax PHP security. [Laravel 12 deployment requirements](https://laravel.com/docs/12.x/deployment), [Laravel queue timeout guidance](https://laravel.com/docs/12.x/queues).

### Node and npm

Both locked Vite toolchains require **`^20.19.0 || >=22.12.0`**. The 22.x line at or above 22.12 is a source-supported build choice; use a currently supported patched release. Locally verified: Node `22.18.0`, npm `10.9.3`. npm lockfiles use version 3. There is no repository `.nvmrc`/Node release pin or standalone package-manager pin. React Router also requires Node >=20; the nested PDF.js dependency accepts the checked Node 22 runtime. [Vite requirements](https://vite.dev/guide/), [Node release support](https://nodejs.org/en/about/previous-releases).

Node/npm are needed on the developer laptop or build host. A production server serving prebuilt static assets does not need a persistent Node process. Do not copy Windows `node_modules` to Ubuntu.

### Python and native OCR tools

The source uses modern Python type annotations; the pinned wheels further constrain usable Python versions. **Python 3.11 is the inspected working OCR baseline**: the local virtual environment reports `3.11.17`. System Python is `3.13.7`, a different environment. Do not use it interchangeably. No Python version file or fully resolved transitive Python lockfile exists; most direct requirements are pinned, but `setuptools<81` and transitive dependencies are not fully locked.

Publisher metadata for PaddlePaddle 2.6.2 includes CPython 3.11 Linux x86_64 and aarch64 wheels. That establishes artifact availability, not actual Ubuntu runtime compatibility. Prefer x86_64 initially to minimize changes from the inspected x64 Windows environment; ARM remains possible but untested. Confirm wheels, shared libraries, CPU support, and all transitive imports on the chosen Ubuntu release. [PaddlePaddle 2.6.2 publisher metadata](https://pypi.org/pypi/paddlepaddle/2.6.2/json).

Provide a dedicated Python environment and writable service-owned model cache/home and temporary directories. PaddleOCR initializes/downloads weights at startup. CPU OCR is configured; a GPU is not required by the current code. Native prerequisites can include OpenMP/OpenCV-related shared libraries; verify with an actual import/startup check before choosing OS packages. Install **Ghostscript**, **Tesseract with English language data**, and optionally Poppler `pdftotext` for PHP OCR paths. `pdftotext` is used only by the presently unreferenced `FastOcrService` path.

### Database

MySQL is the appropriate production engine. Source uses `FULLTEXT`, `MATCH ... AGAINST`, MySQL-flavored `ALTER TABLE`, year/enum/JSON types, and a MySQL-specific deduplication migration. Generic Laravel support for SQLite/PostgreSQL does not make these migrations portable. No exact database version is pinned. MySQL 8.x is the proposed test target, based on the SQL features and the existing setup note's reported 8.4.3 development environment; actual server compatibility is **NEEDS VERIFICATION**. MariaDB compatibility has not been demonstrated.

### Windows → Ubuntu concerns

- Recreate PHP/Python/Node dependencies for the destination OS; do not transfer `vendor`, `.venv`, native packages, or executable paths as the installation strategy.
- Windows paths occur in all three PHP PDF services. `PdfExtractorService` and `PdfTextService` include Linux `gs`/`tesseract` PATH fallback. `FastOcrService::commandExists()` always uses Windows `where` and `nul` redirection.
- The PowerShell start/stop helpers depend on Windows processes, network cmdlets, Laragon, and `.venv/Scripts`; they are not Ubuntu services.
- Frontend relative import resolution and filename casing passed a static check. Linux execution still needs an actual build/runtime check.
- PDF processing uses temporary decrypted plaintext and rendered images. The encryption-at-rest feature does not eliminate plaintext temporary files.
- `PdfExtractorService` calls `env('OCR_SERVICE_URL')` outside configuration. Standard config caching can make it fall back to its localhost default unless the variable is supplied to the process environment. Resolve this before using blanket optimization commands.

## 7. Development Setup

The following are **documentation commands, not executed startup/setup actions**. The administrator must supply local MySQL and private configuration and intentionally approve any installation or database initialization in a later setup task.

Existing launcher, **Windows PowerShell, repository root**:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\start-local.ps1
# Optional launcher mode, with reduced automatic OCR capability:
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\start-local.ps1 -WithoutOcr
# Stop only services whose identities were recorded by the helper:
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\stop-local.ps1
```

The helper starts API, React Vite, Laravel queue worker, and Uvicorn; it uses process receipts under `.local` and does not start MySQL. The working configuration expects the browser at localhost to match CORS/cookies. Documentation addresses are frontend port 5173, API port 8000 (`/api/v1`, `/up`), and OCR port 8001 (`/health`). Do not reuse these listeners as public production services.

Manual component launch commands, **Windows PowerShell, one terminal per process**:

```powershell
# From EduArchive-Frontend-React:
npm.cmd run dev -- --host localhost --port 5173 --strictPort
# From EduArchive-Backend-Laravel:
php artisan serve --host=127.0.0.1 --port=8000
# Optional maintenance queue, after its database tables exist and timings are fixed:
php artisan queue:work --tries=2 --timeout=600
# From EduArchive-Backend-Laravel/ocr-service, using the prepared environment:
& .\.venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8001
```

Set queue `retry_after` longer than the job's 600-second timeout before using that worker. Do not use the existing local worker timing as a production recommendation.

`composer run dev` is an alternative skeleton command that starts Artisan serve, queue listen, Pail, and backend Vite; it does not start the React project or Python OCR. Pail/runtime behavior on Windows may differ. `composer run setup` includes key generation, migrations, and dependency installation; **do not use it as a safe inspection command or as a production deployment shortcut**.

The existing `SETUP.md` describes prior migrations/seeding/browser/OCR checks. Those are historical local assertions, not current inspection results. Its administrator identity/password must not be shared or reused for production.

## 8. Production Build Requirements

Main React build, **Windows PowerShell from F**:

```powershell
npm.cmd ci
npm.cmd run build
```

Equivalent **Ubuntu build host/SSH session from F**:

```bash
npm ci
npm run build
```

Output is **`F/dist/`** under default Vite configuration. Deploy the complete generated directory, including `index.html` and `assets/`; do not publish source or `node_modules`. There is no custom base path, so the build assumes the SPA lives at the domain root. Change the API URL in an authorized source change and rebuild; adding a frontend environment file alone currently does nothing because `src/api/axios.js` does not read it.

Backend auxiliary assets, **Windows PowerShell from B**:

```powershell
npm.cmd ci
npm.cmd run build
```

Equivalent **Ubuntu build host/SSH session from B**:

```bash
npm ci
npm run build
```

Output is **`B/public/build/`**, with the Laravel Vite manifest. `resources/views/welcome.blade.php` is the backend root view. Building these assets preserves its stock view; it does not build the React SPA. The backend npm lockfile is currently untracked and must be deliberately included in the release for reproducible `npm ci`.

**Current validation:** the existing Vite API compiled both configurations with `build.write=false` and `configLoader='runner'`. This tests bundling without rewriting `dist`, `public/build`, or temporary bundled config files. React transformed 833 modules; backend assets transformed 58. Frontend emitted an existing duplicate JSX `style` warning at `F/src/components/Navbar.jsx:43`. Standard `npm run build` artifact emission and fresh `npm ci` were **NOT RUN** in this inspection.

Production dependency install command for a later authorized release, **Ubuntu SSH session from B**:

```bash
composer install --no-dev --prefer-dist --no-interaction --optimize-autoloader
composer check-platform-reqs --no-dev
```

Install from an approved, security-reviewed lockfile. Do not use `composer update`, `npm audit fix --force`, or regenerate lockfiles during deployment. Composer install invokes the repository's post-autoload/package-discovery hooks and requires suitable writable paths and configuration.

## 9. Backend and API Configuration

`B/bootstrap/app.php` registers web, API, console routes and `/up`. `B/routes/api.php` adds `v1`; final API prefix is **`/api/v1`**. Route discovery executed successfully: **118 routes total, 113 under `api/`**.

| API area | Behavior / protection |
| --- | --- |
| Registration/login/reset/verification | Public POST endpoints with rate limits |
| `/user`, `/profile`, `/logout`, password change | Sanctum-authenticated account operations |
| `/published/*` | Authenticated listing/filter/suggestion endpoints |
| `/chatbot/message` | Authenticated, rate-limited PHP chatbot |
| `/capstones/*` | Shared metadata, bookmarks, analytics, view recording, PDF/IMRAD/resources, download and PDF-token endpoints |
| `/admin/*` | Admin role middleware; dashboards, users, approvals, capstones, notifications, activity logs |
| `/faculty/*` | Admin or faculty middleware; capstone management and browsing |
| `/student/*` | Student middleware; submission, management and browsing |
| `/visitor/*` | Visitor middleware; controller-specific visibility restrictions |

CORS in `B/config/cors.php` permits one exact `FRONTEND_URL`, arbitrary methods/headers, and credentials. The current fallback origin is `http://localhost:5173`. Set the real HTTPS frontend origin; avoid a credentialed wildcard origin. Supporting additional origins requires a deliberate configuration change. Preflight/credentials must be tested on the final domains.

`config/database.php` defaults to SQLite, while the inspected private local configuration selects MySQL. Production must select/configure MySQL explicitly. A `.env.example` copy alone is insufficient for this application.

The API backend root `/` is the Laravel welcome page, not React. `/up` verifies framework health, not MySQL availability, OCR readiness, SMTP delivery, or document authorization. Framework-generated `GET` and `PUT storage/{path}` routes were also discovered because the local disk has `serve=true`; inspected framework implementation validates signed requests for the private disk. These are distinct from the public storage symlink and application document controllers.

There is no explicit trusted-proxy configuration in `bootstrap/app.php`. Verify HTTPS detection, generated URLs, logged client addresses, throttling identities, and trusted forwarding headers when using Cloudflare or any additional reverse proxy. Trust only the actual proxy chain; do not accept arbitrary client-supplied forwarding headers.

## 10. Frontend Configuration

**Critical integration blocker:** `F/src/api/axios.js:4` hardcodes **`http://localhost:8000/api/v1`**. A deployed visitor's browser would contact their own computer and HTTPS pages would encounter mixed-content restrictions. There is no implemented `VITE_API_URL`/`VITE_API_BASE_URL` variable. The source owner must authorize an API URL configuration change and rebuild.

For the recommended sibling frontend/API hostnames under one registrable domain, use the approved HTTPS API origin plus `/api/v1`. A same-origin relative `/api/v1` design is also possible, but requires an explicit Apache routing design separating PHP API requests from SPA fallback. Neither is implemented by the current localhost constant.

`withCredentials=true` sends the API cookie. Authentication context calls `/user`, login, registration, logout; it does not store the auth token in localStorage. Other browser storage retains theme, remembered email, chatbot position, and view bookkeeping. Remembered email is personal information; clear it appropriately on shared devices.

`F/src/App.jsx` uses BrowserRouter and role-protected routes. Apache must return `index.html` for valid SPA navigation paths such as `/admin/dashboard`, `/student/uploads`, and `/visitor/capstones/:id`. Real static files must retain normal file serving; API, ACME challenges, and backend health requests must not be rewritten to React. `F/vercel.json` only solves this on Vercel.

PDF pages retrieve protected API responses as blobs and create object URLs. They load a version-specific worker from **unpkg.com**, using the `react-pdf` nested PDF.js version. `F/index.html` loads fonts from **fonts.googleapis.com/fonts.gstatic.com**. These are live browser network dependencies and relevant to CSP, outbound policy, availability, and privacy. A future authorized change can self-host them; do not assume existing assets are fully offline.

No application WebSocket/EventSource integration was found. UI timers are local countdown/animation behavior, not a realtime messaging server. No frontend secret should be placed in a Vite variable; values compiled into a browser bundle are public.

## 11. Database Architecture and Migration Requirements

### Engine, naming, and initialization

Use MySQL with InnoDB-compatible foreign keys and FULLTEXT support. `DB_DATABASE` is configurable; no database name is hardcoded as a required application contract. The owner chooses an isolated production database and least-privilege account. Do not reuse the development database or root account. Configure consistent utf8mb4 charset/collation, SQL mode, timezone, connection limits, and packet sizing for document text/JSON data.

**A fresh schema can be constructed from the current 27 migration definitions in principle. No tracked SQL dump is required for an empty initial deployment.** That is a static assessment, not a migration execution result. Required roles and a safe administrator account are additional initialization steps. An existing archive deployment requires an owner-approved database backup **plus private file storage and the original application encryption key**; migrations cannot reconstruct those records or decrypt files with a replacement key.

### Table overview

| Tables | Important columns / relationships |
| --- | --- |
| `roles` | Unique role name: admin/student/faculty/visitor |
| `users` | Name/username/email, nullable unique institutional ID, role FK, hashed password, verification time, approval/archive/lockout state, faculty program, activity timestamp |
| `student_profiles` | User FK with cascade deletion; program/year/section; model treats this as one profile per user, but original migration does not enforce a unique user FK |
| `personal_access_tokens` | Sanctum polymorphic owner, hashed token, abilities, usage/expiry timestamps |
| `password_reset_tokens` | Framework token table, alongside the application's custom code table |
| `password_reset_codes` | Email, plaintext verification/reset code, type, expiry, used flag |
| `login_audits` | Nullable user FK, attempted email, IP/user-agent, success/failure/locked state |
| `sessions` | Framework database session payload and last activity |
| `capstones` | Title/year/author/author-details JSON/program/category/abstract, encrypted file paths/original names, extracted plaintext `pdf_text`, index timestamp, status/approval/publication/copyright/archive state, uploader/approver/adviser FKs, counters |
| `keywords`, `capstone_keyword` | Unique keyword name; unique capstone-keyword association with cascading FKs |
| `capstone_resources` | Capstone FK, display name, private file path/original name |
| `capstone_references` | Directed capstone-to-capstone links, unique pair, cascading FKs |
| `bookmarks` | Unique user-capstone pair, cascading FKs |
| `downloads` | Capstone FK, nullable user FK, IP and timestamps |
| `capstone_views` | Capstone/nullable user FKs, IP, unique user-capstone pair after deduplication |
| `audit_logs` | Nullable actor FK, action, model reference, old/new JSON, IP/user-agent |
| `notifications` | Admin FK, notification fields/read state, related user/capstone IDs; related IDs are not declared FKs in the original migration |
| `cache`, `cache_locks` | Database cache and lock records |
| `jobs`, `job_batches`, `failed_jobs` | Database queue, batch metadata, failed payloads/exceptions |
| `migrations` | Created/maintained by Laravel during migration execution, rather than an application migration file |

`B/app/Models/` defines user-role/profile and capstone-uploader/approver/adviser relationships, keyword and reference many-to-many associations, and document/tracking/audit relationships. Deleting an uploader can cascade-delete capstone rows; DB cascading does not automatically invoke the controller's encrypted-file cleanup. Restore and deletion policy must account for orphaned files, counters, and citations.

### Complete migration inventory

All files below are under `B/database/migrations/`:

```text
0001_01_01_000000_create_users_table.php
0001_01_01_000001_create_cache_table.php
0001_01_01_000002_create_jobs_table.php
2026_02_28_094132_create_personal_access_tokens_table.php
2026_03_04_000001_create_capstones_table.php
2026_03_04_000002_create_keywords_tables.php
2026_03_04_000003_create_tracking_tables.php
2026_03_04_000004_create_audit_logs_table.php
2026_03_04_000005_add_approval_fields_to_users_table.php
2026_03_26_000001_add_category_to_capstones_table.php
2026_04_19_163112_create_password_reset_codes_table.php
2026_04_19_163710_add_is_archived_to_users_table.php
2026_05_07_160936_create_notifications_table.php
2026_08_10_000001_add_publication_status_adviser_to_capstones.php
2026_08_10_000002_create_capstone_resources_table.php
2026_08_10_000003_create_capstone_references_table.php
2026_08_10_154246_add_unique_to_capstone_views.php
2026_08_10_181718_add_pdf_text_to_capstones_table.php
2026_09_02_000001_add_visitor_role.php
2026_09_02_153145_add_copyright_and_imrad_to_capstones_table.php
2026_09_03_000001_add_last_active_at_to_users_table.php
2026_09_13_000001_extend_fulltext_index_for_nlp_search.php
2026_09_13_000002_add_author_details_to_capstones_table.php
2026_09_22_000001_add_approval_fields_to_capstones.php
2026_09_26_154143_add_rejection_reason_to_capstones_table.php
2026_09_26_201445_add_pdf_text_indexed_at_to_capstones_table.php
2026_10_05_150935_drop_is_published_from_capstones_table.php
```

### Migration and data risks

- The original capstone creation already defines `approved_by`/`approved_at`. The September 22 migration's **local uncommitted fix** stops re-creating them, guards the approval-status column/index, and leaves rejection reason to September 26. The latter also has an uncommitted guard. These fixes must accompany the release; deploying HEAD alone risks duplicate-column migration failures.
- August 10 view deduplication **deletes existing duplicate records** before adding a unique index. It changes historical analytics and may leave counter reconciliation questions.
- September 13 rebuilds FULLTEXT indexes using MySQL-specific SQL. It catches some index-drop exceptions but is not universally idempotent. Applying it to an existing partially migrated DB requires schema/migration-table inspection.
- October 5 updates publication state, drops the old `is_published` index/column, and is a data-changing migration. Later rollback is not guaranteed to reconstruct all prior semantic states.
- Visitor-role rollback can conflict with existing visitor users and nullable IDs.
- `status` and `approval_status` coexist. `publication_status` is distinct; `is_published` is now a model accessor, not a database column. Do not create an ad-hoc schema from screenshots or old SQL.
- API validation accepts title/author lengths up to 500, but the original migration defines default-length string columns. Test long metadata against MySQL strict mode; DB insertion can fail despite passing request validation.
- PDFs are encrypted on disk, while extracted text, author contact metadata, reset codes, and audit records are stored in the DB without this PDF encryption. Database backups must be treated as confidential.

### Seeders

| Seeder | Behavior | Production safety |
| --- | --- | --- |
| `DatabaseSeeder.php` | Creates four roles and a fixed approved administrator with a literal password input | **Unsafe unchanged.** Roles are required; create the admin using an approved secure bootstrap procedure |
| `CapstoneSeeder.php` | Creates fixed demo users, keywords, sample capstones pointing to a placeholder PDF, and bookmarks/counters | **Demo-only.** Adds fictitious content and credentials; repeated execution can duplicate capstones/counters |
| `ClearCapstonesSeeder.php` | Disables FK checks and truncates capstone/tracking tables | **Destructive. Never use for production setup** |
| `UserFactory.php` | Predictable test password input | Test data only; do not create public accounts from it |

No separate production-safe role-only/admin bootstrap seeder exists. Do not run blanket `db:seed` or `migrate --seed`. Fresh initialization needs a future authorized secure process for roles and an administrator; their secret must be generated/entered outside chat and rotated according to the owner's policy.

## 12. Authentication and Security Configuration

### Verified implementation

`User` uses Sanctum personal access tokens and Laravel's hashed password cast. Registration permits student/faculty/visitor, not admin, and requires academic fields depending on role. New users require administrator approval before login. Login validates credentials, applies five-attempt/15-minute lockout behavior and route throttling, revokes old tokens, and issues a new token in an **HttpOnly `auth_token` cookie**. Cookie duration/domain/secure flag come from session configuration; SameSite is explicitly **Lax** in `AuthController`, independent of `SESSION_SAME_SITE`. Logout deletes the current token and forgets the cookie.

`AttachTokenFromCookie` converts the cookie to a bearer Authorization header before API handling. `RoleMiddleware` performs server-side role checks. UI `ProtectedRoute` is navigation control, not a replacement for backend authorization. No explicit Sanctum `statefulApi()` activation is present in `bootstrap/app.php`; the frontend does not perform a CSRF-cookie/XSRF exchange. `SANCTUM_STATEFUL_DOMAINS` alone cannot enable that flow.

### Blocking or material security findings (static evidence, no exploit execution)

1. **Shared document routes bypass visitor-specific visibility rules.** Shared `/capstones/{capstone}/pdf` and IMRAD/resource view routes are available to every authenticated role. `CapstoneController::servePdf()` explicitly allows any authenticated user and does not check publication/copyright/archive/ownership. `download()` blocks students but does not block visitors or enforce the visitor controller's publication rules. Visitor-specific restrictions therefore do not secure the same documents through shared endpoints. Sources: `B/routes/api.php`, `CapstoneController.php:945–1073`, `VisitorCapstoneController.php`.
2. **Metadata serialization exposes fields beyond the intended document boundary.** Shared `show()` loads the capstone and calls `toArray()` without visibility checks; `Capstone` has no `$hidden` definition for `pdf_text` or author contact details. Visitor `show()` also serializes the model. This contradicts the migration comment that extracted text is never sent to the frontend. Review API response fields and visibility policy before hosting confidential documents. Sources: `CapstoneController.php:207`, `VisitorCapstoneController.php:159`, `B/app/Models/Capstone.php`.
3. **Cookie authentication lacks explicit API CSRF protection.** HttpOnly and SameSite Lax help, but the custom cookie-to-bearer flow is not Sanctum's standard session/CSRF design. CORS is not a CSRF defense, and sibling same-site origins merit explicit threat testing. Resolve with the source owner; do not assume setting Sanctum/session variables fixes the implementation. Sources: `bootstrap/app.php`, `AttachTokenFromCookie.php`, `AuthController.php`, `F/src/api/axios.js`.
4. **Email verification is partly trusted to the frontend.** `AuthController::updateProfile()` accepts an email-code string but does not validate it against the server code record; the implementation comment assumes frontend validation. Registration also does not bind itself to a completed server-side verification proof. A client-supplied verification timestamp indicator can influence the update path. Sources: `AuthController.php::register/updateProfile`, `RegisterRequest.php`, `PasswordResetController.php`, `F/src/components/ChangeEmailModal.jsx`.
5. **Account lifecycle gaps.** Password reset/change update the password without revoking existing Sanctum tokens. Account archive sets `is_archived` without token revocation; login checks approval/lock state but not archive state, and API middleware has no approval/archive revalidation. Sanctum expiration is null and token creation supplies no expiry; cookie expiration does not expire a copied bearer token. Sources: `PasswordResetController.php`, `AuthController.php`, `UserManagementController.php::archive`, `config/sanctum.php`, middleware.
6. **Upload/path control needs hardening.** Resources accept arbitrary file types up to 50 MiB. `store()` accepts file path strings and related resource/IMRAD paths without proving upload ownership or association. Storage is encrypted/private, but that does not establish safe linking, malware protection, retention, or quota enforcement. Sources: `CapstoneController.php::uploadResource/store/update`, `PdfEncryptorService.php`.
7. **Temporary plaintext permissions are unsuitable for a multi-user shared host without additional controls.** Both active PHP OCR services create temporary directories requesting `0777`; effective permissions depend on umask. Use isolated service identities, a private temp location and restrictive umask; inspect actual Linux permissions. The Laravel disk has `throw=false`, and file encryption writes do not explicitly confirm success, so disk-full/permission failure behavior also needs validation. Sources: `PdfTextService.php:158`, `PdfExtractorService.php:269`, `config/filesystems.php`, `PdfEncryptorService.php`.
8. **Fixed seeded credentials and vulnerable dependencies are release blockers.** See sections 11 and 21. Merely hosting behind Cloudflare does not resolve them.

### Configuration/secret findings

The inspected local environment is in development/debug mode and does not enable secure session cookies. It is not an acceptable production configuration. The backend `.env` contains application encryption key material, SMTP credential material, and a Groq API key category; values are intentionally omitted. Their presence does not prove use or exposure. Only private backend/OCR configuration names and safe classifications were inspected for this report; no production `.env` was available.

Current tracked files contain literal default account password inputs in `B/database/seeders/DatabaseSeeder.php`, `CapstoneSeeder.php`, and `database/factories/UserFactory.php`. Existing untracked `SETUP.md` also records demo administrator credentials. Rotate any real accounts initialized from them. Do not add the local setup notes to a shared handoff unchanged.

No tracked `.env`, private-key/dump filename, or such filename in the visible Git history was found. A limited pattern scan of current tracked source and 431 reachable historical source blobs found no recognizable provider-key/private-key signatures. The visible repository has 23 reachable commits. This is **not comprehensive secret-scanner proof**: arbitrary password formats, deleted/unreachable objects, remote-only branches, releases, logs, screenshots, previous exports and collaborators' copies were not exhaustively audited. Rotate SMTP/provider credentials if they were shared, logged, or previously exposed. App-key rotation requires a controlled decrypt/re-encrypt or previous-key migration because of stored files; do not simply regenerate it.

Production must disable debug output, use TLS-secure cookies, restrict configuration/backup access, keep only public directories web-accessible, and validate generic JSON errors. Custom mail/OCR failures often use generic responses, but no production error-handling exercise was performed. Logs can include names, emails, file paths, exception traces, queue payloads and sensitive database content; restrict and retain them deliberately.

## 13. Environment Variables (NAMES ONLY — NO VALUES)

The lists below contain **names only**. They are not a ready-to-paste environment file. Choose settings privately. Optional framework definitions do not establish that a service is required.

### Application and required deployment configuration

`APP_NAME`, `APP_ENV`, `APP_KEY`, `APP_PREVIOUS_KEYS`, `APP_DEBUG`, `APP_URL`, `APP_LOCALE`, `APP_FALLBACK_LOCALE`, `APP_FAKER_LOCALE`, `APP_MAINTENANCE_DRIVER`, `APP_MAINTENANCE_STORE`, `BCRYPT_ROUNDS`.

`FRONTEND_URL`, `SANCTUM_STATEFUL_DOMAINS`, `SANCTUM_TOKEN_PREFIX`.

`DB_CONNECTION`, `DB_HOST`, `DB_PORT`, `DB_DATABASE`, `DB_USERNAME`, `DB_PASSWORD`, `DB_URL`, `DB_SOCKET`, `DB_CHARSET`, `DB_COLLATION`, `MYSQL_ATTR_SSL_CA`.

`SESSION_DRIVER`, `SESSION_LIFETIME`, `SESSION_EXPIRE_ON_CLOSE`, `SESSION_ENCRYPT`, `SESSION_CONNECTION`, `SESSION_TABLE`, `SESSION_STORE`, `SESSION_COOKIE`, `SESSION_PATH`, `SESSION_DOMAIN`, `SESSION_SECURE_COOKIE`, `SESSION_HTTP_ONLY`, `SESSION_SAME_SITE`, `SESSION_PARTITIONED_COOKIE`.

`CACHE_STORE`, `CACHE_PREFIX`, `DB_CACHE_CONNECTION`, `DB_CACHE_TABLE`, `DB_CACHE_LOCK_CONNECTION`, `DB_CACHE_LOCK_TABLE`.

`QUEUE_CONNECTION`, `QUEUE_FAILED_DRIVER`, `DB_QUEUE_CONNECTION`, `DB_QUEUE_TABLE`, `DB_QUEUE`, `DB_QUEUE_RETRY_AFTER`.

`FILESYSTEM_DISK`, `OCR_SERVICE_URL`.

`MAIL_MAILER`, `MAIL_SCHEME`, `MAIL_URL`, `MAIL_HOST`, `MAIL_PORT`, `MAIL_USERNAME`, `MAIL_PASSWORD`, `MAIL_EHLO_DOMAIN`, `MAIL_FROM_ADDRESS`, `MAIL_FROM_NAME`, `MAIL_LOG_CHANNEL`, `MAIL_SENDMAIL_PATH`.

`LOG_CHANNEL`, `LOG_STACK`, `LOG_LEVEL`, `LOG_DAILY_DAYS`, `LOG_DEPRECATIONS_CHANNEL`, `LOG_DEPRECATIONS_TRACE`, `LOG_STDERR_FORMATTER`, `LOG_SYSLOG_FACILITY`.

### Backend asset/template name

`VITE_APP_NAME`.

The React SPA currently has **no implemented environment variable for its API base URL**. Any proposed variable must first be implemented by an authorized source change. Never add secrets to frontend build variables.

### OCR template names, currently not consumed by the Python application

`OCR_HOST`, `OCR_PORT`, `USE_GPU`.

`main.py` does not load the OCR `.env`; host/port are controlled by the Uvicorn launch command, and the engine hardcodes CPU operation. Do not expect editing those template variables to change runtime behavior.

### Optional framework service definitions

`AUTH_GUARD`, `AUTH_MODEL`, `AUTH_PASSWORD_BROKER`, `AUTH_PASSWORD_RESET_TOKEN_TABLE`, `AUTH_PASSWORD_TIMEOUT`.

`DB_FOREIGN_KEYS`, `DB_SSLMODE`. The source also contains commented alternative database placeholders `DB_ENCRYPT`, `DB_TRUST_SERVER_CERTIFICATE`; these are not MySQL production requirements.

`REDIS_CLIENT`, `REDIS_HOST`, `REDIS_PORT`, `REDIS_USERNAME`, `REDIS_PASSWORD`, `REDIS_URL`, `REDIS_DB`, `REDIS_CACHE_DB`, `REDIS_PREFIX`, `REDIS_CLUSTER`, `REDIS_PERSISTENT`, `REDIS_MAX_RETRIES`, `REDIS_BACKOFF_ALGORITHM`, `REDIS_BACKOFF_BASE`, `REDIS_BACKOFF_CAP`, `REDIS_CACHE_CONNECTION`, `REDIS_CACHE_LOCK_CONNECTION`, `REDIS_QUEUE_CONNECTION`, `REDIS_QUEUE`, `REDIS_QUEUE_RETRY_AFTER`.

`MEMCACHED_HOST`, `MEMCACHED_PORT`, `MEMCACHED_USERNAME`, `MEMCACHED_PASSWORD`, `MEMCACHED_PERSISTENT_ID`.

`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_DEFAULT_REGION`, `AWS_BUCKET`, `AWS_URL`, `AWS_ENDPOINT`, `AWS_USE_PATH_STYLE_ENDPOINT`, `DYNAMODB_CACHE_TABLE`, `DYNAMODB_ENDPOINT`, `SQS_PREFIX`, `SQS_QUEUE`, `SQS_SUFFIX`.

`BEANSTALKD_QUEUE_HOST`, `BEANSTALKD_QUEUE`, `BEANSTALKD_QUEUE_RETRY_AFTER`.

`GROQ_API_KEY`, `POSTMARK_API_KEY`, `RESEND_API_KEY`, `SLACK_BOT_USER_OAUTH_TOKEN`, `SLACK_BOT_USER_DEFAULT_CHANNEL`, `LOG_SLACK_WEBHOOK_URL`, `LOG_SLACK_USERNAME`, `LOG_SLACK_EMOJI`, `LOG_PAPERTRAIL_HANDLER`, `PAPERTRAIL_URL`, `PAPERTRAIL_PORT`. `POSTMARK_MESSAGE_STREAM_ID` occurs only in commented mail configuration.

`B/.env.example` does not fully document the application's actual MySQL/auth/frontend integration settings. Configure from verified code and the administrator's decisions; copying the example unchanged is not sufficient.

## 14. File Storage and Upload Requirements

The configured **local disk** root is **`B/storage/app/private`**. Uploads use that disk explicitly or the encryptor's local-disk default, not an environment-selected S3 implementation. Subdirectories include `capstones`, `capstone_resources`, and `capstone_imrad`. Laravel AES-256-CBC encryption through `Crypt` produces `.enc` files. Files are read/decrypted in memory when served; OCR/text extraction also writes temporary plaintext to disk.

**Preserve `APP_KEY` with its corresponding encrypted files.** A database-only restore is incomplete. The encryption service's legacy fallback returns original bytes when decryption fails, so a wrong key can result in corrupt/ciphertext content being served rather than a clear failure. Validate restored files against real decryptability before traffic cutover; do not use “HTTP 200” as proof of successful restoration.

`storage:link` maps `B/public/storage` only to **`storage/app/public`**. It does not expose the private encrypted upload folders and is not required to serve the protected capstone PDFs. Do not link `storage/app/private` to a public directory. No populated archive files were found in the current upload directories; actual archive existence in another environment remains an owner question.

Application PDF/IMRAD/resource limits are **50 MiB per file** (Laravel validation `51200` KiB). Python OCR accepts at most **20 MiB and 50 PDF pages**, with allowed image/PDF extensions and magic-byte checks. Thus a valid Laravel PDF can be rejected by Python OCR. There are additional PHP fallback page limits: metadata fallback processes up to 60 rendered pages; text extraction uses at most 30 OCR pages and truncates stored text to 50,000 characters. Confirm expected capstone length/size and accepted degraded behavior.

Set PHP upload/body limits, Apache body limits, request timeouts, PHP-FPM worker count/memory, and proxy behavior coherently with accepted file sizes. `post_max_size` must allow multipart overhead beyond an individual file's limit. Whole-file encryption, multipart construction, and blob delivery amplify peak memory; size workers using measured workloads. Review Python's read-entire-upload-before-validation behavior and image/PDF complexity limits; file size alone does not bound render memory/CPU.

Encrypted files, model caches, logs, database volume, temporary images and backups need capacity monitoring. Define quotas and cleanup for abandoned upload-first flows and temporary crashes; no scheduled cleanup implementation was found. S3 storage is **not a drop-in environment change**: source uses the local disk, and the Composer lock lacks the required S3 Flysystem adapter. An S3 transition requires separate authorized implementation and validation.

## 15. External Services and Integrations

| Service | Current implementation | Production action / evidence limit |
| --- | --- | --- |
| SMTP email | Synchronous password/verification mail and account-approval mail | Choose provider, private credentials, permitted outbound port, sender domain and SPF/DKIM/DMARC; actual delivery **NEEDS VERIFICATION** |
| Python OCR | Laravel server-side multipart POST to `/api/ocr`, timeout 120 seconds | Private loopback endpoint and supervised Uvicorn process; actual Ubuntu OCR **NEEDS VERIFICATION** |
| Paddle model downloads | Engine warms up at service startup and can fetch model weights | Permit deliberate initial downloads/cache and verify restart without surprise network dependence |
| unpkg PDF worker | Browser loads version-specific PDF.js worker | Verify worker fetch under HTTPS/CSP and exact version matching |
| Google Fonts | Browser font requests in `F/index.html` | Account for CSP/privacy/availability or self-host in a future change |
| Groq | Config key exists; no current API invocation found | Not a required runtime integration on inspected source; rotate if exposed |
| SES/Postmark/Resend/Slack/S3/Redis/etc. | Mostly framework configuration options | Not evidence of configured production services; extra adapters/extensions may be needed |

No payment integration, external OAuth sign-in, application WebSocket broker, or push-notification provider was found. Notifications are database/API records. Online-user statistics rely on request activity updates, not an established websocket presence system.

## 16. AWS EC2 Compatibility Assessment

| Proposed component | Assessment |
| --- | --- |
| Ubuntu EC2 | Compatible in principle; exact AMI/runtime/native OCR validation pending |
| Apache2 | Suitable for static React plus Laravel public front controller |
| MySQL | Appropriate engine; exact target version and migration execution pending |
| Cloudflare DNS/proxy | Suitable with correct TLS, cookie, cache, upload and timeout rules |
| Certbot | Suitable after domain/challenge/webserver decisions |
| Git/GitHub | Suitable once the approved release includes required local fixes and lockfile |
| SSH administration | Suitable; dedicated identity/least privilege and audited runbook required |
| PM2 | No persistent Node application requires it; native process management is preferable for Python/PHP workers |

Recommended software: Apache 2.4-family with SSL/rewrite and suitable PHP handling, PHP runtime/extensions and CLI, Composer 2.x, MySQL, a dedicated Python 3.11 environment/Uvicorn with the OCR stack, Ghostscript/Tesseract-English, process manager (systemd or Supervisor), Certbot using an approved installation method, and log/backup tooling. Node/npm are build-time requirements if building on the instance.

**Initial sizing estimate, not a benchmark or spending approval:** for a dedicated low-concurrency pilot with Apache/PHP, MySQL and CPU PaddleOCR on one instance, start planning around **2 vCPU, 8 GiB RAM, and at least 40 GiB encrypted persistent storage**, then increase for archive size, temporary images, DB growth and backups. A 4 GiB instance may support limited/serialized workloads but must pass representative OCR/large-file tests; do not assume a micro instance is adequate. Higher concurrency likely needs additional CPU/RAM or separated OCR/database services. Match the chosen instance's actual architecture and resources against [AWS instance specifications](https://docs.aws.amazon.com/ec2/latest/instancetypes/gp.html).

An administrator-selected **2–4 GiB swap** allowance can protect a pilot from short peaks, but it is not additional usable OCR capacity or a substitute for RAM. Monitor swap/OOM behavior and disk I/O; prefer scaling or serializing work over persistent swapping. Capacity/resource numbers are engineering starting estimates, not guaranteed minimums.

**New dedicated instance:** choose the AMI/CPU architecture intentionally, isolate this application's DB/service accounts, configure only needed services, and test before publishing DNS. Security-group/UFW rules should permit web traffic and restrict SSH to approved administrator access. MySQL, OCR, development Vite/Artisan ports, and any Redis service must not be public.

**Existing shared instance:** compatibility is **NEEDS VERIFICATION**. Before changes, inspect OS/architecture, PHP CLI vs web runtime, modules/FPM pools, Apache MPM/vhosts/modules, occupied ports, MySQL version/users/SQL mode, available CPU/RAM/storage/swap, existing application ownership, scheduled jobs, service units, certificates, DNS/proxy rules, firewall/security groups and backup/rollback state. Use a separate app owner, DB, FPM pool, storage/temp/model cache, vhosts and service names. Do not globally switch PHP, Apache MPM, Python, default sites, or package versions to accommodate this project without reviewing other hosted applications.

## 17. Apache and Domain Requirements

Recommended straightforward mapping: **one frontend hostname and one API hostname under the same registrable domain**, on the same EC2 server for the initial deployment. Exact names are undecided. Both must use HTTPS. Alternatively, same-origin routing can be designed; do not improvise an API-to-subdirectory rewrite that changes Laravel's expected `/api/v1` path.

- Frontend DocumentRoot: only the approved release's **`F/dist`**.
- API DocumentRoot: only the approved release's **`B/public`**.
- Never serve the monorepo root or Laravel project root.
- Enable/apply rewrite behavior for Laravel `public/.htaccess`, including Authorization preservation and `index.php` front-controller handling.
- Provide SPA fallback using a scoped rewrite or `FallbackResource /index.html`, preserving assets and ACME challenges. On a shared-origin design, explicitly exclude API/health/storage framework routes from SPA fallback.
- Disable directory listing, deny sensitive dotfiles/config/backups, and avoid mapping private storage. Keep the handoff document outside served roots.
- Use an isolated PHP-FPM pool/socket if appropriate for the host. The PHP version/socket path and Apache modules must be derived from actual installed configuration. [Apache PHP-FPM integration](https://httpd.apache.org/docs/2.4/mod/mod_proxy_fcgi.html).
- Restrict PHP execution to the backend entry point/public PHP scope; frontend assets and upload paths must not execute scripts.
- Preserve response `no-store` for authenticated files/API; apply long immutable caching only to hashed frontend assets. Keep `index.html` refreshable across releases.

No final vhost config is supplied because hostnames, approved paths, TLS certificate locations, PHP handler/socket, and existing server configuration are unknown. The receiving assistant should generate the concrete vhosts only after those inputs are verified; copying another project's config is insufficient.

## 18. Cloudflare and SSL Requirements

Use end-to-end HTTPS with **Full (strict)** once the origin presents a valid matching, unexpired certificate. Flexible mode is unsuitable for this design. The edge certificate and the Apache origin certificate are separate responsibilities. [Cloudflare Full (strict)](https://developers.cloudflare.com/ssl/origin-configuration/ssl-modes/full-strict/).

Choose Certbot's HTTP-01 or DNS-01 method with the administrator. HTTP-01 requires a reachable challenge path on port 80; DNS-01 requires DNS control and secure handling of any automation credential. Cloudflare proxying need not be categorically disabled, but redirect/WAF/cache rules must not block the selected challenge. Test renewal after configuration and monitor expiration. [Let's Encrypt challenge requirements](https://letsencrypt.org/docs/challenge-types/).

Set cache bypass for `/api/*`, authenticated/signed storage routes and private document requests; do not apply “Cache Everything” to authentication or private data. Verify Cloudflare's actual plan upload limits against 50 MiB application uploads, including multipart overhead.

Current Cloudflare documentation describes a default **125-second proxy read timeout** and a **30-second proxy write timeout**. Laravel's 120-second OCR HTTP timeout plus parsing/encryption/DB processing can exceed the read budget; slow uploads can hit the write budget. Increasing Apache/PHP limits alone does not fix edge limits. Test worst-case PDFs, use the current skip-extraction option where suitable, and consider a future authorized asynchronous extraction design. [Cloudflare Error 524](https://developers.cloudflare.com/support/troubleshooting/http-status-codes/cloudflare-5xx-errors/error-524/).

Secure API cookies should be host-only where feasible. For sibling HTTPS hostnames under the same site, credentialed CORS and SameSite Lax can support the flow, but require actual browser acceptance checks. Unrelated frontend/API domains will generally require authentication/cookie design changes; the current login code hardcodes Lax. If broad parent-domain cookies are chosen, assess sibling-host exposure and logout cookie domain/path behavior.

Restore real client IPs only through trusted Cloudflare/other proxy handling. Consider origin firewall restrictions only after ACME/administrator access requirements are designed; never blindly block required management/renewal traffic.

## 19. Recommended Production Deployment Architecture

The initial recommendation is a **dedicated Ubuntu EC2 instance**, two same-site HTTPS vhosts, static React, Laravel via an isolated PHP runtime, local/private MySQL, local/private encrypted storage, and private Uvicorn OCR. Use systemd or Supervisor for OCR and any queue worker. This recommendation minimizes changes to the storage/database assumptions; it is not a completed server design or approval to buy an instance.

Suggested logical directory structure, **relative to an administrator-approved application base**:

```text
<APP_BASE>/
  releases/<RELEASE_ID>/
    EduArchive-Frontend-React/dist/
    EduArchive-Backend-Laravel/
      public/                  # API document root
      vendor/                  # installed on compatible target/build platform
      bootstrap/cache/         # release-local generated configuration/routes
      ocr-service/             # source plus Linux environment or approved env path
  shared/
    backend.env                # private; linked/injected into backend
    storage/                   # persistent private files, logs, framework state
    ocr-models/                 # service-owned model cache
    private-tmp/                # private OCR/PDF temporary workspace
  current -> releases/<RELEASE_ID>
```

All bracketed names/paths are placeholders. Do not treat this as an existing filesystem location. Keep DB/backup volumes and off-instance backup destinations separately planned. Secrets must not be checked into releases or stored in the public directories. Shared storage symlinks must retain the backend's expected `storage/app/private` paths.

Permissions: deploy identity owns source/releases; web/worker identities read required source/config and write only `storage`, `bootstrap/cache` as required, private temp, and OCR model/cache paths. Use a controlled group/ACL model; private configuration should have narrowly scoped read access (for example owner/group-only rather than world-readable). Avoid whole-repository writable ownership and recursive `777`. On shared hosts, dedicated identities/private temp are especially important.

Service plan:

- Apache/PHP: request-serving runtime; no Artisan development server.
- Uvicorn: `main:app`, loopback port 8001, no reload, start with one process initially to avoid multiplying model memory; restart policy and health monitoring required. Direct `python main.py` uses public binding and reload and should not be the production entrypoint.
- Laravel queue: required when dispatching the backfill job or enabling more queued work; existing normal upload still has synchronous extraction. `ExtractPdfTextJob` timeout is 600 seconds and tries is two; database queue retry-after defaults to 90. Set a greater retry-after and graceful service-stop allowance before production use. Multiple workers must not concurrently reclaim one long job. [Laravel queue timing and restart guidance](https://laravel.com/docs/12.x/queues).
- Scheduler: no application scheduled tasks were found in `routes/console.php`; `inspire` is an on-demand console command. No app scheduler cron is presently required. If token/code/temp cleanup is introduced, it needs a separately reviewed schedule.
- Node: build tooling only; no PM2 Node service required by current architecture.

## 20. Required Deployment Commands

**REFERENCE ONLY — these commands were not executed as deployment actions.** They are conditional templates for a later authorized deployment after blockers are resolved. Shell variables below represent administrator-approved paths, hostnames, service names and backup destinations; they are not application environment-variable recommendations. Do not run with unset or guessed variables.

### Read-only target inventory — Ubuntu SSH session

```bash
cat /etc/os-release
uname -m
php -v
php -m
composer --version
node --version
npm --version
python3 --version
mysql --version
apache2ctl -v
sudo apache2ctl -S
sudo apache2ctl -M
free -h
df -h
swapon --show
sudo ss -lntp
systemctl list-units --type=service --state=running
systemctl list-timers --all
```

MySQL client version is not sufficient evidence of server version. Inspect the server and schema with an authorized DB session without exposing records/credentials. Review service/vhost/firewall details locally and redact secrets before sharing them. Do not paste `.env`, password-bearing connection URLs, complete service environments or private configuration dumps into ChatGPT.

### Release identity — Windows PowerShell on administrator laptop

```powershell
git status --short
git rev-parse HEAD
git diff --stat
# Build commands from sections 7–8 use npm.cmd on PowerShell.
```

Check out an owner-approved immutable release including the two migration fixes, OCR requirements fix, backend npm lock, URL/security corrections and dependency remediation. Fetch/clone/install belong to the later deployment task; no Git push/stage/commit was performed during this inspection.

### Backend installation — Ubuntu SSH session, approved backend release directory

```bash
cd "$BACKEND_RELEASE"
composer install --no-dev --prefer-dist --no-interaction --optimize-autoloader
composer check-platform-reqs --no-dev
# If building backend assets on this machine:
npm ci
npm run build
```

Arrange private backend configuration, persistent storage and narrow permissions using the verified target paths/identities. Do not use a generic recursive ownership command from an unrelated project. **Generate a new app key only for a genuinely empty deployment without encrypted assets:**

```bash
php artisan key:generate
```

For a restore, preserve the original key through the private restore process instead. Do not execute key generation on an existing archive. No production-safe seeding command is provided because the supplied default seeder is unsafe unchanged.

### Database initialization / upgrade — Ubuntu SSH session from backend, later approved window

```bash
# Requires correct private MySQL configuration and approved backup/init decision:
php artisan migrate:status
php artisan migrate --force
```

These include database access/mutations and were **NOT RUN** here. For fresh deployment, create the administrator-chosen DB and scoped account using a private interactive DB administration workflow; then apply the safe role/admin bootstrap approved by the source owner. Do not paste credentials into SQL command arguments or shell history. For existing data, restore or upgrade according to a rehearsed plan and migration-table state; do not import a full-schema backup and independently recreate the same schema blindly.

**Do not run:** `migrate:fresh`, `migrate:refresh`, destructive seeders, blanket `db:seed`, `composer run setup`, or an automatic rollback as troubleshooting.

### Frontend build — Ubuntu build host from approved frontend directory

```bash
cd "$FRONTEND_RELEASE"
npm ci
npm run build
```

Publish only the approved fresh `dist` to the frontend vhost location. If built on Windows, transfer the generated static files as a release artifact; recreate OS-native backend/Python dependencies on a compatible Linux environment.

### OCR preparation/start — Ubuntu SSH session from approved OCR directory

```bash
cd "$OCR_RELEASE"
# Conditional future setup; requires a verified Python 3.11 executable:
python3.11 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/python -m pip check
# Service ExecStart candidate; run under a process manager with this working directory:
.venv/bin/python -m uvicorn main:app --host 127.0.0.1 --port 8001
```

The pinned Python dependency set has a known advisory and needs remediation/approval before installation. Model warm-up may download files. Exact system library/package installation commands cannot be finalized until Ubuntu version, repository policy, architecture and existing host requirements are inspected. Do not upgrade the host's default Python globally.

### Cache/service handling — Ubuntu SSH session from backend

```bash
php artisan route:cache
php artisan view:cache
# Only if public-disk content is intentionally used and this link is needed:
php artisan storage:link
# Queue service ExecStart candidate AFTER retry-after correction:
php artisan queue:work --sleep=3 --tries=2 --timeout=600
# During approved update, with app-isolated working cache and process supervision:
php artisan queue:restart
```

**Hold `config:cache` / blanket `artisan optimize` until `OCR_SERVICE_URL` handling is fixed or deliberately injected into every relevant process environment and tested.** Do not use `optimize:clear` blindly on shared cache services; it can clear application cache state. Route/view caching, storage linking and queue restart were not executed in this audit.

### Web/TLS activation — Ubuntu SSH session, only after reviewed vhosts and services

```bash
sudo apache2ctl configtest
sudo systemctl reload apache2
# Conditional Certbot Apache method, real hosts chosen by administrator:
sudo certbot --apache -d "$FRONTEND_HOST" -d "$API_HOST"
sudo certbot renew --dry-run
```

Certbot may alter Apache configuration and contact certificate infrastructure. These are later deployment operations, not current inspection checks. A shared host may need a different certificate method and scoped activation. No `a2dissite`/global PHP switch/package-install recipe is authorized here.

### Later smoke checks — Ubuntu SSH session / administrator browser

```bash
curl --fail --silent --show-error http://127.0.0.1:8001/health
curl --fail --silent --show-error "https://$API_HOST/up"
```

Use an approved synthetic PDF for OCR validation; do not send confidential archive files to external tools. Test UI login/roles/uploads/approvals/PDFs/IMRAD/search/logout/email over the real HTTPS domains. Status 200 from a health endpoint alone is insufficient.

## 21. Deployment Risks and Blockers

| Priority | Finding | Required disposition / evidence |
| --- | --- | --- |
| BLOCKER | Frontend hardcoded localhost API URL | Authorized configuration/source change, fresh bundle, real HTTPS/CORS/browser proof |
| BLOCKER | Shared document/metadata routes lack required visitor/publication/ownership boundaries | Source-owner visibility decision, backend enforcement and role/ID-based negative tests |
| BLOCKER | Cookie CSRF and account verification/token lifecycle gaps | Reviewed auth design and implemented/verified corrections |
| BLOCKER | Fixed approved administrator/demo passwords in seeders | Safe bootstrap and rotation of any deployed reused accounts |
| BLOCKER | Security advisory audits fail for current release dependencies | Authorized dependency remediation or evidence-based disposition; rerun audits and regressions |
| BLOCKER | Required local fixes absent from GitHub HEAD | Approve and publish an exact release containing fixes/locks without sharing credentials |
| HIGH | Python OCR/PHP native tools have not run on target Ubuntu | Linux install/import/startup + synthetic scanned/text PDF tests under real service accounts |
| HIGH | Laravel 50 MiB vs Python 20 MiB/50-page limits, synchronous extraction and proxy budget | Agree workload limits and test long/large documents; consider separately approved async changes |
| HIGH | Queue job timeout 600 vs default retry-after 90 | Align retry and timeout and supervise/restart correctly |
| HIGH | Loss/replacement of encryption key during restore | Restore test with matched DB/files/key; no blind key generation |
| HIGH | File paths supplied by clients; temporary plaintext; no quotas/cleanup | Ownership/retention/upload security review; private temp and disk-failure tests |
| HIGH | Visitor adviser listing calls nonexistent `User::advisedCapstones` relation | Static defect at `VisitorCapstoneController.php:120`; `User.php` has no such relation; endpoint runtime proof pending |
| HIGH | PDF-token faculty ownership check uses nonexistent `uploader_id` instead of mapped `uploaded_by` | Static mismatch at `CapstoneController.php:931`; token validation is also not used by the actual PDF-serving methods |
| QUALITY | Lint failure and undefined `debouncedSearch` | 71 errors/30 warnings; empty-state rendering defect at `F/src/pages/student/StudentBrowseCapstones.jsx:151`; component exists but is not routed in current `App.jsx` |
| NEEDS VERIFICATION | SMTP sender/delivery, DB/server configuration, all role workflows and exact domains | Administrator/provider/staging evidence |

### Executed dependency audit findings

These are advisory database results for resolved dependencies, **not proof of every reported exploit in this application**. Counts are affected-package/advisory-entry counts, not unique exploitable application flaws.

- **Frontend `npm audit --json --ignore-scripts`: FAILED, exit 1.** 40 affected packages: **1 critical, 34 high, 3 moderate, 2 low**. Critical result is transitive `tar`; other affected entries include root PDF.js, Axios, React Router and Vite plus propagated viewer-package entries. Some concern build/dev/Node or SSR codepaths; this application deploys a browser SPA, not an SSR Node server. Review reachability individually.
- Root `pdfjs-dist 3.11.174` is in the known malicious-PDF JavaScript advisory range. The actual inspected PDF pages import `react-pdf`, whose nested version is `5.4.296`; no first-party imports of `@react-pdf-viewer` were found. Do not claim the vulnerable root PDF.js is necessarily bundled in those pages, but do remediate the stale viewer dependency chain and verify the emitted bundle. [PDF.js publisher advisory](https://github.com/mozilla/pdf.js/security/advisories/GHSA-wgrm-67xf-hhpq).
- **Backend npm audit: PASSED, exit 0, zero reported vulnerabilities** in its current untracked lockfile at query time. This does not validate the PHP or Python dependencies.
- **Composer `audit --locked --no-dev --format=json`: FAILED, exit 1.** **40 advisory entries across 11 packages:** `guzzlehttp/guzzle 7.10.0`, `guzzlehttp/psr7 2.8.0`, `laravel/framework 12.53.0`, `league/commonmark 2.8.0`, `league/flysystem 3.32.0`, Symfony http-foundation/http-kernel/mailer/mime/routing `7.4.6`, and polyfill-intl-idn `1.33.0`. Some duplicate advisory identifiers appear in separate registry entries. No abandoned packages were reported. Distinguish source usage from package presence and update within an approved compatible release, not opportunistically during deployment.
- **Python advisory verification:** pinned `python-multipart 0.0.12` is below the fixed `0.0.18` range for a multipart parser denial-of-service issue; FastAPI's file endpoint uses multipart parsing. Private network isolation reduces direct exposure but is not dependency remediation. [python-multipart publisher advisory](https://github.com/Kludex/python-multipart/security/advisories/GHSA-59g5-xgcq-4qw3).
- A comprehensive Python advisory-tool scan was **NOT RUN**: no such scanner was established in the environment and installing one would violate this task. `uv pip check` validates package consistency, not vulnerability absence. Review all Python/native packages in a separately authorized remediation task.

Audit queries are a point-in-time snapshot; rerun on the final approved release immediately before deployment. No dependency fixes were applied.

## 22. Production Validation Checklist

### Checks executed during this inspection

| Check | Status | Actual result / boundary |
| --- | --- | --- |
| Git/workspace inventory | PASSED | HEAD/branch, dirty files, tracked source and component inventory inspected |
| Frontend/backend JSON and lock root dependency maps | PASSED | Parsed successfully; root manifest dependency maps and installed direct versions match current npm locks |
| Composer definition/lock validation | PASSED | `composer.bat validate --strict --no-check-publish` succeeded |
| Backend installed platform requirements | PASSED | `composer.bat check-platform-reqs --no-dev` succeeded on local PHP 8.3.16; not Ubuntu/FPM proof |
| Frontend production bundling in memory | PASSED | Vite API with write disabled; 833 modules; duplicate JSX style warning |
| Backend Vite production bundling in memory | PASSED | Vite API with write disabled; 58 modules |
| PHP syntax | PASSED | `php -l` across 97 first-party PHP files including migrations/config/routes/tests/artisan; no syntax failures |
| Laravel route discovery | PASSED | `php artisan route:list --json`; 118 routes including 113 API routes; no endpoint/DB behavior test |
| Existing pure unit test | PASSED | `php vendor/phpunit/phpunit/phpunit --testsuite Unit --do-not-cache-result`; 1 test, 1 assertion (`true` assertion only) |
| Python source syntax | PASSED | `ast.parse` for three OCR Python files; no bytecode files written |
| OCR installed dependency consistency | PASSED | Existing project-local `uv.exe pip check --python .../.venv/Scripts/python.exe`; 66 packages compatible |
| Relative frontend imports/casing | PASSED | No missing/case-mismatched relative source imports found; not a complete Linux runtime test |
| Current/history limited credential scan | PASSED within limited scope | No tracked/historical sensitive filenames or recognizable provider/private-key signatures; hardcoded account credentials explicitly found and flagged |
| Frontend lint | FAILED | `npm.cmd run lint`: 101 problems, 71 errors and 30 warnings |
| Frontend advisory audit | FAILED | 40 affected packages; severity totals in section 21 |
| Backend npm advisory audit | PASSED | Zero reported vulnerabilities at query time |
| Composer runtime advisory audit | FAILED | 40 advisory entries / 11 packages |
| Python multipart advisory comparison | FAILED | Pinned version is in publisher-declared vulnerable range |
| Migration consistency static inspection | PASSED as inspection only | 27 files and local duplicate-column fixes reviewed; execution compatibility still unverified |

Initial inspection wrapper attempts also failed: Windows argument quoting broke the first Node `-e` build commands; a PHPUnit path omitted its final executable filename; the OCR environment has no `pip` module; one source read used incompatible console/default encoding. They were corrected with stdin-based Node execution, the actual PHPUnit executable path, existing project-local uv, and explicit UTF-8 reads. Successful retests above are the operative results; those wrapper failures were not repaired application defects.

### Checks not executed / acceptance still required

| Check | Status | Reason / required evidence |
| --- | --- | --- |
| Exact `npm run build` disk emission | NOT RUN | Avoid replacing existing generated artifacts; in-memory equivalent bundling was performed |
| Fresh `npm ci`, Composer install, Python install | NOT RUN | Dependency changes/installation excluded by user |
| Framework feature test / full `artisan test` or Composer test script | NOT RUN | Root-page feature test compiles Blade views; Composer test script clears config cache. Avoid changing runtime cache/files. Existing suite has only one additional root-200 example test |
| Migrations, seeders, DB import/export, DB record queries | NOT RUN | Explicit database mutation/confidential-data constraints; static inspection only |
| Live local browser/API role/upload flows | NOT RUN | No runtime workflow exercise or user/data mutations authorized for this audit; source/route/build checks do not prove them |
| OCR model import/startup/recognition benchmark | NOT RUN | Starting/importing engine can warm/download/cache models; do not alter service state. Dependency consistency alone is insufficient |
| Full Python vulnerability scan | NOT RUN | No established scanner; no installation authorized; one publisher advisory independently checked |
| Ubuntu install/PHP-FPM/native OCR execution | NEEDS VERIFICATION | No target Linux environment supplied/accessed |
| Actual MySQL version/schema/migration-table state | NEEDS VERIFICATION | No database connection executed; setup-note version is historical evidence only |
| Production domain/CORS/cookie/CSRF acceptance | NEEDS VERIFICATION | Real domains/configuration/security corrections not supplied |
| Real SMTP delivery and sender authentication | NEEDS VERIFICATION | No provider/account access or mail sending performed |
| EC2/vhosts/security groups/firewall/Cloudflare/Certbot | NEEDS VERIFICATION | No production infrastructure accessed |
| Backup restore and schema rollback rehearsal | NEEDS VERIFICATION | Requires authorized disposable target and confidential asset handling |
| Concurrent large/scanned PDF behavior | NEEDS VERIFICATION | Requires agreed workload, target resources and synthetic representative PDFs |

### Required later production acceptance checklist

- [ ] Exact approved release includes local migration/OCR/lock changes and security fixes; no secrets or default credentials in shared documentation/artifacts.
- [ ] Target runtime/extensions/MySQL/native tools are verified under the actual web/worker identities.
- [ ] Database initialized/upgraded successfully on a rehearsed disposable environment; safe roles/admin created; no demo/destructive seeder used.
- [ ] Database/files/key backup restores readable PDFs, metadata, user access and search indexes.
- [ ] HTTPS API URL is present in fresh frontend output; SPA route refresh, CORS preflight and credentialed calls work.
- [ ] Login, logout, expiry, archive/approval revocation, password reset/change and server-side email verification are tested.
- [ ] Negative authorization tests cover every role, document status/archive state, guessed IDs, shared vs visitor routes, metadata fields, resource links and downloads.
- [ ] CSRF/security decisions are implemented and validated with actual browser origins.
- [ ] Embedded/scanned PDFs, supplementary resources and IMRAD work; largest accepted files/page counts and failed OCR behavior are tested.
- [ ] OCR restarts with persistent model cache, private bind, no reload and expected health; worker retries/timeouts avoid duplicate long jobs.
- [ ] Production debug is disabled; error responses/logs/headers and trusted proxy/IP behavior are verified.
- [ ] Apache denies configuration/Git/private files; DB/OCR/dev ports are not public; service/file permissions are narrow.
- [ ] Cloudflare does not cache private responses; upload/proxy limits and origin TLS/Certbot renewal are verified.
- [ ] SMTP verification/reset/approval messages reach real test recipients with authenticated sender DNS.
- [ ] Final lockfile advisory checks and lint/test results meet the owner's release policy.
- [ ] Monitoring, backup alerts, disk capacity, certificate expiration and rollback runbook have assigned owners.

## 23. Backup, Updates, and Rollback

Back up **together**: MySQL database/schema/migration state, `storage/app/private` and any public assets, application encryption key/previous keys through a separate secure channel, approved code/lockfiles, and required service/vhost configuration. Database content includes extracted document text, account details and audit/verification records; encrypt backups and restrict access. Local EBS persistence or a same-instance backup is not sufficient protection against instance loss.

Choose off-instance retention, recovery point/time objectives and restore ownership. For an existing shared host, isolate this app's backup/restore from other databases and users. Stop or consistently coordinate writes when capturing database/file pairs. Database backup commands must not include passwords in arguments; use administrator-approved credential handling and never export confidential records into this handoff.

Conditional backup template, **Ubuntu SSH session**, after the administrator verifies MySQL tooling, private authentication, database name and protected destination:

```bash
mysqldump --single-transaction --routines --triggers --events \
  --databases "$DATABASE_NAME" --result-file="$DB_BACKUP_PATH"
```

This command was **NOT RUN** and is not a complete backup procedure. Coordinate migration/DDL activity, consistent file capture, secure key backup, encryption, retention and restore tests. Use a scoped DB backup account where appropriate. Do not place dumps beneath either web root or commit them.

Updates should build a new immutable release, retain previous artifacts, rehearse migrations/security checks, back up before data changes, pause/drain processing as required, activate vhosts/current release, refresh release-local caches safely, restart long-lived workers/OCR, and perform acceptance before restoring traffic. Rebuilding a bundle without updating `index.html` and hashed assets as one release can produce broken mixed versions.

Rollback must distinguish application-code rollback from database reversal. The view deduplication and old publication-column removal are not safely undone by switching a symlink. Never issue blind `migrate:rollback` on production. Decide whether to forward-fix or restore a coordinated DB/files/key snapshot, and account for new data created after the backup. A dedicated instance snapshot can supplement, but does not replace, a tested application restore plan.

Logging/monitoring requirements: scoped Apache access/error logs; Laravel log rotation and restricted failed-job records; OCR process/journal logs; service restart/OOM alarms; queue backlog/failed-job monitoring; disk/temp/model cache size; DB connections/slow queries; external health checks; SMTP failures; certificate expiration/renewal alerts. The configured Laravel default stack can write a single growing file; choose rotation deliberately. No complete production monitoring/backup implementation was found.

## 24. Questions Requiring Deployment Administrator Input

1. Is the target a new dedicated EC2 instance or a shared server? What are the verified Ubuntu version, CPU architecture, PHP web/CLI runtimes, Apache configuration and available resources?
2. What exact frontend/API hostnames will be used? Can they be sibling HTTPS hosts under one registrable domain, or is same-origin routing required?
3. Who controls DNS/Cloudflare, which proxy plan/rules apply, and who owns the origin certificate and renewal method?
4. Which immutable repository release will contain the current local fixes and future URL/security/dependency corrections? Who authorizes/publishes it?
5. Is this a fresh empty archive or a migration of an existing archive? Where are the owner-controlled DB/files/key backups, and has their paired restore been rehearsed? **Do not provide their contents in chat.**
6. What approved database name/account, MySQL server version, encoding and least-privilege model will be used? Is DB local EC2 or an already approved managed service?
7. Who receives the initial administrator account, and what secure bootstrap/rotation procedure replaces the shipped fixed credentials?
8. What are the intended document/metadata visibility rules for each role, especially visitors, unpublished/archived capstones, IMRAD and shared endpoints? Who approves the required security corrections?
9. Are scanned PDFs required at launch? What maximum file size/page count, upload concurrency, response time and acceptable skip/manual-extraction behavior apply?
10. Which SMTP provider/sender domain is approved? Are sender authentication, outbound connectivity and delivery testing available?
11. What app base path, deployment owner/group, FPM pool, service names, temporary/model-cache locations and backup destinations are approved?
12. What backup retention, recovery objectives, update window and rollback authority apply? Who monitors capacity, certificate renewal, email and failed processing?
13. What release policy applies to current lint errors and dependency advisories? Who will perform/approve remediation and negative role/security tests?
14. Should public branding consistently be AcadeX, EduArchive, or another owner-approved name? Are CDN fonts/PDF workers acceptable or must they be self-hosted?

The administrator can provide nonsecret configuration facts and decisions. Secret values should be entered privately through their own approved tooling, not copied into another ChatGPT conversation.

## 25. Final Deployment Readiness Verdict

**NOT READY FOR PUBLIC PRODUCTION DEPLOYMENT.** The application is an identifiable React SPA + Laravel/MySQL API + Python OCR system with a plausible EC2/Apache architecture and a statically reconstructible fresh schema. Local compilation, syntax, route discovery, package consistency and one trivial unit test passed. They do not establish secure document access, correct production integration, successful Linux/native processing, database migration execution, browser workflows, mail delivery or operational recovery.

Before public launch, resolve the localhost build configuration, shared document/metadata authorization, auth/verification/token/CSRF concerns, seeded credentials, advisory failures and exact release packaging. Then prove the target runtime/database/OCR and real HTTPS workflows in an authorized staging environment with the agreed role policy and synthetic/test data. Existing shared-server compatibility remains unverified.

**Handoff outcome:** discovery and documentation completed; deployment remains held. This report contains no credential values or confidential records and performs no deployment or source repair.
