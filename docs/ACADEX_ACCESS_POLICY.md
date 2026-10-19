# AcadeX document access policy

Implementation policy approved by the project owner on October 13, 2026, pending confirmation by the university's authorized representative. This is the acceptance contract for the remediation; it does not authorize public deployment.

| Role | Record/document access | Downloads | Record mutation |
| --- | --- | --- | --- |
| Administrator | All records, including archived/rejected/unpublished; all attachments | Allowed | All management/review operations |
| Faculty | Own unarchived uploads; unarchived student submissions assigned to them as adviser; approved, published, unarchived records | Allowed only for records they may view | Own uploads; assigned student submissions may be approved/rejected, not edited/deleted merely because of assignment |
| Student | Own unarchived submissions, including pending/rejected/unpublished; approved, published, unarchived records | Denied, preserving the existing student download rule | Own uploads; edits return submissions to pending/unpublished; no self-approval/publication |
| Visitor | Approved, published, unarchived records only | Denied | No document mutation; permitted bookmarks/view tracking require the same read access |

IMRAD and resources inherit the parent document boundary. Copyright classification or an IMRAD never grants access to an unpublished document. Document tokens cannot enlarge access. Unknown actors, inconsistent approval/publication state, unassigned reviewers, guessed IDs and private references are denied.

Nonpreviewable resource formats (Office documents, archives and unknown types) require download permission even on a preview route because the browser may automatically download them. Authorized preview bytes can still be saved by a browser; application permissions are not DRM.

Owners retain their existing archive listing, delete and restore workflow. Archived file viewing is administrator-only; restoration leaves the document unpublished and does not grant approval. A rejected student submission must be restored and reviewed through the established approval process.

`CapstoneAccess` defines both predicates and query restrictions. `CapstonePolicy` enforces record actions. A request-bound Eloquent scope protects API queries, implicit route binding, references, filtering and chatbot results. Explicit bypasses exist only for the owner/admin archive-management workflow and trusted CLI maintenance. Raw chatbot aggregate queries also restrict their input population. Account-activity information remains administrator-only.

Full extracted PDF text and real storage paths are never response fields. Author contact details are limited to the administrator, owner and assigned student adviser. Upload APIs return opaque, owner/purpose-bound staged references; existing attachment retention uses references bound to the same parent record.

There is no general faculty reviewer override or exceptional student grant. Additional authorized-reviewer assignments or university exceptions require a defined, audited institutional workflow and a separate implementation. Do not introduce a broad role exception.
