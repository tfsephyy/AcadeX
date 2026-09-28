"""
EduArchive OCR Service — File Validation
Validates uploaded files for extension, size, and magic-byte integrity.
"""

import os

# ── Limits ────────────────────────────────────────────────────────────────────
MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024   # 20 MB
MAX_PDF_PAGES       = 50
ALLOWED_EXTENSIONS  = {".jpg", ".jpeg", ".png", ".pdf"}

# Magic-byte signatures (first 8 bytes)
_SIGNATURES = {
    b"\xff\xd8\xff": "image/jpeg",
    b"\x89PNG\r\n":  "image/png",
    b"%PDF-":        "application/pdf",
}


def _detect_mime(header: bytes) -> str:
    for sig, mime in _SIGNATURES.items():
        if header.startswith(sig):
            return mime
    return "application/octet-stream"


def validate_file(filename: str, content: bytes):
    """
    Validate an uploaded file.

    Returns:
        (True, "")          on success
        (False, error_msg)  on failure
    """
    safe = os.path.basename(filename)
    if not safe:
        return False, "Invalid file name."

    ext = os.path.splitext(safe)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        return False, (
            f"Unsupported file type '{ext}'. "
            "Allowed: JPG, JPEG, PNG, PDF."
        )

    if len(content) == 0:
        return False, "Uploaded file is empty."

    if len(content) > MAX_FILE_SIZE_BYTES:
        mb = MAX_FILE_SIZE_BYTES // (1024 * 1024)
        return False, f"File exceeds the {mb} MB size limit."

    detected = _detect_mime(content[:8])
    if ext in (".jpg", ".jpeg") and detected != "image/jpeg":
        return False, "File content does not match a valid JPEG image."
    if ext == ".png" and detected != "image/png":
        return False, "File content does not match a valid PNG image."
    if ext == ".pdf" and detected != "application/pdf":
        return False, "File content does not match a valid PDF document."

    return True, ""
