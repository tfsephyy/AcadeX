# AcadeX release readiness — remediation candidate

Prepared **October 13, 2026, Asia/Manila** from the current working tree. This document supersedes the original handoff's descriptions of current authentication, authorization, dependency versions, configuration and test coverage. `CAPSTONE_AWS_DEPLOYMENT_HANDOFF.md` remains the historical discovery report; it was reread and its material findings checked against source. **No AWS infrastructure was accessed or deployed. No real development/archive records were queried, exported or changed. No commit, staging, push or publication was performed.**

**Verdict: NOT READY for public production.** The confirmed access-control blockers are remediated and the local synthetic security suite passes. This is a source candidate for independent review and **isolated, synthetic staging acceptance**, not a production release. Target Ubuntu execution, real HTTPS browser behavior, SMTP, backup restoration, operational limits and disposition of the remaining OCR advisories must be completed before launch. AWS staging itself requires a separately authorized deployment task; this report does not perform or authorize one.

All new tooling and application changes use free/open-source packages and local tools. No paid API, subscription, infrastructure purchase or paid monitoring product was added. AWS, storage, network traffic, SMTP and domains cannot be guaranteed free; the administrator must verify eligibility and usage limits against [AWS Free Tier](https://aws.amazon.com/free/) and their providers. PyMuPDF is available under AGPL or commercial licensing: use of its free edition still requires university review of the applicable license obligations; no commercial license was purchased. [PyMuPDF license documentation](https://pymupdf.readthedocs.io/en/latest/about.html#license-and-copyright).

Paths use **B** = `EduArchive-Backend-Laravel/`, **F** = `EduArchive-Frontend-React/`. Status meanings: **PASSED** actually executed successfully within the stated boundary; **FAILED** actually executed with an error/adverse result; **NOT RUN** intentionally omitted with a reason; **NEEDS VERIFICATION** requires additional target/provider/browser/owner evidence. Source inspection and successful tests are not guarantees against every future defect.

## 1. Corrected security findings

### Approved permission contract

The project owner explicitly approved this implementation matrix, **pending confirmation by the university's authorized representative**. The full contract is in `docs/ACADEX_ACCESS_POLICY.md`.

| Role | Metadata, full PDF, IMRAD and previewable resources | Downloads | Management/review |
| --- | --- | --- | --- |
| Admin | All records, including unpublished, rejected and archived | Allowed | Existing full oversight operations |
| Faculty | Own unarchived uploads; unarchived **student** submissions explicitly assigned to them as adviser; approved, published, unarchived records | Only documents they may view | Existing own-upload management; assigned student approval/rejection, not editing/deleting merely because of assignment |
| Student | Own unarchived submissions, including pending/rejected/unpublished; approved, published, unarchived records | Denied, retaining the existing student restriction | Own-upload workflow; an edit returns the record to pending/unpublished; no self-approval/publication |
| Visitor | Approved, published, unarchived records only | Denied | No document management; bookmarks/view recording require the same read permission |

Copyright status and IMRAD existence **do not** grant access to unpublished records. Supplementary documents inherit the parent boundary. Office/archive/unknown resource formats require download permission even on the preview route because browsers may download them despite `inline` disposition. Unknown roles, missing ownership, unrelated faculty and inconsistent publication/approval state default to denial. There is no general reviewer override or exceptional student grant; another university-approved workflow would require explicit implementation.

Owners retain their previous archive-list/delete/restore workflow, but archived files are admin-only. Restore keeps a record unpublished and does not grant approval. Public visibility requires both existing approval fields to agree with publication state. Existing inconsistent archive data therefore needs owner review, not automatic mass publication. Publishing an approved record is the current viewing grant; a separate per-document exception/permission workflow does not exist and was not invented. A download prohibition governs application operations; a browser receiving authorized document bytes can still save them. This is not DRM.

### Enforced boundaries and lifecycle

- **Shared and visitor route bypasses fixed:** `B/app/Services/CapstoneAccess.php`, `app/Policies/CapstonePolicy.php`, `app/Models/Capstone.php`, `CapstoneController.php` and `VisitorCapstoneController.php` apply the same policy to binding, listing, metadata, files, resource parent IDs, IMRAD, downloads, review, tracking, filtering, bookmarks and references. Denied ID lookups generally return 404; a visible record with a prohibited operation returns 403. Request-bound Eloquent scopes cover API model queries; raw chatbot joins/aggregates explicitly restrict their input IDs. Trusted CLI maintenance remains unscoped. Future raw SQL/API endpoints must preserve this boundary.
- **Sensitive serialization fixed:** extracted `pdf_text` and real private paths are hidden; availability flags replace path-based display checks. Author contact details are visible only to admin, owner and assigned student adviser. Existing attachment retention uses same-parent references. User-account activity chatbot results remain admin-only; private keyword hints and references are filtered.
- **Session and CSRF boundary corrected:** every browser API request now uses Laravel encrypted cookies and sessions. Mutations, including login/register/reset/verification, require the session-bound `X-CSRF-TOKEN`. `GET /api/v1/csrf-token` supplies it as non-cacheable JSON, allowing a host-only API cookie on a sibling HTTPS hostname. Axios holds the token in memory, refreshes it after auth transitions, and clears it on 401/419 without automatically replaying mutations. The former `auth_token` minting/cookie-to-bearer middleware hookup is removed; login/logout expire the legacy cookie. Sanctum authenticates the web session. This uses Laravel's session/CSRF machinery explicitly on API routes, not an assumed effect of `SANCTUM_STATEFUL_DOMAINS`. [Laravel Sanctum session authentication](https://laravel.com/docs/12.x/sanctum).
- **Server-side email verification enforced:** verification codes are hashed, expiring and atomically single-use. Registration and email changes consume a server-held, session-bound proof for the exact email; client timestamps/code claims do not establish verification. Existing unverified users have a password-protected resend/verification UI and cannot bypass approval. Old plaintext code rows are not accepted by the new lookup and should expire; historical retention cleanup was not performed.
- **Account revocation corrected:** password reset/change, email, role, approval and archival changes advance persisted `users.auth_version` under a row lock and revoke bearer tokens. Middleware rejects stale browser versions, archived/unapproved/unverified accounts and bearer tokens lacking an explicit future expiry. Password/email changes renew the current authenticated session; other sessions fail on their next request. Login regenerates the session; logout invalidates it. The reviewer identified a stale-model version race, which is fixed and regression-tested. Explicitly expiring bearer **reads** remain compatible, including tokens created more than two hours ago; unbounded old tokens are rejected. No new browser bearer token is issued. API mutations require CSRF; external mutation-token integrations were not found and would need a separately reviewed design.
- **Upload references secured:** encrypted uploads receive opaque UUID references bound to owner, document purpose, a 24-hour expiry and a single claim. Store/update resolve and lock those references in a transaction, reject arbitrary paths, cross-user/cross-parent/purpose reuse and invisible citations, and validate adviser assignment to active faculty. Existing same-parent IMRAD/resources can be retained without revealing paths. Encryption writes fail explicitly; corrupt ciphertext/wrong keys are no longer served as plaintext. No existing app key was regenerated.
- **Temporary/storage exposure reduced:** local-disk signed raw storage serving is disabled; encrypted storage stays private. PHP plaintext temp directories/files use 0700/0600 and fail if privacy cannot be established; Linux ownership/umask and Windows ACL acceptance still require target checks. Linux PATH detection is corrected. Public storage links must never point to private uploads.
- **Default administrator removed:** the default seeder now creates roles only. `acadex:bootstrap-admin` interactively creates the first verified approved administrator using a hidden strong password, identity confirmation and no overwrite of existing admins. Demo accounts receive random password inputs and demo/destructive seeders reject non-local/non-testing environments. No destructive seeder was executed. Accounts previously created with old seeded passwords require private rotation.

The mandated read-only investigation preceded edits; the independent read-only patch review identified raw chatbot keyword leakage, the stale-session race and an unintended global bearer age cutoff. All three were resolved with focused regressions before proceeding beyond Phase 1. The later resource-format download bypass also received a four-role regression.

## 2. Files changed and reasons

The precise path inventory appears at the end of this section. `ACADEX_RELEASE_MANIFEST.json` additionally identifies every included source file by SHA-256. Grouping below explains the behavior rather than repeating every import edit.

| Files / group | Reason |
| --- | --- |
| B `CapstoneAccess`, `CapstonePolicy`, Capstone/Keyword/Resource models; Capstone/Visitor controllers; base Controller; chatbot controllers/services | Consistent action/query authorization, archive workflow, safe metadata, raw-query restrictions, adviser relation/token typo correction |
| B Auth/PasswordReset controllers, User/PasswordResetCode models, EnsureActiveAccount, VerifyApiCsrfToken, EmailVerificationService, bootstrap/routes, Sanctum/session config | Session/CSRF authentication, verified email proofs, hashed codes, finite bearer expiry and revocation |
| B DocumentUpload, DocumentUploads, new upload migration, upload/store/update routes | Owner/purpose/expiry/single-use document references; transactional claim/retention |
| B PrivateTemp, PdfEncryptor/PdfExtractor/PdfText/FastOcr services, filesystem/acadex/queue config, TrustConfiguredProxies | Private plaintext, fail-closed decryption/writes, config-cache-safe OCR URL, Linux commands, retry timing, explicit proxy trust |
| B BootstrapAdmin, CheckProduction, Database/Capstone/ClearCapstones seeders, environment templates | Safe initial admin, nonsecret deployment checks, roles-only initialization, demo production guards, placeholders |
| B composer.lock | Compatible resolved runtime/security updates; Laravel remains major 12, Sanctum major 4 |
| B OCR requirements/hashed platform locks, main/engine/validators, tests; deploy templates and OCR operations doc | Compatible dependency remediation, bounded/serialized processing, private startup, model cache, resource limits, supervision preparation |
| B guarded runner, HTTP probe, security fixture/test suites | Approved disposable MySQL migrations and synthetic auth/document/upload/config/HTTP coverage, refusal of archive configuration/privileged credentials |
| F Axios/baseUrl/Vite/env example/tests | Public API build setting, production HTTPS validation and session CSRF handling |
| F document pages, EditCapstoneModal, admin API wrappers, Login/verification modal | Availability/retention-reference compatibility, dedicated IMRAD uploads, legacy email verification, locally bundled PDF worker |
| F provider/hook modules and hook import users | Split hooks from components to satisfy Fast Refresh lint while retaining the same shared contexts |
| F remaining small component/page lint fixes, eslint config, index.css | Remove unused bindings, fix undefined search and conditional hook, duplicate JSX style, recognize Node-config/uppercase JSX arguments, deterministic Tailwind scan |
| F package manifests/lock | Remove unused old viewer chain; compatible patched versions; retain prior hooks lint semantics via exact 7.0.1 rather than impose newly expanded compiler rules |

**Pre-existing work preserved:** root `.gitignore`, the September 22/26 guarded migration fixes, backend npm lock, local start/stop helpers and credential-bearing `SETUP.md`. The original OCR setuptools compatibility fix is retained as an exact compatible pin while the requirement set is upgraded. The backend npm lock and migration fixes are included in the source candidate because a HEAD-only clone omits them. Local helpers and `SETUP.md` were not edited/staged; `SETUP.md`, secrets, logs, test credentials, databases, model weights, uploads and dependency directories are excluded from the source archive. Generated `F/dist` and `B/public/build` were rebuilt for validation and are ignored artifacts. The frontend bundle contains a **synthetic `.invalid` API address**, so it must be rebuilt with the actual approved address before serving it.

### Exact remediation path inventory

The following paths are changed/new remediation files. The pre-existing files listed above are separately identified, not counted as new remediation.

| Path | Change category |
| --- | --- |
| `ACADEX_RELEASE_READINESS.md` | Release handoff / process template / integrity verification |
| `EduArchive-Backend-Laravel/.env.example` | Names-only private configuration template |
| `EduArchive-Backend-Laravel/.env.production.example` | Names-only private configuration template |
| `EduArchive-Backend-Laravel/.env.testing.example` | Names-only private configuration template |
| `EduArchive-Backend-Laravel/app/Console/Commands/BootstrapAdmin.php` | Interactive admin or nonsecret deployment checks |
| `EduArchive-Backend-Laravel/app/Console/Commands/CheckProduction.php` | Interactive admin or nonsecret deployment checks |
| `EduArchive-Backend-Laravel/app/Http/Controllers/Api/V1/AuthController.php` | Authorization/authentication/upload/storage boundary |
| `EduArchive-Backend-Laravel/app/Http/Controllers/Api/V1/CapstoneController.php` | Authorization/authentication/upload/storage boundary |
| `EduArchive-Backend-Laravel/app/Http/Controllers/Api/V1/ChatbotController.php` | Authorization/authentication/upload/storage boundary |
| `EduArchive-Backend-Laravel/app/Http/Controllers/Api/V1/PasswordResetController.php` | Authorization/authentication/upload/storage boundary |
| `EduArchive-Backend-Laravel/app/Http/Controllers/Api/V1/VisitorCapstoneController.php` | Authorization/authentication/upload/storage boundary |
| `EduArchive-Backend-Laravel/app/Http/Controllers/Controller.php` | Authorization/authentication/upload/storage boundary |
| `EduArchive-Backend-Laravel/app/Http/Middleware/EnsureActiveAccount.php` | Authorization/authentication/upload/storage boundary |
| `EduArchive-Backend-Laravel/app/Http/Middleware/TrustConfiguredProxies.php` | Authorization/authentication/upload/storage boundary |
| `EduArchive-Backend-Laravel/app/Http/Middleware/VerifyApiCsrfToken.php` | Authorization/authentication/upload/storage boundary |
| `EduArchive-Backend-Laravel/app/Models/Capstone.php` | Authorization/authentication/upload/storage boundary |
| `EduArchive-Backend-Laravel/app/Models/CapstoneResource.php` | Authorization/authentication/upload/storage boundary |
| `EduArchive-Backend-Laravel/app/Models/DocumentUpload.php` | Authorization/authentication/upload/storage boundary |
| `EduArchive-Backend-Laravel/app/Models/Keyword.php` | Authorization/authentication/upload/storage boundary |
| `EduArchive-Backend-Laravel/app/Models/PasswordResetCode.php` | Authorization/authentication/upload/storage boundary |
| `EduArchive-Backend-Laravel/app/Models/User.php` | Authorization/authentication/upload/storage boundary |
| `EduArchive-Backend-Laravel/app/Policies/CapstonePolicy.php` | Authorization/authentication/upload/storage boundary |
| `EduArchive-Backend-Laravel/app/Services/CapstoneAccess.php` | Authorization/authentication/upload/storage boundary |
| `EduArchive-Backend-Laravel/app/Services/Chatbot/ChatbotAnalyticsService.php` | Authorization/authentication/upload/storage boundary |
| `EduArchive-Backend-Laravel/app/Services/Chatbot/ChatbotQueryService.php` | Authorization/authentication/upload/storage boundary |
| `EduArchive-Backend-Laravel/app/Services/DocumentUploads.php` | Authorization/authentication/upload/storage boundary |
| `EduArchive-Backend-Laravel/app/Services/EmailVerificationService.php` | Authorization/authentication/upload/storage boundary |
| `EduArchive-Backend-Laravel/app/Services/FastOcrService.php` | Authorization/authentication/upload/storage boundary |
| `EduArchive-Backend-Laravel/app/Services/PdfEncryptorService.php` | Authorization/authentication/upload/storage boundary |
| `EduArchive-Backend-Laravel/app/Services/PdfExtractorService.php` | Authorization/authentication/upload/storage boundary |
| `EduArchive-Backend-Laravel/app/Services/PdfTextService.php` | Authorization/authentication/upload/storage boundary |
| `EduArchive-Backend-Laravel/app/Services/PrivateTemp.php` | Authorization/authentication/upload/storage boundary |
| `EduArchive-Backend-Laravel/bootstrap/app.php` | Authorization/authentication/upload/storage boundary |
| `EduArchive-Backend-Laravel/composer.lock` | Resolved dependency security updates |
| `EduArchive-Backend-Laravel/config/acadex.php` | Production/auth/storage/queue configuration |
| `EduArchive-Backend-Laravel/config/filesystems.php` | Production/auth/storage/queue configuration |
| `EduArchive-Backend-Laravel/config/queue.php` | Production/auth/storage/queue configuration |
| `EduArchive-Backend-Laravel/config/sanctum.php` | Production/auth/storage/queue configuration |
| `EduArchive-Backend-Laravel/config/session.php` | Production/auth/storage/queue configuration |
| `EduArchive-Backend-Laravel/database/migrations/2026_10_13_000001_secure_authentication_state.php` | Security/ownership schema |
| `EduArchive-Backend-Laravel/database/migrations/2026_10_13_000002_create_document_uploads_table.php` | Security/ownership schema |
| `EduArchive-Backend-Laravel/database/seeders/CapstoneSeeder.php` | Safe initialization / demo guard |
| `EduArchive-Backend-Laravel/database/seeders/ClearCapstonesSeeder.php` | Safe initialization / demo guard |
| `EduArchive-Backend-Laravel/database/seeders/DatabaseSeeder.php` | Safe initialization / demo guard |
| `EduArchive-Backend-Laravel/ocr-service/.env.example` | OCR compatibility / dependency / process safety |
| `EduArchive-Backend-Laravel/ocr-service/main.py` | OCR compatibility / dependency / process safety |
| `EduArchive-Backend-Laravel/ocr-service/ocr_service.py` | OCR compatibility / dependency / process safety |
| `EduArchive-Backend-Laravel/ocr-service/requirements-linux.lock` | OCR compatibility / dependency / process safety |
| `EduArchive-Backend-Laravel/ocr-service/requirements-windows.lock` | OCR compatibility / dependency / process safety |
| `EduArchive-Backend-Laravel/ocr-service/requirements.txt` | OCR compatibility / dependency / process safety |
| `EduArchive-Backend-Laravel/ocr-service/tests/probe_laravel_ocr.py` | Synthetic validation / isolation |
| `EduArchive-Backend-Laravel/ocr-service/tests/test_ocr.py` | Synthetic validation / isolation |
| `EduArchive-Backend-Laravel/ocr-service/validators.py` | OCR compatibility / dependency / process safety |
| `EduArchive-Backend-Laravel/routes/api.php` | Authorization/authentication/upload/storage boundary |
| `EduArchive-Backend-Laravel/scripts/http-security-probe.php` | Synthetic validation / isolation |
| `EduArchive-Backend-Laravel/scripts/run-security-tests.php` | Synthetic validation / isolation |
| `EduArchive-Backend-Laravel/tests/Feature/AdminBootstrapTest.php` | Synthetic validation / isolation |
| `EduArchive-Backend-Laravel/tests/Feature/AuthenticationSecurityTest.php` | Synthetic validation / isolation |
| `EduArchive-Backend-Laravel/tests/Feature/DocumentAuthorizationTest.php` | Synthetic validation / isolation |
| `EduArchive-Backend-Laravel/tests/Feature/ProductionConfigurationTest.php` | Synthetic validation / isolation |
| `EduArchive-Backend-Laravel/tests/Feature/UploadOwnershipTest.php` | Synthetic validation / isolation |
| `EduArchive-Backend-Laravel/tests/SecurityTestCase.php` | Synthetic validation / isolation |
| `EduArchive-Backend-Laravel/tests/Unit/ApiCsrfTest.php` | Synthetic validation / isolation |
| `EduArchive-Backend-Laravel/tests/Unit/TrustedProxyTest.php` | Synthetic validation / isolation |
| `EduArchive-Frontend-React/.env.example` | API URL / CSRF / build configuration |
| `EduArchive-Frontend-React/.gitignore` | Hook import compatibility / focused lint correction |
| `EduArchive-Frontend-React/eslint.config.js` | Hook import compatibility / focused lint correction |
| `EduArchive-Frontend-React/package-lock.json` | Compatible dependency lock / unused viewer removal |
| `EduArchive-Frontend-React/package.json` | Compatible dependency lock / unused viewer removal |
| `EduArchive-Frontend-React/src/api/admin.js` | API URL / CSRF / build configuration |
| `EduArchive-Frontend-React/src/api/axios.js` | API URL / CSRF / build configuration |
| `EduArchive-Frontend-React/src/api/baseUrl.js` | API URL / CSRF / build configuration |
| `EduArchive-Frontend-React/src/components/CategoryCombobox.jsx` | Hook import compatibility / focused lint correction |
| `EduArchive-Frontend-React/src/components/ChangeEmailModal.jsx` | Hook import compatibility / focused lint correction |
| `EduArchive-Frontend-React/src/components/Chatbot.jsx` | Hook import compatibility / focused lint correction |
| `EduArchive-Frontend-React/src/components/ForgotPasswordModal.jsx` | Hook import compatibility / focused lint correction |
| `EduArchive-Frontend-React/src/components/GuestRoute.jsx` | Hook import compatibility / focused lint correction |
| `EduArchive-Frontend-React/src/components/Navbar.jsx` | Hook import compatibility / focused lint correction |
| `EduArchive-Frontend-React/src/components/Notification.jsx` | Hook import compatibility / focused lint correction |
| `EduArchive-Frontend-React/src/components/Pagination.jsx` | Hook import compatibility / focused lint correction |
| `EduArchive-Frontend-React/src/components/ProfileModal.jsx` | Hook import compatibility / focused lint correction |
| `EduArchive-Frontend-React/src/components/ProtectedRoute.jsx` | Hook import compatibility / focused lint correction |
| `EduArchive-Frontend-React/src/components/ReviewExtractedDataPage.jsx` | Hook import compatibility / focused lint correction |
| `EduArchive-Frontend-React/src/components/VerifyAccountEmailModal.jsx` | Security response/auth UI / local PDF worker / lint compatibility |
| `EduArchive-Frontend-React/src/components/admin/AdminLayout.jsx` | Hook import compatibility / focused lint correction |
| `EduArchive-Frontend-React/src/components/admin/EditCapstoneModal.jsx` | Security response/auth UI / local PDF worker / lint compatibility |
| `EduArchive-Frontend-React/src/components/admin/UploadCapstoneModal.jsx` | Hook import compatibility / focused lint correction |
| `EduArchive-Frontend-React/src/components/faculty/FacultyLayout.jsx` | Hook import compatibility / focused lint correction |
| `EduArchive-Frontend-React/src/components/faculty/FacultyUploadCapstoneModal.jsx` | Hook import compatibility / focused lint correction |
| `EduArchive-Frontend-React/src/components/student/StudentLayout.jsx` | Hook import compatibility / focused lint correction |
| `EduArchive-Frontend-React/src/components/student/StudentUploadCapstoneModal.jsx` | Hook import compatibility / focused lint correction |
| `EduArchive-Frontend-React/src/components/useNotification.js` | Shared hook/context split for Fast Refresh |
| `EduArchive-Frontend-React/src/components/visitor/VisitorLayout.jsx` | Hook import compatibility / focused lint correction |
| `EduArchive-Frontend-React/src/context/AuthContext.jsx` | Shared hook/context split for Fast Refresh |
| `EduArchive-Frontend-React/src/context/ChatbotContext.jsx` | Shared hook/context split for Fast Refresh |
| `EduArchive-Frontend-React/src/context/ThemeContext.jsx` | Shared hook/context split for Fast Refresh |
| `EduArchive-Frontend-React/src/context/useAuth.js` | Shared hook/context split for Fast Refresh |
| `EduArchive-Frontend-React/src/context/useChatbotContext.js` | Shared hook/context split for Fast Refresh |
| `EduArchive-Frontend-React/src/context/useTheme.js` | Shared hook/context split for Fast Refresh |
| `EduArchive-Frontend-React/src/index.css` | Deterministic Tailwind source scan |
| `EduArchive-Frontend-React/src/pages/Dashboard.jsx` | Hook import compatibility / focused lint correction |
| `EduArchive-Frontend-React/src/pages/Login.jsx` | Security response/auth UI / local PDF worker / lint compatibility |
| `EduArchive-Frontend-React/src/pages/Register.jsx` | Hook import compatibility / focused lint correction |
| `EduArchive-Frontend-React/src/pages/admin/ActivityLogs.jsx` | Hook import compatibility / focused lint correction |
| `EduArchive-Frontend-React/src/pages/admin/AdminCapstoneAdditionalInfoPage.jsx` | Hook import compatibility / focused lint correction |
| `EduArchive-Frontend-React/src/pages/admin/AdminDashboard.jsx` | Hook import compatibility / focused lint correction |
| `EduArchive-Frontend-React/src/pages/admin/AdminProfile.jsx` | Hook import compatibility / focused lint correction |
| `EduArchive-Frontend-React/src/pages/admin/CapstoneApproval.jsx` | Hook import compatibility / focused lint correction |
| `EduArchive-Frontend-React/src/pages/admin/CapstoneLibrary.jsx` | Hook import compatibility / focused lint correction |
| `EduArchive-Frontend-React/src/pages/admin/CapstoneMainPage.jsx` | Security response/auth UI / local PDF worker / lint compatibility |
| `EduArchive-Frontend-React/src/pages/admin/PublishedCapstones.jsx` | Hook import compatibility / focused lint correction |
| `EduArchive-Frontend-React/src/pages/admin/UserManagement.jsx` | Hook import compatibility / focused lint correction |
| `EduArchive-Frontend-React/src/pages/faculty/CapstoneAdditionalInfoPage.jsx` | Hook import compatibility / focused lint correction |
| `EduArchive-Frontend-React/src/pages/faculty/FacultyCapstoneApproval.jsx` | Hook import compatibility / focused lint correction |
| `EduArchive-Frontend-React/src/pages/faculty/FacultyCapstoneLibrary.jsx` | Hook import compatibility / focused lint correction |
| `EduArchive-Frontend-React/src/pages/faculty/FacultyProfile.jsx` | Hook import compatibility / focused lint correction |
| `EduArchive-Frontend-React/src/pages/faculty/FacultyUploadedCapstones.jsx` | Hook import compatibility / focused lint correction |
| `EduArchive-Frontend-React/src/pages/student/StudentBrowseCapstones.jsx` | Hook import compatibility / focused lint correction |
| `EduArchive-Frontend-React/src/pages/student/StudentCapstoneAdditionalInfoPage.jsx` | Hook import compatibility / focused lint correction |
| `EduArchive-Frontend-React/src/pages/student/StudentCapstoneLibrary.jsx` | Hook import compatibility / focused lint correction |
| `EduArchive-Frontend-React/src/pages/student/StudentCapstoneMainPage.jsx` | Security response/auth UI / local PDF worker / lint compatibility |
| `EduArchive-Frontend-React/src/pages/student/StudentProfile.jsx` | Hook import compatibility / focused lint correction |
| `EduArchive-Frontend-React/src/pages/student/StudentUploadedCapstones.jsx` | Hook import compatibility / focused lint correction |
| `EduArchive-Frontend-React/src/pages/visitor/VisitorCapstoneMainPage.jsx` | Security response/auth UI / local PDF worker / lint compatibility |
| `EduArchive-Frontend-React/src/pages/visitor/VisitorProfile.jsx` | Hook import compatibility / focused lint correction |
| `EduArchive-Frontend-React/tests/baseUrl.test.js` | API URL / CSRF / build configuration |
| `EduArchive-Frontend-React/vite.config.js` | API URL / CSRF / build configuration |
| `deploy/acadex-ocr.service.example` | Release handoff / process template / integrity verification |
| `deploy/acadex-queue.service.example` | Release handoff / process template / integrity verification |
| `docs/ACADEX_ACCESS_POLICY.md` | Release handoff / process template / integrity verification |
| `docs/ACADEX_OCR_OPERATIONS.md` | Release handoff / process template / integrity verification |
| `scripts/verify-release-manifest.py` | Release handoff / process template / integrity verification |

## 3. Updated application architecture

```text
Browser → HTTPS static React/Vite SPA
        → credentialed HTTPS /api/v1 on a same-site sibling API hostname
Apache → Laravel public/index.php → encrypted session cookie + CSRF + active-account checks
                                → policies and scoped MySQL queries
                                → private encrypted local documents
                                → synchronous SMTP
                                → private loopback Uvicorn/FastAPI → serialized CPU PaddleOCR
Maintenance process manager → Laravel database queue → PDF text backfill
```

The app remains React + Laravel/MySQL + Python OCR. No Node server, PM2 application, WebSocket system, payment provider, mandatory external LLM, Docker architecture, Redis requirement or S3 transition was introduced. Node is build tooling only. Laravel's auxiliary Vite assets are separate from React. Upload metadata and normal PDF text extraction remain synchronous; the maintenance queue does not automatically make browser uploads asynchronous.

Verified locks now resolve React/DOM **19.3.0**, Vite **7.3.7**, React Router **7.18.4**, Axios **1.20.0**, react-pdf **10.5.0**, PDF.js **5.4.296**, Tailwind **4.3.3**; Laravel **12.69.3**, Sanctum **4.3.3**, Smalot PDF parser **2.13.1**. OCR direct pins include FastAPI **0.143.0**, Starlette **1.3.1**, multipart **0.0.32**, PyMuPDF **1.28.2**, Pillow **12.3.0**, with PaddleOCR **2.8.1**, PaddlePaddle **2.6.2**, NumPy **1.26.4**, Uvicorn **0.32.1** preserved. Backend auxiliary Vite remains **7.3.7** in its preserved lock. No major framework migration was applied.

Local runtime proof: PHP **8.3.16**, Composer **2.8.11**, Node **22.18.0**, npm **10.9.3**, Python OCR **3.11.17**, MySQL server **8.4.3**. These observed patch versions are not recommendations to install old patches on a public host. PHP manifest remains `^8.2`; Composer 2 API compatibility/platform requirements must pass on the actual host. Locked Vite needs Node `^20.19.0 || >=22.12.0`; use a supported patched build runtime. MySQL is required by the application's FULLTEXT/MySQL SQL. Python 3.11 is the validated OCR baseline; system Python 3.13 is not interchangeable.

Apache must serve only F `dist` and B `public`, with Laravel rewrites/Authorization preservation and scoped SPA fallback. Use HTTPS for both sibling origins, Cloudflare Full (strict), origin certificates/renewal, no cache for API/private documents and scoped forwarding trust. No final vhost/IP/domain/path/certificate configuration is invented. Existing shared-server runtime, ownership, vhosts, ports and resource compatibility still require inspection.

## 4. Required environment variables

Templates contain **names and placeholders only**, not a working production `.env`: B `.env.example`, `.env.production.example`, `.env.testing.example`, F `.env.example`, OCR `.env.example`. Replace placeholders privately. No application/private `.env` was copied into the release archive or report.

- Backend application: `APP_NAME`, `APP_ENV`, `APP_KEY`, `APP_PREVIOUS_KEYS`, `APP_DEBUG`, `APP_URL`, `FRONTEND_URL`, `TRUSTED_PROXIES`.
- Database: `DB_CONNECTION`, `DB_HOST`, `DB_PORT`, `DB_DATABASE`, `DB_USERNAME`, `DB_PASSWORD`; optional framework `DB_SOCKET`, charset/collation/SSL settings if required by the administrator. Do not let `DB_URL` override test connections.
- Authentication: `SESSION_DRIVER`, `SESSION_LIFETIME`, `SESSION_COOKIE`, `SESSION_DOMAIN`, `SESSION_SECURE_COOKIE`, `SESSION_SAME_SITE`. HttpOnly is enforced; production secure cookies are enforced. Leave domain empty for a host-only API cookie where feasible. Optional `SANCTUM_EXPIRATION` adds an age limit to explicit-expiry bearer tokens; it does not replace their mandatory expiry. No browser personal token is minted.
- Persistence/processing: `CACHE_STORE`, `CACHE_PREFIX`, `QUEUE_CONNECTION`, `DB_QUEUE_RETRY_AFTER` (greater than 600 seconds, default 660), `OCR_SERVICE_URL`, `PRIVATE_TEMP_PATH`, optional `PRIVATE_STORAGE_ROOT` (otherwise existing private storage root), `ALLOW_LEGACY_PLAINTEXT_DOCUMENTS` (disabled for normal production). Redis/Beanstalk retry variables matter only if those services are deliberately selected.
- Email/logs: `MAIL_MAILER`, `MAIL_HOST`, `MAIL_PORT`, `MAIL_SCHEME`, `MAIL_USERNAME`, `MAIL_PASSWORD`, `MAIL_FROM_ADDRESS`, `MAIL_FROM_NAME`, `LOG_CHANNEL`, `LOG_LEVEL`, `LOG_DAILY_DAYS` and provider-required optional framework settings.
- Frontend: **`VITE_API_BASE_URL`**, public build setting ending in `/api/v1`; HTTPS required for an absolute production URL. `/api/v1` is supported only with an explicitly configured same-origin web routing design. Missing/insecure/localhost production settings fail the build. Local development can omit it. No frontend secret is appropriate.
- OCR process environment: `OCR_MODEL_CACHE`, `TMPDIR`, `HOME`, `OMP_NUM_THREADS`, `MKL_NUM_THREADS`; optional `PYTHONDONTWRITEBYTECODE`. Python does not automatically load `.env`. Uvicorn host/port/workers are explicit launch arguments; GPU is not enabled by a template variable.
- Test isolation: private `.env.testing` includes the dedicated disposable DB, synthetic app key, isolated `APP_CONFIG_CACHE`, `APP_ROUTES_CACHE`, `APP_PACKAGES_CACHE`, `APP_SERVICES_CACHE`, `VIEW_COMPILED_PATH`, and no external mail. Examples give names only; see section 8 for setup rules.

`acadex:check-production` prints setting names/status only and does not query records. It checks production/debug/TLS/cookie/MySQL/queue/private-OCR/legacy-plaintext configuration, not mail delivery or operational readiness. CORS allows the exact configured frontend origin with credentials; arbitrary origins do not gain browser access. `TRUSTED_PROXIES` accepts explicit IPs/CIDRs, rejecting wildcard/automatic/calling-IP trust and unrestricted networks; only forwarded protocol/port/client IP from those addresses is trusted. SameSite Lax is suitable for approved sibling HTTPS origins but must be browser-tested; unrelated sites need a separate auth design. [Laravel proxy configuration](https://laravel.com/docs/12.x/requests#configuring-trusted-proxies).

## 5. Production build commands

**Reference commands for a later approved release; no AWS commands were executed.** Run from the indicated component directory. Set the frontend variable privately to the approved public API address before building; the validation `.invalid` address is not a deployment address.

**Windows PowerShell, F:**

```powershell
# $ApprovedApiBaseUrl is supplied by the administrator, including /api/v1.
$env:VITE_API_BASE_URL = $ApprovedApiBaseUrl
npm.cmd ci
npm.cmd run lint
node --test tests/baseUrl.test.js
npm.cmd run build
Remove-Item Env:VITE_API_BASE_URL
```

**Ubuntu build host/SSH session, F:**

```bash
# APPROVED_API_BASE_URL must be set to the approved public API address.
npm ci
VITE_API_BASE_URL="$APPROVED_API_BASE_URL" npm run build
```

Publish the whole fresh `dist` as one artifact. The worker is now a local hashed `.mjs` asset; it no longer requires unpkg. Google Fonts remain an external, free browser dependency. Large main/worker chunks are a performance warning, not a failed build; no unrelated code-splitting redesign was made.

**Windows PowerShell, B auxiliary assets:** `npm.cmd ci`, then `npm.cmd run build`. **Ubuntu build host/SSH session, B:**

```bash
composer install --no-dev --prefer-dist --no-interaction --optimize-autoloader
composer check-platform-reqs --no-dev
npm ci
npm run build
php artisan acadex:check-production
php artisan config:cache
php artisan route:cache
php artisan view:cache
```

Configure private environment, persistent storage and scoped writable paths first. Backend assets output to `public/build`; these are not the React build. Config caching is now compatible with the OCR URL. Real installation hooks/autodiscovery and PHP-FPM permissions must pass on the target. No `composer update` or forced audit-fix command belongs in deployment. Recreate PHP/Python native dependencies for Linux; do not copy Windows `vendor`/`.venv`/`node_modules` as the installation strategy.

## 6. Database migration and administrator initialization

### Actually executed here

With the user's explicit approval, a new isolated local database **`acadex_remediation_test_5954d321a1`** was created on the verified MySQL **8.4.3** server. A random dedicated account was granted privileges on **that schema only**, and its private credentials/test key are in ignored, ACL-restricted B `.env.testing`. The runner checks the local host, database prefix/suffix, mismatch with the archive name, physical `SELECT DATABASE()`, scoped `SHOW GRANTS`, and Laravel configuration. It removes inherited `DB_URL` overrides and rejects an existing test config cache. It never falls back to archive configuration or clears the real application cache.

**All 29 migrations ran successfully on this fresh disposable schema:** the original 27, including the owner's existing September fixes, plus:

1. `2026_10_13_000001_secure_authentication_state.php`: adds user revocation version and widens code storage for hashes.
2. `2026_10_13_000002_create_document_uploads_table.php`: owner/purpose/private-path/expiry/claim metadata and FKs for staged uploads.

Tests use random synthetic accounts/documents and rollback fixture transactions; HTTP probes deliberately retain synthetic fixtures/session rows and write only isolated `.local` encrypted test files. The database is **retained**. No archive DB reads, import, reset, truncation, production migration or destructive seeder occurred. Do not delete the test database without the user's explicit approval.

### Later initialization or upgrade — Ubuntu SSH session, B

First choose fresh-vs-restore, scoped DB/account, backup and target configuration. Commands below are conditional future mutations, not inspection steps:

```bash
php artisan migrate:status
php artisan migrate --force
# This seeder is now roles-only and is tested not to create accounts:
php artisan db:seed --class=DatabaseSeeder --force
# First admin only; hidden interactive password and verified operator identity:
php artisan acadex:bootstrap-admin
```

Generate an app key **only for a genuinely new empty archive**. For existing data, preserve the original key with the corresponding encrypted files and DB backup. No tracked dump is required for a fresh schema; real archive migration requires the matched DB/files/key. Do not copy demo records or credentials. Bootstrap refuses to overwrite an existing administrator; account recovery/rotation must use a separately authorized secure procedure.

Use a separately scoped migration account where needed; runtime database credentials should have only the required application privileges, never global grants. Source/config are read-only to serving identities; only application storage/cache/private temp/model paths are writable. Never make the whole repository writable or use recursive 777.

Both new security migration `down()` methods deliberately throw instead of silently deleting security/ownership state. **Generic `migrate:rollback` is not supported for these changes.** Review schema/forward-fix or coordinated backup restore with the owner. Existing older migrations still deduplicate view rows/rebuild MySQL indexes/drop the old publication column; fresh-schema success does not prove safe conversion of an existing partially migrated archive. Rehearse that path on an owner-approved copy in a separate authorized task. Do not use `migrate:fresh`, `migrate:refresh`, blanket demo seeding or ClearCapstonesSeeder.

API title/author limits now match their existing 255-character DB columns, avoiding validated-but-uninsertable metadata. Owners must review any requirement for longer fields before authorizing a schema change. Existing unverified accounts must complete verification; previous unbounded bearer tokens stop working. Open pre-release upload forms holding raw paths cannot be submitted after cutover and must re-upload. These are deliberate security transition effects.

## 7. OCR deployment requirements

See `docs/ACADEX_OCR_OPERATIONS.md`, `deploy/acadex-ocr.service.example`, `deploy/acadex-queue.service.example` and the two platform locks. Templates contain administrator-replaced identities/paths, **not configured services**.

Production OCR must bind to loopback, use one worker/no reload, persistent service-owned model cache/home and private temporary storage. CPU inference is serialized in a thread pool, keeping the async event loop available for health. Files are read with a 20 MiB bound; the existing 50-page limit and a new 20-million-rendered-pixel limit reject oversized renders. PDF handles close on error before plaintext temp cleanup. Native multiprocessing/model memory means instance sizing must be measured; the earlier combined-server 2 vCPU/8 GiB pilot estimate remains an estimate, not a guaranteed minimum or purchase approval. Large files/concurrent requests, OOM/swap behavior and timeouts have not been benchmarked.

Paddle publisher metadata provides Python 3.11 Linux wheels, and the Linux graph resolves with hashes. This is artifact/solver evidence, **not Ubuntu import/inference proof**. [PaddlePaddle publisher metadata](https://pypi.org/pypi/paddlepaddle/2.6.2/json), [PaddleOCR installation documentation](https://www.paddleocr.ai/v2.10.0/en/ppocr/installation.html).

Verify Python/wheels/CPU architecture plus OpenMP/OpenCV libraries on the actual Ubuntu release. Ghostscript and Tesseract English are required for PHP native fallback; optional Poppler supports FastOcrService. PaddleOCR's upstream dependency graph includes overlapping OpenCV distributions; the tested Windows runtime imports cv2 successfully, but Linux shared libraries and actual imported build need checking. Do not install arbitrary system packages or globally switch Python/PHP on a shared server.

The OCR endpoint accepts 20 MiB while Laravel accepts 50 MiB. Larger or long documents can require manual/skip metadata or existing native fallback. Laravel's OCR timeout remains 120 seconds and synchronous extraction can exceed Cloudflare's request budget; server timeouts alone do not solve this. Queue retry-after defaults to 660 for a 600-second job; workers need Linux pcntl, process supervision and sufficient stop timeout. No application scheduler was added. Upload quotas and abandoned-upload retention/cleanup are not implemented and need operational decisions before public use.

## 8. Actual testing results

### Executed verification

| Check / command / environment | Status | Actual evidence and limit |
| --- | --- | --- |
| Disposable migrations: `php scripts/run-security-tests.php --migrate` — Windows PowerShell, B | PASSED | All 29 on new MySQL 8.4.3 schema; never an archive migration |
| `php scripts/run-security-tests.php tests/Feature tests/Unit` — PowerShell, B | PASSED | **26 tests, 388 assertions**, PHPUnit 11.5.57; role matrices, guessed IDs, parent resources, metadata/search/chatbot, CSRF, verification, revocation race/lifecycle, upload/IMRAD, admin bootstrap/roles, production checks, trusted proxies; includes two original example tests |
| `php scripts/run-security-tests.php --http-check` — PowerShell, B | PASSED | Real local PHP HTTP listener, exact credentialed CORS, CSRF initialization/missing-token rejection, cookie login/persistence, private PDF/metadata 404, byte-matched encrypted retrieval, logout/401; scoped DB and local synthetic storage only |
| `php scripts/run-security-tests.php --inspect` — PowerShell, B | PASSED | **119 registered routes**, isolated config/OCR and route caches, all migration statuses ran; owned temporary caches removed without touching real config/cache |
| `php -l` over first-party PHP, including scripts/tests/views | PASSED | 121 files checked at the full syntax pass; subsequent changed controller/runner files additionally exercised by successful tests/probes; final syntax recheck also passes |
| Composer strict validation/platform/audit — PowerShell, B | PASSED | `validate --strict --no-check-publish`, `check-platform-reqs --no-dev`, `audit --locked --no-dev --format=json`: valid lock/platform, no current runtime advisories |
| Separate clean production install — PowerShell, ignored `.local/remediation-prod-dependencies` | PASSED | `composer install --no-dev --no-scripts --no-autoloader --prefer-dist --no-interaction`; 79 runtime packages, platform requirements pass. Isolates local dev vendor; hooks/autoloader/Ubuntu FPM acceptance remains separate |
| Frontend `npm.cmd run build` — PowerShell, F | PASSED | Actual `dist` emission, 794 modules, locally bundled PDF worker; synthetic HTTPS API setting; large-chunk warning |
| Clean frontend `npm.cmd ci --ignore-scripts` and build in isolated copy | PASSED | Fresh lock install, successful build, **all generated files byte-for-byte identical** to workspace build after explicit Tailwind source scan |
| Frontend `npm.cmd run lint` — PowerShell, F | PASSED with warnings | **0 errors, 30 hook dependency warnings**; rules retained, Node config globals/JSX argument treatment corrected; new compiler lint expansion avoided with prior exact hooks plugin |
| `node --test tests/baseUrl.test.js` — PowerShell, F | PASSED | 2 tests: dev/HTTPS/same-origin configuration and rejection of missing/insecure/local/credential-bearing production settings |
| Production build without required API setting | FAILED as expected | Build intentionally refused; verifies the configuration guard, not an unresolved build defect |
| Backend `npm.cmd run build` — PowerShell, B | PASSED | 58 modules, `public/build/manifest.json` and assets emitted |
| Frontend/backend `npm.cmd audit --json --ignore-scripts` | PASSED | Both zero reported vulnerabilities after remediation at query time |
| Python `ast.parse` and upgraded environment consistency | PASSED | First four source/test files parsed; final parsing includes the probe and manifest verifier; `uv pip check` confirms all 68 installed Windows packages compatible |
| Native imports/model warm-up — upgraded isolated Windows Python 3.11 environment | PASSED | Paddle 2.6.2, cv2 4.10.0, PyMuPDF 1.28.2 import; model initialization 1.97 seconds on this machine/cache, not a production benchmark |
| `python -m unittest discover -s B/ocr-service/tests -v` in isolated OCR environment | PASSED | **4 tests**, 5.213 seconds reported: embedded PDF, actual image/scanned recognition, invalid/mismatched/empty/oversize inputs, page/render limits and plaintext-temp cleanup |
| `python B/ocr-service/tests/probe_laravel_ocr.py` in isolated OCR environment | PASSED | Actual private Uvicorn startup/health on owned port, Laravel multipart connector recognizes synthetic scanned PDF, public metadata extraction succeeds; only owned test server stopped |
| Python hashed lock compilation | PASSED | Separate Windows/Python 3.11 and Linux x86_64/Python 3.11 graphs; no Ubuntu installation |
| `pip-audit --disable-pip --no-deps -r <platform-lock> --format json` | FAILED, residual advisories | Linux: **6 entries/3 packages**; Windows: **10 entries/4 packages**; classified in section 9, duplicate registry IDs counted separately |

Package upgrades ran only on the local workspace/isolated test environments, using existing compatible manifest ranges, normal npm updates and Composer's solver with scripts disabled. No forced audit fix or framework major upgrade was used. Initial npm update emitted Windows EPERM cleanup warnings for loaded native binaries; the subsequent clean install/build passed. Existing local services were not stopped to clear those locks.

**Retained failure history:** initial disposable migration startup failed because Windows absolute cache paths were incorrectly resolved by Laravel; test cache locations were corrected to the isolated relative directory and all migrations passed. Initial fixture failures involved a forwarded `tap` call, stale mocked Sanctum guards and expecting 200 instead of the existing create API's 201; those test helpers/assertions were corrected without weakening authorization expectations. The session-race fix first used a cast-incompatible SQL expression; tests caught it, and a locked persisted integer increment passes. The first live HTTP probe called the wrong encryption method signature; it was corrected to raw encryption and rerun successfully. Guarded scripts now return nonzero on exceptions. Shell read/path/encoding and unsupported `uv pip index` wrapper attempts were corrected; they were not repaired application defects. Python TestClient/deprecated HTTP-422 naming warnings remain nonfatal. No failed result is represented as hosted proof.

### Independent reproduction before deployment

Do not copy this workspace's private test configuration or credentials. On the administrator's laptop, first get approval for a **new local disposable database**, manually create its scoped account, and privately configure `.env.testing` from the names-only template. Use a name `acadex_remediation_test_` plus ten lowercase hex characters. Grant only that schema; the runner rejects globally privileged accounts. Set isolated cache/view paths under repository `.local/remediation-test`; create that directory first. On Windows, Laravel cache override paths should be relative to B, e.g. `../.local/remediation-test/config.php`; `VIEW_COMPILED_PATH` can use a privately resolved absolute directory. These are test paths, not production paths. Restrict the configuration's ACL. Never point it at the archive schema or use `DB_URL`.

**PowerShell, B after approved private setup:**

```powershell
php scripts/run-security-tests.php --migrate
php scripts/run-security-tests.php tests/Feature tests/Unit
php scripts/run-security-tests.php --inspect
php scripts/run-security-tests.php --http-check
```

HTTP probe ports 18880/18882 must be free; probes refuse occupied listeners and stop only processes they create. The HTTP probe retains synthetic rows/files for regression and does not delete the database. Standard `composer test` clears config and the skeleton PHPUnit config otherwise selects SQLite; use the guarded runner for this MySQL acceptance suite.

**PowerShell, prepared Python 3.11 environment:** install `requirements-windows.lock` with `--require-hashes` into an isolated venv, check consistency, then run `-m unittest discover -s <OCR-tests-directory> -v` and `tests/probe_laravel_ocr.py`. The live connector probe expects PHP CLI on PATH and the privately prepared guarded DB configuration. Linux uses `requirements-linux.lock`; run the same synthetic tests with suitable fonts/model cache. Do not transfer Windows native dependencies.

### Checks still unverified

| Check | Status | Reason / required acceptance |
| --- | --- | --- |
| Ubuntu/PHP-FPM/MySQL/native OCR execution and Linux 5.29.6 protobuf compatibility | NEEDS VERIFICATION | No target Linux host; WSL inventory failed because WSL is not installed. No system/WSL/AWS installation was attempted |
| Actual browser role/upload/edit/PDF flows and sibling HTTPS session/CSRF behavior | NEEDS VERIFICATION | Backend HTTP/security/build tests do not prove browser SameSite, visual behavior or real TLS domains; no rendered browser acceptance was performed |
| SMTP sender DNS/delivery and external user email workflows | NEEDS VERIFICATION | No real mail sent/provider accessed; synthetic tests use array mail |
| Existing-data upgrade and matched DB/files/key restore | NOT RUN | User prohibited real archive operations; requires separately approved copy/restore rehearsal |
| Long/scanned/50 MiB concurrency, edge/proxy budgets, memory/swap and disk failure handling | NEEDS VERIFICATION | Small synthetic tests only; no representative Linux load/capacity exercise |
| Linux file modes/ownership, private model cache restart and graceful systemd drain | NEEDS VERIFICATION | Templates prepared; Windows forced termination of owned probes is not systemd shutdown proof |
| Apache/Cloudflare/certificate/firewall/shared-host compatibility | NOT RUN | No remote AWS/infrastructure access authorized/performed |
| Credential rotation and initial real admin provisioning | NOT RUN | No provider/account mutation; synthetic bootstrap tested, operator must perform privately later |
| Reviewer exception workflow, quota/abandoned-file cleanup/retention | NEEDS VERIFICATION | University/operations decisions required; no broad privilege or destructive cleanup invented |

## 9. Remaining risks or blockers

### Dependency disposition

| Dependency group | Baseline finding and current result | Reachability / disposition |
| --- | --- | --- |
| Frontend legacy viewer/root PDF.js/tar | Original 40 affected packages, critical/high entries; unused viewer chain removed; current npm audit zero | Old root PDF.js was not established as bundled by the actual react-pdf pages. Current renderer/worker versions agree. Remaining build/dev exposure still requires current audits before release |
| Frontend Axios/Router/Vite and other allowed dependencies | Compatible patched lock updates; audit zero | Browser API/navigation or build tooling, depending on package. No SSR server introduced |
| Composer Guzzle/Laravel/Flysystem/CommonMark/Symfony runtime | Original 40 entries/11 packages; updated lock/runtime audit zero | HTTP/mail/framework/storage were relevant runtime dependencies; regressions pass, target PHP platform still required |
| Multipart/Starlette/Pillow | Original Python audit 71 entries/7 packages; upgraded direct pins and transitive graph remove these reported advisories | Parser/image handling is directly relevant to uploaded bytes. Synthetic endpoint/inference tests pass in upgraded Windows venv |
| PaddlePaddle 2.6.2 | 2 entries: `PYSEC-2026-1754`, `PYSEC-2026-1756`; reported fix requires Paddle 3 | Command injection in graph drawing/model-download helper. First-party API does not accept model URLs or call graph drawing; controlled model acquisition/private bind reduce exposure. This is a source reachability inference, not proof of non-exploitability. No blind major replacement; owner must accept/disposition or authorize a validated migration before public release. [Advisory record](https://github.com/pypa/advisory-database/blob/main/vulns/paddlepaddle/PYSEC-2026-1756.yaml) |
| imgaug 0.4.0 | 2 duplicate-ID entries, `PYSEC-2026-356`, no fixed version reported | Unsafe BackgroundAugmenter multiprocessing deserialization; current app performs inference and does not call that training/augmentation workflow. Transitive presence remains; document the decision, do not declare the package safe. [Advisory record](https://github.com/pypa/advisory-database/blob/main/vulns/imgaug/PYSEC-2026-356.yaml) |
| setuptools 80.10.2 | 2 duplicate-ID entries, `PYSEC-2026-3447`; fixed 83 removes an API Paddle imports | Source-distribution filename exclusion issue on normalization-preserving macOS filesystems; current Ubuntu/Windows serving is a different exposure. Exact older compatibility pin retained, no suppression; review build/supply-chain policy and future Paddle upgrade |
| Protobuf | Windows 3.20.2: 4 entries/two IDs (`PYSEC-2026-1805`, `PYSEC-2026-1806`); Linux pin 5.29.6 removes the audit entries | Windows Paddle constraint prevents compatible upgrade in that graph. Current API does not expose JSON-to-Any parsing; Linux version is solver-supported but actual Paddle import/inference must pass on Ubuntu. Do not conflate the two platforms |

Audit entry counts are not unique exploitable bugs; the Linux residual set has four distinct advisory IDs across three packages, Windows six across four. Severity feeds did not supply a uniform CVSS classification in these Python results, so numeric severities are not invented. Command execution/deserialization can be serious **if the affected path becomes reachable**. HTTP/image parser issues had direct upload exposure and were prioritized. Build-only, training-only and Windows-only exposure are distinguished but not silently waived. Dependency consistency, hashes and successful OCR do not establish vulnerability absence.

Remaining launch gates: university confirmation of the access contract; explicit OCR advisory disposition; approved target runtimes/host isolation; real HTTPS browser/security workflows; Linux inference/native fallback and operating limits; secure administrator/provider settings; matched encrypted-file restore; upload retention/quota decisions; and an approved immutable release. Lint hook warnings and large bundle sizes remain quality risks needing browser regression/performance review. Existing archive/provider credentials must be rotated if previously exposed; rotating `APP_KEY` blindly would break files and is not a credential cleanup shortcut.

## 10. Exact Git/release identification

Base branch **`main`**, base commit **`4560e3f32e6cd8b6f63e0c2a4373b8b94f241546`**. **Remediation is uncommitted. This commit alone does not contain the candidate.** No tag/new commit is fabricated.

Candidate ID: **`acadex-remediation-d61a0aa271f7a1e4`**. Aggregate source SHA-256: **`d61a0aa271f7a1e4390b991959d2b9eddb2c55f598babbb77aab10fbd55324b6`**.

`ACADEX_RELEASE_MANIFEST.json` records the selected first-party source paths/hashes and a content-derived candidate ID. `.local/acadex-remediation-source.zip` is an independently reviewable snapshot of those files plus this report/manifest. It excludes secrets, private storage/data, Git history, credential-bearing setup notes, local helpers/tools, dependencies, model weights and validation builds. It is a **source candidate**, not an AWS deployment artifact. Verify it with `scripts/verify-release-manifest.py` before installing/testing; that script checks SHA-256 and the aggregate source ID. Documentation is excluded from the aggregate ID to avoid a circular report hash, but its file hash is included in the manifest.

An owner-approved future commit/tag must deliberately include the migration fixes/backend npm lock and reviewed remediation. Do not broadly stage the dirty tree or publish `SETUP.md`/private environments. Rebuild with approved domains and run acceptance from that exact immutable revision. A source zip/hash is provenance, not merge, publication or deployment approval.

## 11. Final verdict

**NOT READY FOR PUBLIC PRODUCTION DEPLOYMENT.** Confirmed document/account/CSRF/upload/default-admin blockers are corrected and locally validated. No critical finding from the focused access-control review remains knowingly unfixed in the candidate. Linux and hosted acceptance plus residual-advisory decisions remain unresolved; the release cannot honestly be called production-ready.

**Safe next step:** independent code review and isolated synthetic staging testing using this source manifest and guarded database runner. An Ubuntu staging environment may be prepared only in a separately authorized task, with private services/test data and the documented advisory/host decisions. Do not load private archive records, publish DNS, deploy to AWS or replace an existing shared server based solely on these local passes.

Before public launch, assign owners and prove: the confirmed university policy; every real-browser role/auth/upload/edit/preview/download rejection; exact HTTPS/CORS/cookie behavior; Ubuntu/PHP/MySQL/OCR/native tools; sender delivery; largest allowed workload and edge timeout; narrow service/storage/temp permissions; nonpublic DB/OCR ports; cache/TLS renewal rules; safe admin; matched backup restore; risk disposition and immutable release/rollback runbook. Preserve DB/files/encryption keys together, retain prior code/build artifacts, and rehearse a forward-fix or coordinated restore instead of blind migration rollback. The retained disposable database must not be deleted without explicit user approval.
