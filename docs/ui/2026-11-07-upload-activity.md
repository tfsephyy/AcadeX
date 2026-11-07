# Upload cancellation and floating progress — local verification

Verified November 7, 2026 (Asia/Manila). This is local frontend verification,
not a production deployment or server upload/extraction acceptance certificate.

The Upload Capstone PDF picker and activity are shared across admin, faculty
and student. Cancel upload aborts the current browser request. Close, the X
button, Escape and the backdrop minimize the activity to a floating icon.
Measured transfer percentage and elapsed time survive modal closure and
internal page navigation. Server processing uses an indeterminate display and
the existing protected upload-status endpoint. Completion leaves the current
page open; Review details uses the saved upload reference and extracted data.

One activity is retained in memory per signed-in app instance. A second picker
opens that activity instead of submitting twice. Cancellation and account-change
generation guards prevent stale events from replacing newer activity. Logout
clears owned file references, requests, filenames and timers. The upload itself
does not survive refreshing/closing the browser tab. Cancelling after all bytes
have left the browser cannot guarantee stopping server storage or processing;
the activity explains that boundary.

Verification:

- 23 Node frontend tests passed, including eight upload-lifecycle cases covering
  cancellation/retry races, subscriber removal, minimize, duplicate starts,
  background polling, review-page polling handoff, transient failures, expired
  uploads and logout/account changes.
- Quiet ESLint, Git whitespace checks and the production build passed (833 modules).
- Headless installed Chrome, with synthetic API interception, passed all three
  roles: actual XHR cancellation, retry without duplicate requests, close/reopen,
  route changes during the request, background completion without redirect,
  extracted-data review handoff, keyboard Tab containment and Escape.
- Light desktop (1280×900), dark mobile (390×844), floating placement and the
  mobile reopened dialog were inspected. Screenshots and the local browser
  harness are ignored under `.local/upload-ui-check`.

The browser harness intercepts authentication, transfer and status responses;
it creates no application users, staged documents, records or queued jobs.
Backend behavior, database schema, credentials, persistent documents and
production remain unchanged. Existing local setup changes were preserved.
Real large-file transfer timing, server cancellation cleanup and deployed
acceptance were not exercised by this frontend change.
