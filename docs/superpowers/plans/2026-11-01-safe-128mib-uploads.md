# Safe 128 MiB uploads — local implementation plan

> Executed in this session using test-first changes. The user initially deferred deployment, then explicitly authorized deployment after testing. UI changes remain deferred.

**Goal:** Accept capstone PDFs through 134,217,728 bytes without whole-file memory allocation, preserving existing files, keys, data, and access rules.

**Architecture:** New uploads use versioned libsodium secretstream encryption with 1 MiB plaintext frames and a mandatory authenticated final frame. Derive its key from the existing Laravel application key with a distinct HKDF context. Existing Laravel ciphertext remains readable without migration. Authenticate a complete encrypted stream before returning a response, then decrypt from the same locked file handle to the response in bounded chunks; never spool large plaintext documents to disk.

**Constraints:** Tests use the existing guarded schema-restricted local MySQL test runner, never the production database. Deployment to the existing AWS instance is authorized; no extra services, paid dependencies, migrations, real-PDF tests, new application key, UI modifications, or automatic conversion/deletion of existing documents. Preserve owner/purpose-bound references, upload serialization, quotas, reserve, roles, and audit records.

**Design decisions:** Keep the existing multipart upload API compatible with the current UI. Raise PHP file/request examples to 128M/140M while retaining the 512M memory ceiling. Resumable browser uploads are deferred with UI work. Skip synchronous parsing/OCR above 20 MiB, return empty metadata plus an additive extraction status, and make extraction failures non-fatal to storage. Guard maintenance/indexing paths too. Do not add a background worker. Small-document extraction remains available; no promise of full-text indexing for large files.

**Alternatives:** Raising PHP settings alone leaves whole-file encryption/retrieval and OCR unsafe. External object storage/host upgrades change costs and operations. Bounded local encrypted streams fit the existing single-host architecture.

## Tasks and verification

- [x] Added failing tests for streamed encrypted storage, legacy reads, corruption/truncation/reordering/append/wrong-key rejection, failed-write cleanup, 128 MiB boundary, and bounded-memory response streaming.
- [x] Implemented `EncryptedFileStream` and `VerifiedDocument`; adapted `PdfEncryptorService` while retaining legacy/token helpers.
- [x] Replaced all whole-file document responses, including visitor routes, with authenticated bounded streams without changing authorization/auditing.
- [x] Added failing HTTP tests for large uploads in each uploader role, exact/over-size boundary, manual fallback, storage quota preservation, and large-PDF submission without parser work.
- [x] Updated limits, PHP examples, extractor/indexing guards, extraction status, and controlled handling of PHP-rejected/partial uploads. Kept existing safeguards and private configuration intact.
- [x] Guarded full suite 71/667 passed; real HTTP 128 MiB round trip and overflow rejection passed; syntax/platform/strict metadata checks passed. Existing lock tests passed; a new multi-worker capacity certification was not attempted.
- [x] Independent review completed. Updated handoff; backed up and deployed to existing AWS instance; verified actual FPM limits, all existing encrypted documents, file/key/config preservation, and public health. Client hosted-upload acceptance remains.

## Review focus

- Late corruption must fail before any response body; final frame and EOF are mandatory.
- Existing ciphertext and prior application keys must remain readable; an incorrect key must fail closed.
- All PDF/IMRAD/resource and visitor routes must preserve their access policy.
- Large files must not reach an unbounded parser through final submission or maintenance paths.
- Disk/write failures, upload quotas, lowered server limits, and shared upload locks must remain effective.

## Baseline

Branch `codex/safe-128mib-uploads`, based on `6740efc`, initially clean. Guarded local unit suite: 19 tests / 71 assertions passed. The historical October 19 source snapshot differs in 35 paths from the current committed source; retain those intentional later changes. Scope later expanded to the explicitly authorized AWS deployment recorded above.

**Rulings:** The user's later explicit deployment authorization superseded the initial local-only restriction. Resumable browser uploads are deferred with UI work; bounded storage/retrieval supports the existing multipart API. Direct exclusive ciphertext writes replace a temporary encrypted copy to reduce disk use and ensure failed-write cleanup after handles close. Runtime maintenance/cache commands use the verified `www-data` worker identity. Source guards stopped safely at stale `sites-available` templates; the inspected active regular files in `sites-enabled` were then updated. Cloudflare activation is pending because registrar access is unavailable; the user accepted AWS-only deployment.
