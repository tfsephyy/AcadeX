"""
EduArchive OCR Service — FastAPI Application Entry Point
=========================================================
Runs on port 8001 alongside Laravel (8000) and Vite (5173).
The OCR engine is warmed up at startup so the first real request is fast.
All endpoints, request formats, and response schemas are preserved.
"""

import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, File, HTTPException, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from ocr_service import _get_ocr, extract_text_from_image, extract_text_from_pdf
from validators import ALLOWED_EXTENSIONS, validate_file

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s — %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)


# ── Lifespan: pre-load model weights once at startup ─────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Warming up PaddleOCR engine (PP-OCRv4 server model)…")
    _get_ocr()          # downloads/loads model weights — subsequent calls are instant
    logger.info("OCR engine ready — accepting requests.")
    yield
    logger.info("OCR service shutting down.")


# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="EduArchive OCR Service",
    description=(
        "Extracts text from images (JPG, PNG) and PDFs using PaddleOCR PP-OCRv4. "
        "Features adaptive preprocessing, deskewing, paragraph detection, and "
        "bounding-box sorted reading order."
    ),
    version="2.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url=None,
)

# CORS — allow the React dev server and Laravel API server (local only)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


# ── Health endpoints ──────────────────────────────────────────────────────────

@app.get("/", include_in_schema=False)
async def root():
    return {"service": "EduArchive OCR", "version": "2.0.0", "status": "running"}


@app.get("/health", tags=["Health"])
async def health():
    """Liveness check — returns 200 when the service is ready."""
    return {"status": "ok"}


# ── OCR endpoint ──────────────────────────────────────────────────────────────

@app.post(
    "/api/ocr",
    tags=["OCR"],
    summary="Extract text from an image or PDF",
    status_code=status.HTTP_200_OK,
)
async def run_ocr(file: UploadFile = File(...)):
    """
    Upload a JPG, JPEG, PNG, or PDF file and receive extracted text as JSON.

    **Image response**
    ```json
    { "type": "image", "text": "..." }
    ```

    **PDF response**
    ```json
    {
        "type": "pdf",
        "total_pages": 3,
        "pages": [
            {"page": 1, "text": "..."},
            {"page": 2, "text": "..."},
            {"page": 3, "text": "..."}
        ],
        "full_text": "--- Page 1 ---\\n...\\n\\n--- Page 2 ---\\n..."
    }
    ```
    """
    # 1. Read upload
    try:
        content = await file.read()
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not read the uploaded file.",
        )

    # 2. Validate
    filename = file.filename or ""
    ok, err = validate_file(filename, content)
    if not ok:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=err,
        )

    # 3. Route to extractor
    ext = os.path.splitext(filename)[1].lower()
    try:
        if ext == ".pdf":
            result = extract_text_from_pdf(content)
        else:
            result = extract_text_from_image(content)

    except ValueError as exc:
        # e.g. PDF page-count limit exceeded
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        )
    except Exception:
        logger.exception("OCR processing failed for file: %s", filename)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="OCR processing failed. Please try again with a clearer image.",
        )

    return JSONResponse(content=result)


# ── Entry point ───────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8001,
        reload=True,
        log_level="info",
    )
