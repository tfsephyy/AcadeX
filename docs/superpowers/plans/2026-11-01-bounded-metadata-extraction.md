# Restore automatic metadata filling for large capstones

The deployed 128 MiB upload safety change skips extraction above 20 MiB; the unchanged review banner incorrectly claims metadata was extracted. The user requests restoration of automatic filling, with the existing free-only hosting and data-preservation constraints retained. Deployment authorization from this session remains applicable.

Use the existing Ghostscript installation to produce a private temporary PDF containing at most the first 12 pages. Limit its output to the existing 20 MiB parser/OCR envelope and its Linux process to bounded address space, CPU, wall time and output size. Feed that sample through the original text/metadata extractor and PaddleOCR connector, without giving PHP's PDF parser the large original. The encrypted complete original remains intact. Failure falls back to an accurately described manual form. No new service, model/runtime upgrade or background worker is required.

- [x] Reproduce missing large-PDF metadata and misleading notice with failing tests.
- [x] Implement the bounded sample and restore the extraction call for large files; retain storage and final-submission guards.
- [x] Pass extraction status/scope to the shared review form and display truthful notices, preserving its layout.
- [x] Verify metadata fields with synthetic text/scanned samples and the actual AWS native tools, without using production as a database-test target. Check the reported uploaded PDF's metadata availability without disclosing its text.
- [x] Run isolated full backend tests, frontend tests/lint/build, independent review, and file-preserving deployment with backup and current-runtime verification.

The reported PDF exposed a second cause: each sampled page contained only scanner-watermark text, but Python treated any embedded text as sufficient and skipped image OCR. The fast path now requires at least 80 trimmed characters; image recognition can replace sparse text, and empty recognition preserves any readable short text. The existing single OCR worker was restarted with its WorkingDirectory pointing at the new release; identity, environment, interpreter, models, dependencies, and worker count were preserved.

Final evidence: 75 PHP tests / 705 assertions passed in the guarded disposable schema; frontend 8 tests, lint and build passed; Python 3 text-path and 2 preprocessing tests passed. The deployed extractor returned all six metadata fields from the reported 93.16 MiB PDF in about 51 seconds with its encrypted original checksum unchanged. See the dated handoff report for production evidence and limits.
