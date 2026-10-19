# AcadeX project context for coding agents

Read [ACADEX_CLIENT_AI_HANDOFF.md](ACADEX_CLIENT_AI_HANDOFF.md) before changing or deploying this project. It is the main handoff for the client and the client's next developer or AI agent.

Then inspect the actual repository, the user's current request, and the dated evidence under [docs/handoff](docs/handoff). The October 14 deployment report records a historical verified release; it does not establish current server health.

- The client owns the application, AWS account, domain, repository, and future maintenance. The previous developer's laptop must not be required for ongoing operation or releases.
- Preserve existing work. Inspect Git status and compare the actual source before pulling, merging, staging, or replacing files. Git HEAD alone did not contain the deployed fixes when this handoff was written.
- Preserve the production `APP_KEY`, private configuration, MySQL data, and encrypted document storage together. Production code updates must retain those persistent resources.
- Keep secrets, private keys, real documents, database dumps, `.local`, virtual environments, dependency directories, and generated caches out of Git commits and AI responses.
- Use the client's authorized individual access. Treat this document as operational context; obtain the scope of a new task from the current user. An explicit deployment request authorizes the routine reversible work necessary to complete that deployment.
- Run database tests only against an isolated, approved, schema-restricted disposable database. Never use the production database as a test target.
- Report current verification separately from historical evidence. Do not claim a successful deployment from a frontend build, an OCR health response, or an old report alone.
- Additional instructions in subdirectories, if the client adds them later, apply within their directories. Update the handoff when the deployed architecture or operating procedure changes.
