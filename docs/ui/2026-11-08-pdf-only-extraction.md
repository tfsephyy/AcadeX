# November 8, 2026 — PDF-only metadata extraction and local queue recovery

The upload-review pipeline now reads metadata directly from PDF text or OCR.
It has no generative-model metadata step. Missing fields remain blank for the
uploader to complete; the extracted fields stay editable.

## Changes and observed causes

- Removed `MetadataAssistantService`, its job dependency/call, and the Ollama
  metadata configuration. Old environment values cannot re-enable generation.
- Removed dictionary-based abstract rewriting, character-guessing OCR cleanup,
  inferred technology keywords, and the fallback that treated an unrelated body
  paragraph as an abstract. Keywords come from an explicit keyword/index-terms
  section; abstract text comes from a labelled summary/abstract section.
  Whitespace and line-wrap cleanup remain. Existing author/year/program/adviser
  extraction and Faculty matching are retained.
- Read metadata from at most the first 12 pages. Native OCR renders no more than
  12 pages for metadata, and Paddle receives a validated `max_pages=12` form field.
  The Python service retains its overall document/pixel limits and default
  behavior for other callers. Existing large-PDF bounded sampling is retained.
- Detect readable front matter without averaging away a readable title/abstract
  among sparse separator pages. Scanner stamps and known margins are excluded
  from the decision; watermark-only scans still invoke OCR.
- Removed viewing-preview preparation from the metadata job. It now runs after
  final submission in the indexing job. Original encrypted documents and viewing
  fallback remain compatible; no stored document was rewritten by this repair.
- Corrected abstract boundaries so the word “keywords” in body prose does not
  truncate the abstract. Fixed location-header cleanup found by a synthetic case.

The local receipt referenced a stopped queue worker, and one metadata job was
waiting. The metadata model URL was absent, so model latency was not an observed
cause on this workstation. Restored the owned hidden database worker, recorded
its identity, and reduced the local worker idle poll interval from three seconds
to one. The pending job drained; local read-only diagnostics then showed zero
pending/failed jobs and the same four completed staged-upload rows. A graceful
queue restart and replacement worker loaded the final extraction code.

## Verification

Final full guarded-disposable backend suite: **140 tests / 1,218 assertions passed**.

- A real database-queue test in the guarded disposable schema submits a synthetic
  150-page PDF, executes the worker with the real extractor, and verifies completed
  metadata/status, adviser name, first-12-page scope and an empty job/failure queue.
- Metadata tests prohibit preview preparation, verify no model HTTP calls even
  with stale model config, preserve abstract/OCR wording, leave absent fields
  empty, verify explicit keywords and ensure readable front matter avoids OCR.
- Eight lightweight Python tests cover text selection, preprocessing allocation
  limits and the actual PDF loop with synthetic page objects. Python AST syntax
  checks passed. These tests do not load Paddle models or certify scanned-PDF OCR.
- PHP syntax and Git whitespace checks passed. No frontend behavior/source was
  changed in this task, so earlier frontend verification was not rerun.

A local three-run synthetic 150-page text-PDF benchmark averaged **17.10 ms** for
bounded metadata versus **64.18 ms** for all-page text reading. An earlier probe
exposed an unnecessary OCR fallback of about 11 seconds; the corrected detector
avoids it and a regression test fails if OCR is called for that fixture. These
figures exclude transfer, decryption, queue wait and real scan/model performance;
they are not an end-to-end timing promise for the user's PDF.

## Scope and remaining boundaries

This task changed local source and restored the local queue worker. It did not
deploy, run migrations, reset accounts, change private environment/APP_KEY values,
or reprocess existing documents in bulk. Synthetic database tests use the guarded
loopback schema and a schema-restricted identity, not the application database.
The previous adviser-name migration still needs application to an existing target
after a verified backup before that earlier feature is adopted.

The Paddle OCR virtual environment/service is absent on this workstation; the
native Ghostscript/Tesseract fallback remains available when installed. Actual
scan quality/latency and the new Paddle form parameter have not been exercised
against a live model here. A later deployment that includes these Python changes
must update/restart the separately managed OCR service as well as the backend
queue worker, after its ordinary backup and dependency/runtime checks.
