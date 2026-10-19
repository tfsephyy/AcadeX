# Dated client handoff evidence

These files accompany [the main client/AI handoff](../../ACADEX_CLIENT_AI_HANDOFF.md). They contain portable metadata, not private recovery material or an automatic deployment.

| File | Purpose |
| --- | --- |
| [STATE_2026-10-19.json](STATE_2026-10-19.json) | Current local Git context, DNS results, failed public/SSH connectivity observations, and explicit runtime unknowns |
| [LOCAL_SOURCE_SNAPSHOT_2026-10-19.json](LOCAL_SOURCE_SNAPSHOT_2026-10-19.json) | File paths and hashes for eligible local application/deployment source, including uncommitted fixes |
| [PUBLICATION_SOURCE_SNAPSHOT_2026-10-19.json](PUBLICATION_SOURCE_SNAPSHOT_2026-10-19.json) | Final source fingerprint after publication privacy cleanup; preferred by the verifier |
| [PUBLICATION_2026-10-19.md](PUBLICATION_2026-10-19.md) | Publication scope, checks, preserved historical context, and remaining private handover |

Use the source fingerprint to check that the receiving repository actually includes the handed-over code. It is not a new claim about bytes served by EC2. `sha256_raw` records local bytes; `sha256_lf_utf8` permits comparison of text across Windows CRLF and Linux LF line endings. Legitimate later source changes require a new dated fingerprint rather than editing this historical record to match them.

Run `python scripts/check-handoff-source.py` from the repository root before making new edits. The verifier uses the publication snapshot when present, otherwise the earlier local snapshot. It reads local files only, handles normal UTF-8 CRLF/LF conversions, and does not connect to AWS or a database. It reports missing or different files rather than modifying them. The earlier local snapshot remains an unmodified pre-publication record; publication privacy cleanup and the verifier selection change are intentional differences from that record.

The October 19 public HTTPS requests and SSH connection did not complete from the outgoing workstation. Root and WWW DNS resolved to the known Elastic IP. The cause was not established. Use the client's current AWS access and a suitable network to verify the existing instance and services before a production change.

The production runtime and owner acceptance recorded in [the deployment report](../../ACADEX_PRODUCTION_DEPLOYMENT_REPORT.md) were verified on October 14. Read the dates and boundaries together.

No environment values, passwords, SSH private keys, database contents, real uploaded documents, model weights, or private backups are included here. Git history was not copied or modified.
