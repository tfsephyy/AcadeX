# Modular PDF metadata extraction - November 8, 2026

Implemented locally from the client's attached deterministic extraction rules.
No production deployment, database migration or existing-record rewrite.

## Services and responsibilities

All field services are in
`EduArchive-Backend-Laravel/app/Services/Extraction/`.

| Service | Responsibility |
| --- | --- |
| PdfPageReader | Read at most 12 front and 12 tail pages, retaining original page numbers and available PDF coordinates. |
| DocumentPage / MetadataDocument | Carry raw text, cleaned lines, page boundaries and positions internally. |
| HeaderFooterCleaner | Remove evidenced repeated margins, recognized institutional margins, scanner stamps and numerical/Roman page numbers. Preserve legitimate first-page content. |
| TextNormalizer | Normalize Unicode/whitespace, recognized wrapped labels and explicit spacing artifacts without model calls or uncertain rewrites. |
| TitleExtractor | Join first-page title lines and stop before introductory project statements, including wrapped introductions. Preserve title wording and case. |
| AuthorExtractor | Parse separate names following by/Prepared by markers, or immediately above a publication date. |
| YearExtractor | Read a first-page month/year date, including wrapped dates, with a conservative legacy final-year fallback. |
| AdviserExtractor | Read only the name directly above Adviser under APPROVAL SHEET. |
| AbstractExtractor | Prefer Executive Summary; retain labelled Abstract/Summary compatibility; stop at contents, acknowledgments or chapter markers. |
| KeywordExtractor | Rank source-only technical vocabulary/frequency terms, favor title/abstract and explicit lists, deduplicate and limit automatic suggestions to ten. |
| ContactExtractor | Associate emails/Philippine mobiles only within uniquely named CV profiles. Reset across pages/new profiles and leave absent/conflicting data empty. |
| NameNormalizer | Share conservative adviser/CV comparison rules for punctuation, case, spaces, explicit prefixes/credentials and surname-first names. |
| MetadataPipeline | Run shared cleanup first, isolate individual field failures and emit sanitized manual-review notes. Assign fixed BSIT. |

`PdfExtractorService` now handles validation, file-size safety, reading and bounded
native traditional Tesseract. It does not contain field extraction rules or call
Paddle/model APIs. The upload job keeps its existing staging/encryption/status
workflow, persists only metadata/scope/notes and never exposes private raw source.
Preview/indexing still runs after submission.

## Review and persistence

New capstones save BSIT server-side regardless of client input. Review shows BSIT
read-only. Existing records retain saved programs. No bulk data migration is used.
Adviser normalization retains distinct initials; duplicate normalized Faculty
accounts require an explicit choice. Manual account selection fills that account's
name, followed by the existing server-side eligibility/matching checks. No account
is created and no approval/publication permission is relaxed.

Structured author contacts use the existing author_details field and existing
privacy rules. Edited-field tracking protects corrections and deliberate clearing
when background results arrive. Review history carries the draft, edited fields
and completion state when returning from Step 3.

## Verification and limits

- Full guarded disposable-MySQL suite: **154 tests / 1,346 assertions passed**.
  Covers individual rules, missing/ambiguous data, wrapped headings/dates, Unicode
  adviser matching, field failure isolation, CV tail contacts, queued extraction,
  role submission, publication approval and contact privacy regressions.
- Frontend: **55 tests passed**; lint **0 errors / 32 existing warnings**;
  production build **849 modules**.
- Synthetic browser checks across Admin, Faculty and Student: fixed read-only
  BSIT, Faculty account selection, normalized names, duplicate selection, review
  corrections/history and publication submission. Existing responsive dashboard
  and upload layouts also passed.
- Actual Ghostscript/Tesseract locally recognized a generated three-page
  image-only PDF, with its lack of a text layer verified before extraction.
  This is synthetic OCR verification, not a claim about client document quality.
- A synthetic 150-page text benchmark averaged about 37 ms for the bounded
  pipeline across three runs on this workstation. It does not establish upload,
  scanned-document or production latency.
- Local database queue was empty with zero failed jobs before a graceful restart;
  the replacement owned worker is running with an updated private process receipt.

Metadata considers 12 front pages and up to 12 tail pages, so CVs elsewhere need
manual review. Large files above the configured automatic-parser ceiling (at most
20 MiB) require the existing Linux resource-limited Ghostscript sampler; optional
tail sampling also needs qpdf. Those tools are not executed on this Windows
workstation. Unsupported large-file sampling safely preserves the uploaded PDF
and allows manual review. Native OCR shares a 90-second front/tail deadline.
Actual client PDFs and Linux large-file sample quality remain unverified.

No secrets, client documents or database data are included as test fixtures.
