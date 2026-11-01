# AcadeX role and mobile continuation — November 1, 2026

## Scope and current state

This continues [the earlier local UI review](2026-11-01-review.md). The user approved the landing charcoal dark theme for the entire application, requested continued review of all roles/mobile, and reported a local MySQL 1049 session error. **No deployment, push, AWS, DNS, paid service or production mutation was performed.** Work remains uncommitted on `codex/ui-refinement`; the book hero, green identity, light palette, existing functionality and server authorization rules are retained. No dependency was added.

## Changes made during the continuation

- Canonical dark tokens now use the approved charcoal surfaces throughout the public and authenticated application. Navigation, inputs, dropdowns, profile/document banners and assistant surfaces reuse those tokens. Green remains for identity, actions, links and selected navigation; the book keeps its forest cover.
- At 320px, submission headers use compact three-column steps; the footer keeps both actions usable without the former tall wrapped layout. The keyword input no longer widens the metadata page. Reviewed metadata and author details survive Back from Additional Info.
- Admin notifications fit within the phone viewport and use contained dialog focus. Account, notification and filter controls have meaningful accessible names. The user-management header no longer exceeds its content scroller; its complete table remains in a named, keyboard-scrollable region.
- Profile actions wrap on narrow screens. Long research titles and status labels stack rather than squeezing the title into a narrow column.
- The visitor saved folder now reads the actual Laravel paginator rather than calling `map` on the paginator object. It retains pagination, exposes failure/retry feedback and supports direct saved-route entry. Visitor collection/saved cards support keyboard opening; the saved dialog contains focus and supports Escape. These use existing endpoints and server permissions.

## Local database repair and preservation

The ignored local backend `.env` selected `EduArchiveDB`, which was absent. Read-only inspection found the original `acadex_local` with 24 tables, one existing user, no capstones and 27 recorded migrations. Before changing anything, the full local environment and original schema/data were backed up privately in `.local/ui-local-backup-20261101-094847/`.

Only the local database-name setting was corrected to `acadex_local`. Four existing pending repository migrations were applied: secure authentication state, document uploads, capstone approval backfill, and publication default. The original user's stored column values and application key were checked and retained; no password reset, key generation, reseeding, fresh migration or replacement database was used. The local API then returned HTTP 200 for the CSRF/session endpoint, which previously failed at the session query. The existing owner's password is unknown and was not changed, so no claim is made that their original password was used for a browser login.

The normal preview at `http://localhost:5173/` uses the regular local API at `http://localhost:8000/api/v1`. The isolated review services described below are temporary and separate from this preview.

## Test environment

Browser role checks used the **actual Laravel HTTP API**, not intercepted responses, at a separate loopback port. Its bootstrap loaded the existing testing configuration, enforced the approved disposable schema `acadex_remediation_test_5954d321a1`, checked loopback host and schema-restricted grants, and used a distinct session cookie, private test storage and array mail. Test credentials remain private. No database test targeted the normal local schema or production.

Four synthetic approved/verified users represented administrator, faculty, student and visitor. Synthetic PDF records included a long approved/published title, a student submission assigned to the review faculty, an approved unpublished faculty document and a rejected student submission. Three further synthetic records were created through the browser upload flows. Real documents and user accounts were not used.

## Browser verification

All four roles signed in through the real local login form. The route/width matrix comprised **84 layout cases: 21 role routes at 320, 390, 768 and 1440 CSS pixels**. Each measurement waited for the expected visible heading and the relevant loading indicator to clear. Document width stayed within the viewport. The initial 4px user-management content overflow and profile rounding overflow were corrected; final 320px rechecks measured the main region at 310px client/scroll width. The user table stayed within its 274px region while retaining 640px of scrollable columns; ArrowRight changed its scroll position.

| Role | Routes in the four-width matrix |
| --- | --- |
| Administrator | Dashboard, users, capstone library, uploaded capstones, pending approvals, logs, profile, research detail |
| Faculty | Uploaded capstones, capstone library, pending approvals, profile, research detail |
| Student | Uploaded capstones, own capstone library, profile, research detail |
| Visitor | Collection, saved-route entry, profile, research detail |

Additional browser interactions performed:

- **Student, faculty and administrator:** at 320px, choose the synthetic text PDF through the browser file chooser, upload/extract, inspect the populated title/author/year/program/abstract/keywords, review metadata, complete the applicable Additional Info fields and save successfully through the actual API. The student flow included adviser selection. Category selection retained keyboard ArrowDown/Enter behavior.
- Metadata title correction → Next → Back retained the correction. The review and Additional Info document widths measured 320px; the footer was approximately 77px high rather than the earlier 126px wrapped layout.
- Faculty approved the assigned synthetic pending submission through the approval screen; it left the queue and appeared Approved in the student's library.
- Student edit dialog and faculty password dialog opened within the narrow viewport and closed with Escape. No password was changed. Drawer, dialog, account menu and notification interactions were inspected; notifications fit between 16px phone gutters.
- Visitor saved a synthetic approved record, opened its saved folder, saw the record and pagination, and closed with Escape. After the final keyboard change, Enter on the collection card opened the matching research detail. The saved-folder test had one saved record; multi-page saved collections were not populated for browser acceptance.
- Student navigation to the administrator user route redirected to the student collection. The settled student document toolbar omitted Download. These browser observations supplement, rather than replace, backend authorization tests.
- Student card/table and filter controls operated. AcaBot's narrow panel fit and the existing canned IMRAD question returned a local response.
- Light/dark switching was inspected; the final dark dashboard and phone profile were visually reviewed. The book's explicit forest color is retained in source.

Private machine-readable measurements are in `.local/ui-review/browser-layout-results.json`. Screenshots with synthetic content are under `.local/ui-review/screenshots/`; use the `.jpg` mobile profile capture, which uses full-page browser capture to avoid the extension's scaled viewport screenshot. Those files are excluded from Git.

## Automated checks and boundaries

| Check | Current result |
| --- | --- |
| Frontend unit suite | **12 passed**, including exact 128 MiB/one-byte-over selection boundaries and paginator normalization |
| Frontend ESLint | **Passed with no errors** using `npm run lint -- --quiet` |
| Frontend production build | **Passed**, process-local `VITE_API_BASE_URL=/api/v1`; local compilation only |
| Laravel guarded disposable runner | **75 tests / 705 assertions passed** at the start of this continuation; backend source was unchanged afterward |
| Git whitespace check | Passed |
| Design static audit | Six recorded findings: three inactive actions in unrouted legacy student components, one retained native verification-form convention, and two deliberate vertically resizable textarea conventions. This is not a clean strict-audit or accessibility certification |

The 128 MiB client boundary is unit-tested; this continuation's browser submissions used small synthetic text PDFs. It does not claim a fresh 128 MiB browser stress test or Windows image-only OCR acceptance. Physical phones, Safari, full screen-reader/WCAG acceptance, real email delivery, every destructive/account action, and every pagination/data-density combination were not exhaustively certified. No real messages, external uploads, deletions or password changes were used for this review.

`DESIGN.md`, `UX-CONTRACT.md` and the November 1 note in `SETUP.md` record the current direction and local repair. The original first-pass report remains historical. Production architecture and its existing persistent resources are untouched; this report is not a new live-server health or deployment acceptance report.
