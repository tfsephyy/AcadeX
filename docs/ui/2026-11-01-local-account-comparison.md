# Local and deployed account comparison — November 1, 2026

The user reported that credentials working on deployed AcadeX were rejected by the normal local preview. This was a read-only account/configuration diagnosis, not a database test, account synchronization or password reset.

Fresh observations:

- The running frontend at `localhost:5173` uses the normal local API at `http://localhost:8000/api/v1`.
- The local API is reachable; its CSRF/session endpoint returned HTTP 200. Its effective database is the existing `acadex_local`, independently of the disposable UI-review database.
- The local application has **one administrator account**. Production has **six accounts**: one administrator, two faculty, one student and two visitors.
- The local administrator email also exists as an administrator in production. Its stored password hash differs between the two environments. Different salted hashes alone do not prove different plaintext passwords; no plaintext password was requested or checked.
- The administrator is approved, verified, unarchived and unlocked in both environments, with zero recorded login attempts at inspection.
- The other five production accounts are absent locally. Attempting to sign in locally with one of those emails will produce the existing generic incorrect-credentials response.

Production's active backend path was obtained from the actual enabled Apache vhost rather than assumed from historical release notes. Both database comparisons ran inside explicit read-only transactions. Account/password matching used ephemeral keyed fingerprints; raw passwords, stored password hashes, environment values and production database contents were not exported to this report or copied into the local database. No account status, password, role, production configuration or source was changed. The frontend/backend application source was unchanged by this investigation.

The previous UI verification used synthetic accounts in a separate guarded disposable schema. Those accounts were never installed into the normal local application database. A normal source deployment or frontend build does not synchronize accounts between environments.

## Subsequent selected-account local setup

The user subsequently identified the four intended administrator/faculty/student/visitor accounts and said they use the same deployed password. Only those four selected sign-in records were aligned into the normal local application database. The other two production accounts were not copied.

Before the local change, all 25 local tables and the unchanged local environment were backed up into a restricted, ignored folder under `.local/local-account-backup-20261101-191041/`. The existing local administrator's ID was retained and its credential aligned; three missing local accounts were created. Roles were resolved by name rather than copying production role IDs. The student profile and faculty program were retained where applicable. Existing model authorization-version handling was used; local sessions/tokens for the selected users were invalidated so stale sessions cannot retain access.

Post-change checks verified four local users, exact stored-credential and role matches for every selected account, approved/verified/unlocked/unarchived state, unchanged local capstone data, unchanged environment bytes/application key, and preservation of any unselected local records. Production reads stayed inside read-only transactions; no production account, password, data or configuration was changed. The live login page and local CSRF/session endpoint both returned HTTP 200. No plaintext password was obtained, reset or entered into a browser, so the user should confirm the final sign-in using their existing deployed password at `http://localhost:5173/login` after refreshing.

Account emails and credential-bearing backups remain private and are intentionally omitted from this portable report. Backend/frontend runtime source was unchanged by the account setup; no deployment, migration, seeding or full production-database import ran.
