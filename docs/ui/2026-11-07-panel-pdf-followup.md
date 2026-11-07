# Panel and PDF follow-up — November 7, 2026

Implemented locally; **not deployed**. Existing uncommitted upload activity,
duplicate-title guard and adviser-removal work was preserved.

| Request | Result |
| --- | --- |
| Unique URLs | Remaining visitor cards, library modals, approval links and student browse links prefer existing unique slugs. Chatbot suggestions and inline links receive access-scoped slugs. Existing numeric links remain accepted. Slug detail routes receive the correct browser title. |
| Faculty dashboard and notifications | Repository statistics use the same surface/text tokens as other dashboard sections. Admin and Faculty share `WorkspaceLayout` and `NotificationItems`: account-adjacent bell, unread badge, expandable notifications, mark-read/all-read, related-capstone link, refresh and retry. The direct Faculty notifications page retains pagination. Read/unread surfaces, text weights, dots and borders are distinct in both themes. |
| PDF reading progress | Original and IMRAD positions are separate, keyed by canonical capstone ID and account ID, with a browser-local visitor fallback. Scroll writes are debounced and flushed on hide/navigation. Reopening restores the page after placeholders mount. Numeric and slug URLs share progress. Blocked storage is tolerated; outdated pages clamp to the document length. |
| Navigation labels | Own-upload pages display My Uploads; repository browse pages display Capstone Library in the four applicable panels. Paths, page actions, archived headings and role permissions are retained. |
| User Management | Header uses the surrounding panel surface. Category controls wrap with aligned 16px icons, consistent spacing and no nested navigation scrollbar. |
| Individual analytics | Unique Viewers, Engagement and Peak Day cards and their supporting text are removed. Views, Downloads and Bookmarks fill a responsive three-column grid. Backend metrics are retained. |
| Fullscreen zoom | All four role viewers support 25–300% with Zoom Out, Zoom In and reset. At 25%, Zoom Out disables; fullscreen remains open. |
| Copyright wording | Upload/edit choices, detail badges and chatbot text display Not Yet Copyrighted. The stored `unprotected` value and visibility rules are unchanged. |

Reading progress uses the active viewer only. Fullscreen cleanup retains the
last scroll event captured before DOM removal. Each canonical document/type
has its own reader instance, avoiding state reuse and progress corruption when
switching between original and IMRAD PDFs. Detached-document events are ignored;
the placeholder observer disconnects after the initial restore. No file contents, credentials or
titles are persisted in reading-position entries.

## Local verification

- All **26 frontend tests** passed, including account/document/type isolation,
  visitor fallback, malformed or inaccessible storage, stale page clamping and
  viewport-page selection.
- Production build passed with `VITE_API_BASE_URL=/api/v1` (**838 modules**).
- Two database-free PHP slug tests passed (**3 assertions**). Syntax checks
  passed for the two modified chatbot PHP files.
- Headless Chrome with intercepted synthetic API responses and an eight-page
  synthetic PDF passed for **Admin, Faculty, Student and Visitor**: scroll-save,
  reload, numeric URL compatibility, account/document isolation, independent
  IMRAD positions, inline/fullscreen handoff and zoom down to 25%.
- Six additional reload/original/IMRAD/fullscreen transition cycles passed each
  in Admin and Visitor after the detached-observer correction. The probe waits
  for reader readiness, including asynchronous PDF loading between switches.
- Browser checks also covered notification read/unread display and marking,
  related slug links and Escape dismissal, removed analytics, copyright wording,
  browse headings/navigation, desktop/light and mobile/dark layouts. No script
  errors occurred in the four-role run.
- User Management was checked at **1440, 768 and 390px**, with no horizontal
  document overflow or nested vertical navigation scroll. Faculty repository
  statistics and Admin/Faculty notifications were visually inspected in both
  themes. The mobile library checks used **390 × 844px**.
- `git diff --check` passed. Synthetic probes/screenshots are retained under
  ignored `.local/ui-followup-evidence`; they contain no real documents/accounts.

Browser API interception did not contact Laravel, upload real files, send mail,
or use an application database. These checks do not establish deployed behavior,
live backend/database integration, or resolution of the separately recorded
large-scanned-document latency issue. No migration, production operation,
configuration/key change or Git publication was performed.
