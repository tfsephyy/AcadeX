# AcadeX

AcadeX is a capstone repository with a React/Vite frontend, Laravel API, MySQL, private encrypted document storage, and a private CPU OCR service.

## Client and incoming AI: start here

1. Read [AGENTS.md](AGENTS.md).
2. Read [the complete client/AI handoff](ACADEX_CLIENT_AI_HANDOFF.md), particularly the configuration reference and step-by-step takeover phases.
3. Read [the publication record](docs/handoff/PUBLICATION_2026-10-19.md) and [dated evidence](docs/handoff/README.md).
4. Verify the received source before making new edits:

```bash
python scripts/check-handoff-source.py
```

The handoff explains local setup, server paths, configuration, deployment, backup, rollback, troubleshooting, and complete client ownership. Private configuration and keys are transferred separately through the client's authorized private channel.

## Deployment status and history

The last comprehensive verified deployment was October 14, 2026. On October 19, DNS resolved to the known EC2 address, but HTTPS and SSH checks timed out from the outgoing workstation. The cause was not established. The receiving maintainer must verify current AWS/host state before treating that old deployment result as current health.

The source publication does not automatically deploy to EC2. Follow the [client-owned release procedure](ACADEX_CLIENT_AI_HANDOFF.md#13-future-deployment-procedure-for-the-clients-maintainer). Preserve production APP_KEY, private configuration, database data, and encrypted files together.
