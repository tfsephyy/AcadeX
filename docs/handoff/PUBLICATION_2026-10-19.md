# AcadeX client source publication

Prepared October 19, 2026, Asia/Manila, for the user's requested publication to `https://github.com/tfsephyy/AcadeX.git`, branch `main`.

Publication commit message: `Finalize AcadeX deployment fixes and client AI handoff`. Read the actual SHA from the received Git history. The older HEAD and dirty-worktree counts in the handoff describe its preparation baseline; this publication captures the reviewed source changes and handoff together.

## Included and private materials

Included: application and authorization/authentication fixes, OCR/resource-limit fixes, dependency locks, safe configuration examples, tests, service examples, local launchers, historical deployment reports, client/AI documentation, and source verification metadata.

Excluded: actual environment files, application/database/mail secrets, PEM/private keys, database dumps, real uploaded documents, `.local` evidence/tools, installed dependencies, virtual environments, compiled frontend output, and generated caches. Live account/mail-test addresses were replaced with placeholders in the report's publication copy. Complete original records were retained privately outside Git. Demo-admin identifying fields were anonymized while keeping existing random-password behavior and the production seeding guard.

The old local source fingerprint was retained. The final publication fingerprint includes the intentional demo-fixture privacy cleanup and verifier update. Run `python scripts/check-handoff-source.py` before new edits; it prefers the final publication fingerprint and normalizes UTF-8 line endings.

## Checks completed during publication preparation

| Check | Result and scope |
| --- | --- |
| Default Gitleaks 8.30.1 scan of outgoing tree | PASSED, zero findings; official Windows archive checksum verified before execution |
| Default Gitleaks scan of existing HEAD history | PASSED, zero findings; 23 existing commits at the preparation checkpoint |
| Known local private-value and private-key block checks | PASSED for outgoing candidates; no values printed |
| Frontend unit checks | PASSED, four tests |
| Frontend quiet lint | PASSED |
| Frontend production build | PASSED using public API base `/api/v1`; existing large-bundle warning retained |
| PHP syntax | PASSED for 123 PHP files; publication fixture cleanup also rechecked |
| PHP unit suite | PASSED, four tests / eight assertions; process-isolated in-memory settings, array mail, no production database access |
| Composer metadata/lock validation | PASSED with strict validation |
| Pure Python preprocessing tests | PASSED, two tests; no model inference process started |
| Source fingerprint and handoff links | Checked before the final commit |
| Full database integration/real inbox/live role acceptance | Not repeated for this Git publication; historical October 14 evidence and remaining gaps are described in the handoff |

These are source-publication checks, not a fresh hosted deployment acceptance or an exhaustive security audit. The October 19 HTTPS/SSH connectivity gap remains explicit. No AWS configuration, billing plan, service state, production credentials, or live application records were changed for publication.

## Private handover still required

Follow section 25 of [the main handoff](../../ACADEX_CLIENT_AI_HANDOFF.md#25-git-publication-and-the-remaining-private-handover): client-owned AWS/domain/mail/repository control, independently working server access, private production environment/key, coherent database/encrypted-document backups, application Admin login, and acceptance of client-owned release/recovery responsibilities.

A PEM is a private SSH key. Prefer a client-generated key with its public half installed by an authorized administrator. If returning the client's existing PEM is necessary, give it only to the authorized owner through an encrypted private channel; keep it out of Git and chat. Verify the client's new access before revoking an old key.
