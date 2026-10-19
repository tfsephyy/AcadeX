# AcadeX document access policy

Implementation policy approved by the project owner on October 13, 2026, amended October 19, 2026 after the client clarified approval and visitor requirements. This is the acceptance contract for the remediation; it does not authorize public deployment.

**October 19 amendment:** `approval_status` controls the approved platform library. `publication_status` is the separate external-publication flag used for visitor full-document access. Authenticated visitor accounts may now see approved, unarchived records that have an IMRAD document even when they are unpublished or not copyright-cleared, but only the IMRAD/metadata; the complete PDF remains restricted. Copyright classification or an IMRAD never bypasses approval. These rules supersede the October 13 visitor row and the statement that IMRAD never grants any visitor access.

| Role | Record/document access | Downloads | Record mutation |
| --- | --- | --- | --- |
| Administrator | All records, including archived/rejected/unpublished; all attachments | Allowed | All management/review operations |
| Faculty | Own unarchived uploads; unarchived student submissions assigned to them as adviser; approved, unarchived records | Allowed only for records they may view | Own uploads; assigned student submissions may be approved/rejected, not edited/deleted merely because of assignment |
| Student | Own unarchived submissions, including pending/rejected/unpublished; approved, unarchived records | Denied, preserving the existing student download rule | Own uploads; edits return submissions to pending/unpublished; no self-approval/publication |
| Visitor (authenticated visitor accounts) | Approved, unarchived records that are published, copyright-cleared, or have an IMRAD document. Full PDF/resources only for published or copyright-cleared records; IMRAD-only records expose metadata and IMRAD only. Other approved records are not visitor-visible | Denied | No document mutation; permitted bookmarks/view tracking require the same read access |

IMRAD and resources inherit the parent document boundary. For an IMRAD-only visitor record, the complete PDF and resources are denied; the IMRAD document and permitted metadata remain available. Document tokens cannot enlarge access. Unknown actors, inconsistent approval/publication state, unassigned reviewers, guessed IDs and private references are denied.

Nonpreviewable resource formats (Office documents, archives and unknown types) require download permission even on a preview route because the browser may automatically download them. Authorized preview bytes can still be saved by a browser; application permissions are not DRM.

Owners retain their existing archive listing, delete and restore workflow. Archived file viewing is administrator-only; restoration leaves the document unpublished and does not grant approval. A rejected student submission must be restored and reviewed through the established approval process.

`CapstoneAccess` defines both predicates and query restrictions. `CapstonePolicy` enforces record actions. A request-bound Eloquent scope protects API queries, implicit route binding, references, filtering and chatbot results. Explicit bypasses exist only for the owner/admin archive-management workflow and trusted CLI maintenance. Raw chatbot aggregate queries also restrict their input population. Account-activity information remains administrator-only.

Full extracted PDF text and real storage paths are never response fields. Author contact details are limited to the administrator, owner and assigned student adviser. Upload APIs return opaque, owner/purpose-bound staged references; existing attachment retention uses references bound to the same parent record.

There is no general faculty reviewer override or exceptional student grant. Additional authorized-reviewer assignments or university exceptions require a defined, audited institutional workflow and a separate implementation. Do not introduce a broad role exception.
