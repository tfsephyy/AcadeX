# Technical keywords and adviser editing - November 8, 2026

Implemented locally from the client's attached keyword/adviser/editing request.
No migration, bulk rewrite, production deployment, commit or push.

## Changes

- `TechnicalVocabulary` contains the maintained computing dictionary.
  `KeywordExtractor` only suggests whole technical words/phrases actually present
  in cleaned PDF source. Frequency, title/abstract occurrences and explicit labels
  affect ranking. Explicit labels also pass the dictionary; general words such as
  education/community/archive are excluded. Return at most 15 without padding.
  No model/API/AI processing or new text correction is used.
- Backend `KeywordInput` shares the 15-item/100-character limits and comma-list
  normalization. Both create and update normalize before validating, so comma
  lists inside array entries cannot bypass the cap and valid long combined input
  is checked per keyword. Invalid types/overlong terms are rejected, not dropped.
  Case-insensitive duplicates and empty entries do not consume slots.
- Shared React `KeywordInput` supports paste/typing comma lists, Enter/Add for
  single terms, individual tag editing/removal, counts and visible validation.
  A failed addition preserves existing tags; unresolved validation blocks Save
  or Next until corrected or explicitly cleared. Upload and edit use this editor.
- Shared `AdviserField` placeholder is exactly `Enter Manually here`.
  The edit modal displays saved adviser text (or an empty field when absent),
  supports manual corrections and Faculty selection, and keeps existing server
  matching/eligibility and duplicate-account selection rules. Unknown names keep
  plain text with no link. No new Faculty account is created.
- The existing shared Admin/Faculty/Student edit modal omits untouched keywords
  and adviser fields. This preserves keyword rows/IDs and unavailable historical
  assignments during unrelated edits. No extraction runs automatically against
  previously uploaded capstones. Legacy lists above 15 survive unrelated edits;
  any intentionally saved keyword replacement must satisfy the current cap.
- Existing keyword relations, detail/card rendering, search/filtering, Faculty
  dashboard queries and personal-information/approval permissions are retained.
  Adviser reassignment immediately changes the assigned dashboard counts through
  the existing foreign key. Student edits retain pending/unpublished behavior.

## Verification

- Guarded disposable-MySQL full suite: **164 tests / 1,452 assertions passed**.
  New integration coverage saves/refreshes 15 tags for all upload roles, rejects
  16 after splitting, updates/removes tags, preserves omitted legacy fields,
  reassigns Faculty dashboard counts, retains unlinked names and rejects
  unauthorized/assignment-only edits. Technical extraction tests exclude general
  words, enforce source boundaries, rank relevant terms and do not pad results.
- Frontend **58 tests passed**. Full lint: **0 errors / 32 existing warnings**.
  Production build passed with **851 modules**. Final edited-component lint also
  reports no errors (only the pre-existing review-page dependency warning).
- Synthetic Chrome browser checks passed for Admin, Faculty and Student upload
  and existing-capstone edit flows: exact placeholder, saved/missing adviser text,
  Faculty/duplicate selection, unknown names, comma paste, case deduplication,
  individual editing/removal, 15-limit validation, blocked Save/Next, deliberate
  clearing, persistence after mock API refresh and readable mobile dialogs.
  The browser used intercepted synthetic APIs; real MySQL persistence is proved
  separately by the guarded integration tests.
- Local worker reload and final state are recorded in the progress log.

The preceding extraction page/size/OCR limits remain unchanged. Actual client-PDF
accuracy and production behavior have not been replayed for this source update.
