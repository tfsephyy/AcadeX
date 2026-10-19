# AcadeX production deployment report

GitHub publication copy, October 19: live account and mail-test recipient addresses have been replaced with role/private-mailbox placeholders. The complete private original was retained outside Git. Obtain actual login identifiers and credentials from the client through its private handoff records.

Final testing handoff: **October 14, 2026, 5:55 PM Asia/Manila**.

**Status: DEPLOYED AND READY FOR OWNER TESTING at https://veload.site.** The owner confirmed that login works on the canonical root address and that the requested Gmail test message arrived. The owner narrowed this continuation to a usable deployment for controlled testing and asked to defer further hardening. This handoff does not claim unrestricted production acceptance of every workflow.

## Live accounts requested by the owner

| Email | Role | State |
| --- | --- | --- |
| CLIENT_ADMIN_EMAIL | Admin | Approved and verified |
| CLIENT_FACULTY_EMAIL | Faculty | Approved and verified |
| CLIENT_STUDENT_EMAIL | Student | Approved and verified |
| CLIENT_VISITOR_EMAIL | Visitor | Approved and verified |

The original administrator was `CLIENT_FACULTY_EMAIL`. The owner explicitly selected the listed-order role mapping: `CLIENT_ADMIN_EMAIL` is now the administrator and `CLIENT_FACULTY_EMAIL` is Faculty. Three new accounts were created in one database transaction; the existing account changed role. All four have the identical stored bcrypt password hash from the existing account, verified internally without displaying or obtaining the password. The owner can use the password that successfully logged into the root site. Role changes invalidate the prior administrator session; sign in again after that change. The Student has a clearly marked test profile. No welcome email or registration notification was sent by this private provisioning operation.

The final read-only inventory at 09:55 UTC confirms all four requested roles and password matches, with all four approved, verified and unarchived. There are now **five total live accounts**: a further approved, verified Student account, `PRIVATE_CLIENT_MAILBOX_1`, was created at 09:48:44 UTC after the provisioning transaction. That additional account was left unchanged; its password was not checked, copied or reset. The earlier provisioning result's count of four describes its transaction checkpoint, not the final total.

Private pre-account backup: `/var/backups/acadex/accounts-20261014T094750Z`, with gzip integrity checked and paired existing environment, directory `0700`, files `0600`. APP_KEY was preserved. Existing account names and passwords were not reset. These four accounts are intentionally retained for the owner's role testing; they are separate from the disposable regression databases, which were removed with approval.

## What is verified now

| Check | Status | Actual evidence and boundary |
| --- | --- | --- |
| Public root HTTPS and React routing | PASSED | Ordinary public requests to `/`, `/login`, `/register` return 200 on AWS, TLS verification enabled; Chrome rendered the login page |
| WWW DNS and canonical redirect | PASSED for tested resolvers and browser | Hostinger authorities, 1.1.1.1 and 8.8.8.8 resolve WWW to the root/AWS; normal WWW HTTP/HTTPS return 301 preserving path/query; Chrome lands on `veload.site` |
| Owner login | OWNER CONFIRMED | Owner's phone login succeeded after using `https://veload.site/login`; earlier WWW login failed and did not appear in the inspected AWS login logs. Cached old WWW routing is an inference, not a captured phone DNS trace |
| Real email delivery | PASSED plus OWNER CONFIRMED | Gmail SMTP accepted the explicitly authorized harmless message to `PRIVATE_CLIENT_MAILBOX_2`, subject `ACADEX DEPLOYMENT TEST 2026-10-14`; owner confirmed receipt. Sender, credentials, MAIL_FROM_ADDRESS, registered emails and notification workflows were unchanged |
| Laravel/MySQL connection | PASSED | Serving configuration cached, connection succeeds, 25 tables and 29 applied migrations; all four roles exist |
| Isolated application regression | PASSED | EC2 PHP 8.3.6, locked PHPUnit 11.5.57: 31 tests / 434 assertions. Includes auth/CSRF, authorization, document ownership, adviser response projection, storage quotas and upload throttling. Isolated schema/storage and array mail; not four live browser account logins |
| Real HTTP session test | PASSED in isolated environment | Separate loopback server: CSRF initialization, missing-CSRF rejection, cookie login/persistence, unauthorized document rejection, authorized encrypted retrieval, logout and logout revocation. Temporary server stopped |
| Frontend checks | PASSED | Four Node tests, including hostile HTML escaping and API base resolution; `npm ci` from existing lock, production build with `/api/v1`, quiet lint exit 0. Existing large-bundle warning remains |
| Private Paddle OCR | PASSED | Fresh image, scanned PDF and embedded-text PDF recognition; invalid PDF 422. Live Laravel connector recognizes the expected phrase with both `.pdf` and extensionless temp filenames after the fix |
| Native OCR fallback | PASSED for small synthetic fixture | Final Ghostscript/Tesseract test recognizes `ACADEX OCR TEST 2026`, one page, 0.39 sec. Fixed 1,660 x 2,340 canvas, 30-page limit and process deadlines. Nonstandard oversized pages may clip in this bounded fallback; primary OCR remains the normal metadata path |
| Backup restoration | PASSED in disposable schema | Existing `prelaunch.sql.gz` restored using a schema-restricted account: 25 tables, 29 migrations, 1 user, 0 capstones. No live-schema import or real row values printed |
| Approved test cleanup | PASSED | Both named disposable schemas, both restricted MySQL accounts and exact `/srv/acadex-staging/test-runs/aec14026f1` folder removed. Existing backups retained |
| Service state | PASSED | Apache, PHP-FPM, MySQL, OCR and Certbot timer active/enabled. Apache syntax passes; OCR health 200. This verifies current state/boot enablement, not a reboot acceptance test |
| Certificate renewal | PASSED | Both original lineages changed from manual DNS-01 to webroot HTTP-01. Reconfigure and full `renew --dry-run --run-deploy-hooks` passed; guarded Apache reload hook installed and exercised; timer active/enabled |
| AWS network/storage | PASSED within inspected instance | Actual instance and Elastic IP confirmed; SG `acadex-sg` permits public 80/443 and restricts 22 to one /32. No private backend/OCR/MySQL ingress rules. One attached 30 GiB encrypted EBS volume |

## Serving version and completed changes

Instance: `i-04dcf0ae3c97230ad`, `t3.small`, Sydney `ap-southeast-2`, public Elastic IP `54.153.196.115`. Release directory remains `/srv/acadex-staging/releases/acadex-remediation-d61a0aa271f7a1e4`, with reviewed overlay **`acadex-finalization-20261014-aec14026f1`** and the later single-file native OCR correction. The current frontend bundle is **`index-CRbaLIEW.js`**; stylesheet remains `index-ByTWH9YB.css`. `ACADEX_FINALIZATION_MANIFEST.json` records the overlay on the server; 21 deployed paths were digest verified at the main overlay checkpoint, with the native helper digest updated after its correction. The original 263-file manifest describes the preceding release and is not presented as passing unchanged after this overlay.

The completed changes are the root/WWW Apache configuration, automatic Certbot renewal, explicit loopback proxy trust, PHP-owned private temp directory, escaped chatbot formatting, correct `.pdf` multipart name, rejection of OCR safety failures before native fallback, shared bounded native rendering, restricted adviser identity projection, serialized pending-upload limits, shared upload rate limiting and free-space reserve. Source credential material was removed from local SETUP.md; that document was never deployed. Pip alone was updated to 26.2.1 with official verified wheels and a rollback copy; no Paddle runtime upgrade occurred.

Normal uploads remain synchronous. No queue worker or scheduler was added: the current background job is a separate optional PDF backfill/maintenance path, and its queue backlog was zero. Production does not depend on Windows development processes or an SSH tunnel. The laptop can be turned off while EC2 remains running.

## Remaining items intentionally deferred for the testing phase

- The owner should test the four role accounts, account/profile actions, one PDF submission and approval/retrieval flows with appropriate test documents. The administrator's real login was confirmed before its role changed; all four live role logins were not separately driven by the agent.
- Additional hardening, off-server encrypted backups, backup retention automation, representative concurrency/long-PDF testing and actual reboot recovery were deferred at the owner's request. Same-instance backups and an isolated successful restore do not establish independent disaster recovery.
- OCR remains on the original `ubuntu` service identity. Attempts to change it to a dedicated account encountered parent-directory and virtualenv access restrictions; the original unit and virtualenv top-directory ownership were restored and the original worker was verified healthy. Do not report this optional hardening as completed. Final recorded NRestarts=7 reflects those failed setup attempts, not a zero-error history. Parent traversal ACLs and private copied models were retained, along with private rollback backups; the application environment is not readable by the new inactive service identity.
- Frontend and production Composer audits returned zero advisories. Official OSV queries of 69 OCR packages retain advisories for PaddlePaddle, imgaug and setuptools. First-party source review did not establish an upload path to the advisory pickle/model-download operations; vendor implementation was not exhaustively audited. These compatibility advisories are retained for later work.
- Low-severity account-existence discrepancies remain in public recovery/signup-verification responses. Rotate shared test passwords individually before wider public use. No credential values are included in this report.

## AWS Free Plan and costs

The authenticated Console showed **Free Plan**, **$100 credits**, and **182 days remaining (April 14, 2027)**. The default Cost Explorer page covered April through September 2026 and displayed zero for that prior interval; it was not evidence of zero October usage. No billing plan was upgraded and no EC2, EBS, Elastic IP, load balancer, database service, paid-only feature or additional hosting service was created or resized by this continuation. Current EC2/EBS/public-address usage can consume credits. The Free Plan is time/credit limited and does not promise indefinitely free 24/7 hosting; AWS documents automatic account closure when its duration or credits end unless upgraded. See [AWS account-plan guidance](https://docs.aws.amazon.com/en_en/awsaccountbilling/latest/aboutv2/free-tier-plans.html).

## Backups, rollback and evidence

Private server backups include:

- Apache: `/var/backups/acadex/apache-20261014T073105Z`.
- Certbot: `/var/backups/acadex/certbot-20261014T074622Z`.
- Runtime proxy/temp settings: `/var/backups/acadex/runtime-20261014T075809Z`.
- Pip tooling: `/var/backups/acadex/ocr-tooling-20261014T082707Z`.
- Application/source/autoload/config caches: `/var/backups/acadex/application-20261014T090908Z`.
- Native helper corrections: `/var/backups/acadex/native-cwd-20261014T093515Z` and `/var/backups/acadex/native-cwd-20261014T094741Z`.
- Account provisioning snapshot: `/var/backups/acadex/accounts-20261014T094750Z`.

For a justified application rollback, compare current files against the overlay manifest and restore only the saved source paths plus matching autoload/config/route caches from the application backup, then reload PHP-FPM and repeat HTTPS/CSRF/OCR checks. The prior hashed bundle is retained; restoring the saved index can switch it back. Review the separate native helper correction when choosing the target. Preserve APP_KEY and shared storage. Do not import the whole pre-account database to undo account provisioning: it could overwrite later test work. Account rollback would need a separate scoped owner action. Original failed optional OCR-unit changes were actually rolled back; a full application rollback drill was not run.

Current redacted evidence is under ignored `.local/aws-finalization/`: `application-hotfix.json`, `native-canvas-correction.json`, `native-ocr-passed.json`, `laravel-ocr-connector-retest.json`, `isolated-validation.txt`, `http-auth-isolated.txt`, `restore-test.json`, `isolated-cleanup.json`, `final-server-state.json`, `final-application-state.json`, `role-accounts-created.json`, `role-accounts-final.json`, `post-account-application-state.json`, `accounts-backup.json`, `smtp-owner-recipient.json`, `http-final.json`, and browser/AWS screenshots. The two earlier final state files preceded account provisioning and record one user; the post-account state and final inventory supersede that count with five. The original after-Apache HTTP evidence remains in `http-after.json`; the helper name `http-before.json` was reused for a later probe, so use the explicit final file and retained history rather than infer chronology from that filename.

The static security baseline is retained as a separate pre-fix, partial-coverage report:
[Codex Security report](C:/Users/ASUS/.codex/state/plugins/codex-security/scans/EduArchive/4560e3f32e6cd8b6f63e0c2a4373b8b94f241546_20261014T075019Z_100xggcp/report.md).
It recorded six original findings, 219 fully reviewed source paths, and explicit remaining coverage. It is not a post-fix acceptance audit. The workbench reported 34,923,058 total tokens, 34,720,783 input and 33,550,336 cached input across four threads; these are workbench token measurements, separate from AWS resource charges.

No agent-owned background test server or database task remains running. Existing production services continue under systemd. Local dirty work was preserved; no reset, pull, commit, push or broad staging occurred.

---

## Preserved earlier checkpoints

The following sections are historical. Their failed checks and pending actions describe their respective timestamps and are superseded by the completed/current testing handoff above.

Current continuation checkpoint: **October 14, 2026, 4:37 PM Asia/Manila**. The owner confirmed the Hostinger update. Authoritative DNS and public resolvers now return `www -> veload.site -> 54.153.196.115`; ordinary Chrome navigation reaches the AWS root after the canonical redirect.

**Current verdict: NOT READY FOR UNRESTRICTED PRODUCTION. Work is continuing.** DNS is no longer a blocker. Both certificate lineages have been reconfigured to webroot HTTP-01, both renewal dry-runs passed, and the validated Apache reload hook and timer are installed. Loopback proxy trust and private PHP temporary-directory ownership were corrected with private backups; APP_KEY was preserved.

Fresh synthetic OCR tests passed for an image, scanned PDF and text PDF; invalid PDF rejection passed. The real Laravel connector reproduced an extensionless multipart filename problem. Source review also identified unsafe chatbot HTML rendering, native PDF fallback resource limits, adviser profile serialization and cumulative staged-upload allocation that require remediation. A documented administrator credential is redacted in audit evidence and still requires private owner rotation. Application patches have not been deployed at this checkpoint.

Frontend and production Composer audits report zero advisories. The private OCR environment was checked against OSV; pip was updated alone from 24.0 to 26.2.1 using verified official wheels and a rollback copy, and its follow-up query returned zero advisories. PaddlePaddle, imgaug and setuptools compatibility advisories still require the source-reachability disposition described in the continuation evidence. No blind OCR runtime upgrade occurred.

Public login and registration views rendered in ordinary Chrome at desktop and 390-pixel mobile widths; no horizontal overflow or console errors were observed. Authenticated workflows, fresh real inbox delivery, backup restore, reboot acceptance, AWS security groups/EIP/billing, off-server backups and administrator rotation remain incomplete. No real user or capstone records were changed.

Continuation evidence is in the ignored `.local/aws-finalization/` folder. Private server rollback directories include `/var/backups/acadex/certbot-20261014T074622Z`, `/var/backups/acadex/runtime-20261014T075809Z` and `/var/backups/acadex/ocr-tooling-20261014T082707Z`.

The earlier checkpoint below is retained as history. Its DNS failure and pause describe the initial state and are superseded by this continuation; its original failed checks are not erased.

---

Checkpoint: **October 14, 2026, 3:39 PM Asia/Manila**. Live checks ran approximately 3:23–3:34 PM. This report records the current authorized AWS finalization task, separately from historical local readiness reports.

**Verdict: NOT READY FOR UNRESTRICTED PRODUCTION.** The root domain is reachable on AWS, and the AWS-side `www` HTTPS redirect is configured and tested. Public `www` DNS still directs visitors to the obsolete Vercel deployment. Work is paused at the specific Hostinger DNS action reserved for the owner. Certificate renewal and the remaining application, security, recovery, and AWS account checks are unfinished.

Status definitions: **PASSED** means executed successfully within the stated test boundary; **FAILED** means executed with an adverse result; **NOT RUN** means not executed; **NEEDS VERIFICATION** means evidence or acceptance remains incomplete. Historical handoff claims are identified explicitly and are not current test results.

## Current infrastructure and architecture

| Item | Current evidence |
| --- | --- |
| Instance | IMDSv2 confirmed `i-04dcf0ae3c97230ad`, `t3.small`, `x86_64`, `ap-southeast-2` |
| Public IPv4 | IMDSv2 and public HTTP confirmed `54.153.196.115`; Elastic IP allocation association still needs AWS control-plane verification |
| Operating system | Ubuntu 24.04.5 LTS |
| Release | `/srv/acadex-staging/releases/acadex-remediation-d61a0aa271f7a1e4` |
| Laravel / PHP CLI | Laravel 12.69.3 / PHP 8.3.6; PHP-FPM 8.3 service active |
| Database | MySQL service active and enabled; application connection succeeds |
| Resources | 1,905 MiB RAM, 2,047 MiB swap; approximately 696 MiB available RAM at discovery; root filesystem 29 GiB, 7.0 GiB used, 22 GiB free |
| Frontend | React static `dist`; `index-CT6SmCho.js`, stylesheet `index-ByTWH9YB.css` |
| Public routing | Port 80 redirects root and `www` to canonical HTTPS, except HTTP-01 challenge files; root port 443 serves React and proxies `/api/` and `/sanctum/` |
| Canonical URL | `https://veload.site` |
| WWW routing on AWS | Separate HTTPS virtual host with existing `www.veload.site` certificate; permanent redirect to the canonical root |
| Private listeners | Apache `127.0.0.1:8080`, `127.0.0.1:8081`, `127.0.0.1:8443`; OCR `127.0.0.1:8001`; MySQL `127.0.0.1:3306` and `33060` |

Apache serves only the compiled frontend on the public application host. Laravel runs behind the loopback backend virtual host through PHP-FPM. Laravel calls the private OCR service. Node is not required to serve this frontend. The serving processes and persistent files are on EC2; the public root response was obtained directly from AWS without a laptop-hosted web service or SSH tunnel. A server reboot acceptance test has **NOT RUN**.

The local workspace remains dirty. Existing source, lockfiles, release manifest, `.env`, and previous documentation were preserved. No Git reset, pull, staging, commit, push, dependency installation, application rebuild, application-key rotation, migration, or user/capstone modification occurred in this checkpoint.

## Phase A: discovery results and discrepancies

| Check | Status | Evidence / limit |
| --- | --- | --- |
| Windows terminal and SSH key availability | PASSED | Actual Windows OpenSSH connected using the existing key; batch authentication and strict host-key verification enabled |
| Apache baseline syntax | PASSED | `apache2ctl configtest`: `Syntax OK` |
| Apache enabled sites | PASSED | Inspected actual configurations, enabled symlinks and virtual-host mappings |
| Root DNS | PASSED | Both Hostinger authoritative nameservers, Cloudflare `1.1.1.1`, and Google `8.8.8.8` returned `54.153.196.115` |
| WWW DNS | FAILED | Both authoritative nameservers still return CNAME `770b275af54aad50.vercel-dns-017.com`; public queries resolve to Vercel addresses |
| IPv6 routing | PASSED within DNS scope | No root AAAA address was returned by the queried resolvers; `www` still follows the old CNAME |
| Existing certificates | PASSED | Separate certificates cover the exact root and `www` names and expire January 11, 2027 UTC |
| Services | PASSED | Apache, PHP-FPM, MySQL and `acadex-ocr` active and enabled; Certbot timer active/enabled |
| Production settings command | PASSED | `acadex:check-production` returned success; this does not prove workflows, mail delivery, or recovery |
| Database state | PASSED | Connection succeeds, 25 tables, all 29 migrations applied, four roles; aggregate counts show one approved/verified active admin and zero capstones/jobs/failed jobs/document-upload rows |
| OCR health | PASSED | Loopback `/health` returned `{"status":"ok"}`; fresh recognition and application upload tests **NOT RUN** |
| Persistent paths | PASSED for inspection | `.env` resolves to shared private configuration; `storage` resolves to shared storage; no `public/storage` symlink found |
| Full deployed manifest verifier | FAILED | Existing verifier rejects a storage placeholder path that resolves outside the release after the intentional shared-storage symlink; see integrity distinction below |
| AWS security groups, EIP allocation, extra resources and credits | NOT RUN | AWS control-plane authentication has not been established; OS listeners and metadata do not prove security-group rules or account billing |

Material discrepancies and remaining leads:

- AWS had no public `www` HTTPS virtual host at discovery. A direct AWS HTTPS request for `www` failed hostname verification; its HTTP request fell through to the default site. This has been corrected and retested.
- Public `www` still serves `index-BR7jTEXU.js` from Vercel. The root serves `index-CT6SmCho.js` from AWS. This split is reproduced through normal DNS and remains the immediate blocker.
- Both certificate renewal files still use `authenticator = manual` and DNS-01 challenges. No renewal hooks are installed. An enabled Certbot timer does not make these lineages automatically renewable.
- Effective `acadex.trusted_proxies` is empty although Apache supplies `X-Forwarded-Proto: https`. The configuration checker does not test this. Explicit loopback trust and actual HTTPS URL generation need correction/verification during continuation.
- No `acadex-queue` service is installed. The queue is configured as `database`, retry-after is 660 seconds, and backlog is zero. Source inspection found the PDF backfill command dispatches jobs; normal upload extraction is synchronous. A maintenance queue worker decision remains open. No application schedule was found in `routes/console.php`.
- The shared private-temp directory is owned by `ubuntu`, group `www-data`, mode `0770`. `PrivateTemp` attempts to enforce mode `0700`; PHP-FPM ownership and actual temp creation need verification before accepting uploads. No production temp ownership change was made here.
- UFW is inactive. Private services bind to loopback, but SSH restrictions and public ingress rules require AWS security-group review. No firewall or SSH changes were made.

## Release and frontend integrity

The local `scripts/verify-release-manifest.py` passed for candidate `acadex-remediation-d61a0aa271f7a1e4`, **263 source files**. On EC2 the unchanged strict verifier stopped at `EduArchive-Backend-Laravel/storage/app/.gitignore`, because its resolved path lies in shared storage rather than beneath the release root. This failure is retained; the verifier was not weakened or represented as passing.

A separate read-only hash comparison checked all 263 manifest entries on EC2, including the intentional shared-storage paths: **263 matched, zero missing, zero different**. These are file-byte comparisons; they do not turn the strict path-containment check into a pass or establish complete application acceptance.

The deployed main bundle SHA-256 is `0cbdd30c60c6e08e2749a5f33c19d2736c594bbdc41896d131cc874dd15584d1`. Source accepts `/api/v1` as a production API base and Axios uses credentials. The compiled bundle contains the same-origin base and also retains a literal development localhost fallback from the resolver function. A string search alone does not establish an active localhost request. Actual browser network behavior still requires verification after DNS convergence. No rebuild was necessary for the WWW correction.

## Phase B: changes actually completed

Changes were bound to the discovered configurations with SHA-256 guards, backed up before editing, validated, and reloaded gracefully. The operation contained an automatic rollback path for failed syntax/reload/regression checks. All checks passed, so rollback was not exercised.

Server backup: **`/var/backups/acadex/apache-20261014T073105Z`**. The directory is root-owned with mode `0700`; saved configuration files and the enabled-site inventory use mode `0600`. No certificate private-key contents were copied or displayed.

| File | Actual change |
| --- | --- |
| `/etc/apache2/sites-available/acadex-www.conf` | Created and enabled a separate `*:443` host for `www.veload.site` using its existing certificate; permanent redirect to `https://veload.site/` preserves path and query |
| `/etc/apache2/sites-available/acadex-http.conf` | Added `www.veload.site` as an alias, retained the ACME challenge exception and canonical HTTPS redirect, added dedicated logs |
| `/etc/apache2/sites-available/000-default.conf` | Replaced the default page with deny-only HTTP and HTTPS hosts for unconfigured names; the HTTPS default uses the existing root certificate |

The root application virtual host, backend/private virtual hosts, private environment, database, APP_KEY, frontend build and certificate lineages were not modified.

## HTTP and TLS evidence before and after the change

Tests used certificate verification throughout. Local EC2 probes resolved the requested hostname to `127.0.0.1`. Windows direct-AWS probes used `curl --resolve` only where explicitly indicated. Normal public requests used ordinary DNS and no host-resolver override.

| Request / test | Status | Current result |
| --- | --- | --- |
| Normal `http://veload.site/` | PASSED | 301 to `https://veload.site/`, AWS IP |
| Normal root HTTPS, `/login`, `/register` | PASSED for HTTP serving | 200, AWS IP, expected bundle; rendered UI acceptance **NOT RUN** |
| `/sanctum/csrf-cookie` | PASSED | 204 through Laravel |
| `/api/v1/csrf-token` | PASSED | 200 JSON with a token present; token not logged |
| Anonymous `/api/v1/user` | PASSED | JSON 401, no exception internals |
| Missing API route | PASSED | JSON 404 |
| Empty login POST without CSRF | PASSED | 419, no exception internals; no real login attempt made |
| AWS HTTPS `www` before change | FAILED | Curl exit 60: hostname/certificate mismatch |
| AWS HTTPS `www` after change | PASSED | Valid TLS and 301 to the root, preserving `/login?deployment_probe=20261014` |
| AWS HTTP `www` after change | PASSED | 301 directly to canonical HTTPS, preserving path/query |
| Encoded WWW path/query | PASSED | Redirect preserves `/research%20archive?q=a%26b` |
| Root HTTP challenge file | PASSED | 200 without redirect, synthetic content verified |
| AWS WWW HTTP challenge file | PASSED | 200 without redirect; forced AWS resolution pending public DNS change |
| Unknown public HTTP host / direct IP | PASSED | 403 from the deny-only default host |
| Normal public `https://www.veload.site/` | FAILED | Still Vercel HTTP 200 with obsolete `index-BR7jTEXU.js` |

The owned synthetic challenge marker was removed after verification. The challenge route remains configured; the probe file is not a permanent endpoint.

Exposure probes for `/.env`, `/.git/config` and `/storage/app/private/` returned the React SPA fallback with HTTP 200, matching the expected bundle. They contained no environment/Git contents or directory listing. These results do not prove that all upload/document routes are protected; guessed authenticated document IDs and role boundaries are still untested on this host. Explicit rejection of sensitive-looking static paths may be considered during hardening.

Laravel session cookies observed in the HTTP responses are Secure, HttpOnly, SameSite=Lax and host-only. The separate XSRF cookie is readable by JavaScript as expected. Cookie values, session identifiers and CSRF values were kept out of evidence files and this report.

## ACTION REQUIRED FROM USER: Hostinger WWW DNS edit

1. Open **https://hpanel.hostinger.com/** and sign in privately.
2. Open **Domains → Domain portfolio → Manage** beside `veload.site`, then **DNS / Nameservers → DNS records**. If the dashboard uses a shorter Domains list, open the same domain's Manage page.
3. Find the existing **CNAME** whose **Name** is **`www`** and whose **Points to / Target** is **`770b275af54aad50.vercel-dns-017.com`**.
4. Choose **Edit**. Keep **Type = CNAME** and **Name = www**. Change only **Points to / Target = `veload.site`**. Keep **TTL = 300 seconds** if offered; otherwise retain its current TTL. Click **Update / Save**.
5. Preserve the root **A record `@ → 54.153.196.115`**, nameservers, MX/mail/SPF records, `api`, `ftp`, `autoconfig`, `autodiscover`, and other unrelated records. Do not reset the zone, bulk delete, or add a second conflicting WWW record.
6. Reply **`www DNS updated`** after saving. The agent will query both authoritative nameservers and public resolvers; the owner does not need to execute terminal commands or diagnose propagation.

The agent did not edit Hostinger DNS. This pause comes directly from the current user's required owner-action boundary and work order, not from an additional approval requirement. The server correction is complete and reviewable before this action.

Hostinger's current instructions confirm the domain Manage page, DNS / Nameservers controls, and per-record Edit/Update operation: [Hostinger DNS record management](https://www.hostinger.com/support/1583249-how-to-manage-dns-records-at-hostinger/).

## Phase C: HTTPS maintenance status and continuation plan

**Automatic renewal: NEEDS VERIFICATION; transition and renewal dry run NOT RUN.** Certbot 2.9.0 is installed. Both existing certificates are valid until January 11, 2027 UTC, but their manual DNS challenge configuration has no automation hooks. Existing certificates remain in service.

After both public names resolve to AWS, verify fresh synthetic HTTP-01 challenge content through normal public DNS. Back up renewal configuration securely, then use supported `certbot reconfigure` to change each existing lineage to webroot HTTP-01 at `/var/www/letsencrypt`, preserving current certificate paths. If the installed version cannot complete that transition, use a separately named automatically renewable lineage and switch Apache only after successful issuance and checks.

Install a root-owned deployment hook that validates Apache syntax and gracefully reloads it only after successful renewal. Run an actual `certbot renew --dry-run --run-deploy-hooks`, inspect both renewal configurations and the timer, and verify HTTPS afterward. Do not delete the existing manual lineages or certificate backups merely to make a test summary pass.

Certbot documents staging validation before saving `reconfigure` options, the webroot challenge path, and deployment hooks: [Certbot user guide](https://eff-certbot.readthedocs.io/en/stable/using.html).

## Authentication, SMTP, OCR and application acceptance

| Workflow / requirement | Current status and boundary |
| --- | --- |
| Landing, registration and login pages | HTTP serving PASSED; rendered desktop/mobile behavior NOT RUN |
| Verification email sending and code validation | NOT RUN in this checkpoint; requires owner-controlled synthetic recipient and email ownership action |
| Verified-email registration | NOT RUN; no synthetic accounts created |
| Administrator login and dashboard | Historical handoff reports success; current authenticated browser test NOT RUN; no admin credential requested or used |
| Session persistence after refresh and logout | NOT RUN on this deployment in this checkpoint |
| Forgot-password flow | NOT RUN; requires authorized synthetic recipient and secure owner action |
| Role protection and user management | Anonymous protected-route denial PASSED; authenticated role matrix and management workflows NOT RUN |
| Synthetic capstone upload, PDF validation and database persistence | NOT RUN; no capstone records created |
| OCR | Service health PASSED; fresh recognition, full PDF workflow, Laravel upload connector and resource/load tests NOT RUN |
| File permissions, encryption and protected document access | Persistent path inspection PASSED; actual PHP temp creation and document access matrix NEEDS VERIFICATION |
| Generic API errors / missing CSRF | PASSED for the specific 401, 404 and 419 responses checked |
| Mobile responsiveness, console and network errors | NOT RUN; no screenshot or rendered-browser claim made |
| SMTP | Effective Gmail SMTP configuration is present on port 465; historical handoff says delivery succeeded; fresh delivery/workflow acceptance NOT RUN |

The user's browser-control fallback is reserved for actions that the available tools cannot safely perform. Future credential entry, CAPTCHA/MFA and email ownership checks remain owner actions. No mail was sent to any recipient in this checkpoint.

## Security findings and pending review

| Finding / lead | Priority / current disposition |
| --- | --- |
| WWW serves obsolete external deployment | High release blocker; AWS correction PASSED, owner DNS correction pending |
| Manual certificates cannot renew unattended | High operational blocker; valid now, transition and dry run pending |
| Admin password appeared in earlier screenshot | High credential exposure reported by owner; rotation through a secure account workflow required before unrestricted use; no credential displayed/generated |
| Empty trusted-proxy configuration | Deployment correctness/security lead; verify HTTPS scheme and explicit loopback trust before accepting authentication/reset flows |
| Private-temp ownership/mode | Upload reliability/security lead; inspect effective path and PHP ability to enforce private modes before upload acceptance |
| OCR dependency advisories | NEEDS VERIFICATION: prior reports identify PaddlePaddle 2.6.2, imgaug 0.4.0 and setuptools 80.10.2; live advisory inventory, severity and upload-reachable attack paths not yet assessed |
| Public document authorization, upload validation, SSRF/native parsing and unsafe test endpoints | Source review and target synthetic negative tests pending; a homepage pass cannot establish these properties |
| Host ingress / SSH restrictions | NEEDS VERIFICATION against actual AWS security groups; no port changes authorized or made |
| Security headers | `nosniff` and Referrer-Policy present on the root; HSTS, framing policy and CSP need compatibility review before changes |
| Backups and logs | Existing backup files use 0600; Laravel uses daily logging; retention/alerts, sensitive-log content and complete restore protection pending |

No uncontrolled OCR dependency upgrade, wildcard credentialed CORS, CSRF bypass, SSL-verification bypass or authentication weakening was performed. Current debug mode is disabled; private services are loopback-bound. This is preliminary deployment inspection, not a completed comprehensive security audit.

## Reliability, database and backups

The database gzip backup at `/var/backups/acadex/prelaunch.sql.gz` passed a full streamed gzip integrity/CRC check. The private environment backup at `/var/backups/acadex/laravel.env` is byte-identical to the current private environment; neither content nor a secret-derived fingerprint was displayed. Both files are root-owned mode `0600`.

**Restore readiness: NOT RUN.** Gzip integrity does not prove a valid, complete, current or restorable SQL backup. Creation/deletion of a disposable restore database requires the owner's explicit approval before execution. No restore or database creation/deletion occurred.

**Disaster recovery: NOT READY.** These backups are on the same instance. No independent encrypted off-server destination, tested coordinated DB/private-files/APP_KEY restore, retention policy or recovery objective has been approved or verified. No backup was removed or exported.

Apache, PHP-FPM, MySQL and OCR are enabled at boot. OCR currently uses one service process, binds to loopback, has approximately 1,100 MiB memory and 768 MiB swap ceilings, and showed approximately 455 MiB current service memory at discovery. The machine has limited headroom; no heavy build, extra worker, load test, service restart/reboot or resize was performed. Availability under representative OCR load, graceful restart and model-cache survival still need acceptance.

## AWS access and cost considerations

Instance identity, type, architecture, region and public IPv4 were verified through IMDSv2 with the metadata token kept in memory. Elastic IP allocation details, attached security groups, inbound administrative IP restrictions, EBS type/attributes, additional resources, billing plan and promotional credit balance require authenticated AWS control-plane inspection or a precise owner Console step later.

No new AWS resource, paid service, billing-plan change, resize or account modification was made. Credit eligibility and balance are unverified; no indefinitely free hosting claim is made. Running-instance, storage, public-address and traffic costs must be checked against the actual account and current AWS pricing before giving a cost estimate.

## Rollback procedure for this Apache checkpoint

This procedure restores only the October 14 WWW/default-host change. It is a prepared path, **not an executed rollback test**. Before using it, check for later configuration edits and coordinate DNS state. If later changes exist, review their diff first rather than copying old files blindly.

Ubuntu SSH commands, conditional on a justified rollback:

```bash
sudo a2dissite acadex-www.conf
sudo install -m 0644 /var/backups/acadex/apache-20261014T073105Z/000-default.conf /etc/apache2/sites-available/000-default.conf
sudo install -m 0644 /var/backups/acadex/apache-20261014T073105Z/acadex-http.conf /etc/apache2/sites-available/acadex-http.conf
sudo apache2ctl configtest
# Reload only if the preceding check reports Syntax OK:
sudo systemctl reload apache2
```

Repeat root HTTPS, root HTTP redirect, Sanctum and anonymous API checks. The available WWW config can remain disabled for review; no certificate or backup deletion is needed. This rollback leaves the application, APP_KEY, database, storage, certificates and build untouched. A DNS rollback, if necessary, is a separate explicit owner action; it would again send WWW visitors to the obsolete deployment.

## Commands, evidence and next checkpoint

Actually executed read-only commands include verified SSH, `apache2ctl -S`, `apache2ctl configtest`, `certbot certificates`, `certbot --version`, selected `systemctl show`, `ss -lntp`, `free -m`, `df -h /`, `ufw status verbose`, `php artisan acadex:check-production`, `php artisan migrate:status`, aggregate Laravel database reads, certificate SAN/date inspection with `openssl x509`, DNS queries to both authorities/two public resolvers, gzip integrity streaming, and HTTP probes with TLS verification.

Actually executed mutations are the three scoped Apache configuration writes, `a2ensite acadex-www.conf`, graceful Apache reload, configuration backups, creation/removal of one owned synthetic challenge marker, and the requested local report/ignored diagnostic scripts. Ordinary HTTP session initialization may create session rows; no account, capstone or application-data fixture was written.

Sanitized evidence and reproducible local scripts are in `.local/aws-finalization/`:

- `discovery-server.json`, `discovery-application.json`, `integrity-server.json`
- `dns-before-owner-change.json`, `http-before.json`, `http-after.json`
- `apache-change.json`, `checkpoint-server.json`
- `ssh_script.py`, `discover_server.py`, `discover_application.php`, `inspect_integrity.py`, `probe_http.py`, `prepare_www.py`, `configure_www.py`, `configure_www_ready.py`, `finalize_checkpoint.py`

`configure_www_ready.py` is bound to the original discovered config hashes and refuses a repeat against changed configurations. Do not rerun it as a generic deployment command. The evidence contains no raw environment contents, credentials, cookie values, verification codes, private keys, database rows or SQL dump contents.

After the owner replies `www DNS updated`: verify authoritative/public DNS and ordinary HTTPS WWW redirect; complete supported Certbot webroot transition and actual dry run; fix/verify proxy and private-temp configuration; proceed through the authorized application/browser, security, reliability and AWS checks. Stop only at specific owner-required email/credential/Console actions or approvals for database restore/spending/material downtime. Update this report with original failures and corrected retests as work continues.

**Current stop condition: waiting for the owner to update the existing WWW CNAME. No background task is left running.**
