# November 8, 2026 — Dashboards, registration and adviser matching

Scope: implement the six requested changes in local source. No deployment,
existing-application migration, account reset, document conversion, commit or
push was requested or performed. Initial Git worktree was clean.

## Implemented behavior

1. Admin upload-year chart counts `capstones.created_at` by calendar year,
   rather than academic `capstones.year`. It returns six consecutive years
   through the current application year, oldest first, including zeroes.
   Uploaded counts include pending/rejected/archived records, consistent with
   the Uploaded summary; older records remain in the all-time summary but are
   outside the labelled six-year graph. The approved-year endpoint applies
   `approval_status=approved` and `is_archived=false`. Counts are integers.
   Axis labels, numeric bar labels and tooltip years share the same series.
   Zero-year hovering has no opaque cursor that could resemble a tall bar.
   Failed chart requests show an error/retry control instead of apparent data.
2. Admin, Faculty and Student My Uploads grids use three columns at desktop
   widths (1024px and above) with navigation expanded, four when collapsed,
   and react to the existing sidebar class immediately. Tablet/mobile remain
   two/one columns. Table defaults and user-selected display modes remain.
3. Manual and Google registration accept different ID formats. Non-visitors
   still require a nonempty ID; database uniqueness and a 255-character limit
   remain. The existing `MBC2023-*****` placeholder is unchanged. Verification,
   program/student academic fields, spam prevention and approval gates remain.
4. Faculty has one desktop summary column beside the two-series line graph,
   with a legend identifying assigned uploads and views. Most Viewed and Most
   Cited share the next desktop row. Sections stack on smaller screens.
5. Student Step 3 offers Internal Only, Visitor Access and In Progress.
   Persist the selected publication status while keeping student submissions
   pending. Assigned-Faculty or Admin approval is required before library or
   visitor access. Defaults stay unpublished; later student edits retain the
   established reset to pending/unpublished. Copyright and IMRAD tier rules
   and visitor download restrictions remain.
6. Shared Step 2 includes an editable adviser name. Deterministic extraction
   inspects raw text/OCR page lines beneath an APPROVAL SHEET heading, including
   a heading wrapped over two lines, then reads the name above Adviser.
   Empty/signature-rule lines are ignored; unrelated sections and table-of-
   contents entries do not supply names. Raw lines avoid header-trimming loss.
   Matching ignores capitalization and repeated whitespace. Eligible Faculty
   retain the existing approved/unarchived/available requirements. One match
   selects automatically; none preserves text with a null link; duplicate
   matches offer username/program-labelled account choices or an empty link.
   Changing the name clears a stale choice. Backend submission/edit validates
   matching again. New records save both `adviser_name` and optional `adviser_id`.
   Detail pages display saved text with a legacy Faculty-name fallback.

## Local verification

- Guarded disposable MySQL full regression: **132 tests / 1,160 assertions passed**.
  The runner verified the separate loopback test schema and schema-restricted
  account before running. The new migration ran only in that disposable schema.
- New cases cover academic/upload-year disagreement, zero-filled gaps, six-year
  boundaries, archived/pending/approved filters, dashboard role protection,
  case/space matching, duplicate-name selection, unmatched text, manual edits,
  ineligible accounts, and denied library/visitor/PDF access before approval.
  All three student publication choices survive submission and adviser approval.
- A real synthetic three-page PDF verified adviser extraction through the actual
  text parser. Separate deterministic OCR-line tests verify the same extraction
  path and no matching from acknowledgments, contents or unrelated pages.
- Frontend: **53 Node tests passed**, quiet ESLint passed, final production build
  passed (**848 modules**) using process-only `VITE_API_BASE_URL=/api/v1`.
  No environment file was changed. Windows required `npm.cmd`; esbuild config
  resolution required an approved build outside the filesystem sandbox.
- Chrome with synthetic intercepted API responses passed for all three upload
  roles: three/four desktop columns at 1024px and 1440px, live sidebar toggles,
  two tablet/one mobile columns, Faculty geometry and two rendered line series,
  adviser extraction/manual corrections/duplicate choices, mobile form overflow,
  and each student Step 3 payload. All six Admin tooltip values and labels,
  including empty years, plus failed-request/retry behavior passed.
- Changed/new PHP files passed syntax checks; Git whitespace check passed.
  Browser screenshots/report are ignored under `.local/nov8-dashboard-adviser`.

An early full run caught a change to the existing student edit-reset rule; the
rule was restored and the final full suite passed. An initial browser selector
assumed Recharts tick labels were children of the axis; the installed version
renders labels in a separate layer. Corrected the probe and verified the visible
chart, rather than treating the selector failure as an application defect.

## Adoption and boundaries

The additive migration is
`2026_11_08_000001_add_capstone_adviser_name`. Before serving the new backend on
an existing application target, create and verify a coherent private DB/env/
storage backup, then run forward migrations against the verified target and
restart its queue worker on the updated code. Keep its original APP_KEY,
private configuration and encrypted storage. Code rollback retains the nullable
name column and collected names; the migration deliberately refuses data loss.

No current production health or feature-flow verification was performed here.
Browser checks use synthetic responses and do not constitute a real HTTP upload
or deployed end-to-end certificate. Adviser-specific OCR quality on arbitrary
scans is unverified; this task reused the existing OCR service and bounded large-
PDF sampling (first 12 pages), with manual entry for absent/unreadable names.
Original application records, secrets and documents were not used as fixtures.
