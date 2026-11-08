# Upload layout, required choices and full-PDF keywords - November 8, 2026

Implemented and verified locally from the user's Step 2/Step 3 upload request.
No migration, existing-record rewrite, production access, deployment, commit or push.

## Behavior

- Shared Step 2 retains title/author, then year/program/category, then adviser
  and keywords side by side, then a full-width abstract. Existing tag editing,
  Faculty matching, fixed BSIT and deliberate-edit protection remain intact.
- Admin, Faculty and Student Step 3 require an explicit publication option and
  copyright option. Neither starts selected. Required markers, field errors and
  submission blocking are visible. Selecting a chosen copyright option again
  keeps it selected. Both fields are also required by new-submission API validation;
  old-record editing remains compatible and approval/access rules are retained.
- IMRAD and additional resources share a desktop row. References and submission
  summary share the following row. Paired cards stack on mobile. Unselected status
  appears as Not selected in the summary. Attachment requirements remain optional.
- Keywords use all PDF pages, including middle chapters, instead of only front/CV
  samples. A separate ResearchVocabulary adds literal research/capstone terms to
  the computing dictionary. Rank occurrence counts first; break ties by title,
  abstract, labelled-keyword relevance and phrase specificity. Suggest up to 15
  unique terms actually read from the PDF, with no AI or padding. Manual tags
  retain their shared 15-item validation and individual editing/removal.

## Processing boundaries

Small originals (within the existing automatic parser byte threshold, at most
20 MiB) now read all page text in one Smalot pass. The page loop has a 30-second,
8 MiB text and 20,000-page ceiling; it keeps coordinates only for existing metadata
windows. Individual page text failures fall back to OCR without losing other pages.
Title/author/year/adviser/abstract and CV extraction keep their existing windows.

Large originals use a separate Ghostscript txtwrite process with one private text
file per page, not in-process Smalot parsing. Limits: 45-second wall timeout,
8 MiB aggregate text and 20,000 pages. Linux additionally requires prlimit with
512 MiB address-space, 40 CPU-second and 8 MiB per-output-file limits. Windows has
wall-time/output limits without Linux address-space enforcement. Private outputs
are cleaned on success and failure. A missing large-file front-matter sampler
does not prevent this independent whole-document keyword text pass.

Unreadable pages, including middle pages, use native Ghostscript/Tesseract under
the shared 90-second OCR deadline. Already recognized front/tail pages are reused.
Scans can exceed the deadline; unavailable tools, failed recognition or limits
produce an explicit incomplete/unavailable keyword-reading note. Only completed
coverage reports whole-PDF reading. Empty pages are retained in the native text
pass for OCR rather than silently skipping them. No full document text or physical
storage paths are added to upload-status APIs. Existing uploads are not backfilled.

## Verification

- Final full guarded disposable-MySQL suite: **171 tests / 1,566 assertions passed**.
  Coverage includes all-role missing/empty/null/invalid status rejection without
  claiming staged files; valid persistence/approval gates; actual 150-page PDFs
  with terms on pages 64/110; native all-page text extraction; middle-page OCR
  selection; blank-page retention; incomplete-reading warnings and unavailable
  large-file readers. No database tests used application or production data.
- Frontend: **58 tests passed**, production build **851 modules**, quiet lint
  passed. PHP syntax and Git whitespace checks passed.
- Synthetic Chrome checks passed for Admin, Faculty and Student at desktop
  1440x1100 and mobile 390x844: measured row alignment/order and abstract width,
  stacking/no horizontal overflow, no default selections, missing-choice errors,
  blocked requests, stable copyright selection and valid submission payloads
  retaining manual abstract/adviser edits. Browser APIs were intercepted; backend
  database persistence was verified separately by the guarded suite. Screenshots
  and report are retained privately under `.local/nov8-upload-layout`.
- Verified the local database queue was empty with zero failed jobs. Broadcast a
  graceful restart, verified the owned worker exited, started replacement PID
  **25028**, and updated its private process receipt. Final pending/failed counts
  remain zero. No queued job was removed and no private configuration replaced.

Actual client-PDF accuracy, Linux-native execution limits and production behavior
were not replayed. A future production release must include the new extraction
classes and reload its queue worker, retaining the existing key/database/storage.
