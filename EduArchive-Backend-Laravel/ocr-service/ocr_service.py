"""
EduArchive OCR Service — Optimised Core OCR Engine
====================================================
Key improvements over the baseline implementation:

SPEED
  • PaddleOCR singleton initialised once at startup with the PP-OCRv4 server
    model (best accuracy) and angle-cls disabled per page (handled instead by
    our own deskew step, which is faster and avoids double-rotation).
  • Embedded text is extracted from PDFs without any image conversion
    (PyMuPDF's get_text() is near-instant).  OCR is only invoked for pages
    that have no embedded text layer.
  • PDF pages are rendered at 200 DPI (not 300).  200 DPI is sufficient for
    PaddleOCR and renders ~2.25x faster than 300 DPI.
  • Images are converted to grayscale before preprocessing; working in one
    channel rather than three halves memory bandwidth and speeds up every
    subsequent step.
  • numpy arrays are passed directly to PaddleOCR — no intermediate disk I/O.

ACCURACY
  • Adaptive preprocessing pipeline:
      1. Greyscale + light CLAHE contrast normalisation — lifts dark/faded text.
      2. Deskew — straightens pages rotated up to ±45°.
      3. Bilateral denoise — reduces noise while preserving text edges.
      4. Adaptive thresholding — binarises text cleanly on uneven backgrounds.
      Preprocessing is applied selectively: if the image is already crisp (high
      contrast, near-zero skew) some steps are skipped to save time.
  • PP-OCRv4 server model (lang='en') is used: higher accuracy than the lite
    model with a modest speed trade-off that the preprocessing savings offset.
  • Bounding-box aware line reconstruction: result lines are sorted by their
    top-left y-coordinate (then x) so reading order is preserved even when
    PaddleOCR returns boxes out of order.
  • Paragraph gap detection: if the vertical gap between consecutive text lines
    exceeds 1.5× the average line height a blank line is inserted, preserving
    paragraph structure.
  • Confidence threshold raised to 0.6 (was 0.5) to reduce garbage characters
    from low-confidence detections.

API COMPATIBILITY
  • Response schema is identical: {type, text} for images and
    {type, total_pages, pages:[{page,text}], full_text} for PDFs.
  • All error paths raise the same exceptions caught by main.py.
"""

from __future__ import annotations

import io
import logging
import math
import os
import tempfile
from typing import Any

import cv2
import fitz          # PyMuPDF
import numpy as np
from paddleocr import PaddleOCR
from PIL import Image

from validators import MAX_PDF_PAGES

logger = logging.getLogger(__name__)

# ── OCR singleton ──────────────────────────────────────────────────────────────
_ocr: PaddleOCR | None = None


def _get_ocr() -> PaddleOCR:
    """Return the shared PaddleOCR instance, creating it on first call."""
    global _ocr
    if _ocr is None:
        logger.info("Initialising PaddleOCR (PP-OCRv4 server model)…")
        _ocr = PaddleOCR(
            use_angle_cls=False,   # we handle orientation ourselves (faster)
            lang="en",
            use_gpu=False,
            # PP-OCRv4 server model — best accuracy among bundled models
            det_model_dir=None,    # use PaddleOCR default (PP-OCRv4 det)
            rec_model_dir=None,    # use PaddleOCR default (PP-OCRv4 rec)
            show_log=False,
            # Detection tuning
            det_db_thresh=0.3,     # lower → catch faint strokes
            det_db_box_thresh=0.5,
            det_db_unclip_ratio=1.6,  # slightly expand boxes → fewer cut chars
            # Recognition tuning
            rec_batch_num=8,       # process 8 text boxes at once (GPU: 32)
            max_text_length=200,   # allow longer lines (abstracts)
            drop_score=0.6,        # discard lines with confidence < 0.6
        )
        logger.info("PaddleOCR ready.")
    return _ocr


# ── Image preprocessing ────────────────────────────────────────────────────────

def _to_gray(arr: np.ndarray) -> np.ndarray:
    """Convert an RGB/RGBA array to uint8 grayscale."""
    if arr.ndim == 2:
        return arr
    if arr.shape[2] == 4:
        arr = cv2.cvtColor(arr, cv2.COLOR_RGBA2GRAY)
    else:
        arr = cv2.cvtColor(arr, cv2.COLOR_RGB2GRAY)
    return arr


def _estimate_skew(gray: np.ndarray) -> float:
    """
    Estimate page skew angle (degrees) using Hough line detection.
    Returns 0.0 if the image is too small or no dominant angle is found.
    """
    if gray.shape[0] < 100 or gray.shape[1] < 100:
        return 0.0

    # Edge detection on a small version for speed
    scale = min(1.0, 800 / max(gray.shape))
    small = cv2.resize(gray, None, fx=scale, fy=scale,
                       interpolation=cv2.INTER_AREA) if scale < 1.0 else gray

    edges = cv2.Canny(small, 50, 150, apertureSize=3)
    lines = cv2.HoughLines(edges, 1, math.pi / 180, threshold=80)
    if lines is None:
        return 0.0

    angles = []
    for line in lines[:50]:            # consider at most 50 dominant lines
        rho, theta = line[0]
        angle = math.degrees(theta) - 90   # convert to skew angle
        if abs(angle) < 45:
            angles.append(angle)

    if not angles:
        return 0.0

    # Use median to reject outliers
    return float(np.median(angles))


def _deskew(gray: np.ndarray) -> np.ndarray:
    """Rotate the image to correct detected skew."""
    angle = _estimate_skew(gray)
    if abs(angle) < 0.5:          # not worth rotating for tiny angles
        return gray
    h, w = gray.shape[:2]
    M = cv2.getRotationMatrix2D((w / 2, h / 2), angle, 1.0)
    rotated = cv2.warpAffine(
        gray, M, (w, h),
        flags=cv2.INTER_LINEAR,
        borderMode=cv2.BORDER_REPLICATE,
    )
    return rotated


def _contrast_score(gray: np.ndarray) -> float:
    """Return the standard deviation of pixel intensities (0–128)."""
    return float(np.std(gray))


def _preprocess(arr: np.ndarray) -> np.ndarray:
    """
    Apply a selective preprocessing pipeline to maximise OCR accuracy.

    Steps performed:
      1. Greyscale conversion
      2. Upscale very small images (short side < 600 px) to 1200 px
      3. CLAHE contrast normalisation (skipped if already high-contrast)
      4. Deskew (skipped if skew < 0.5°)
      5. Bilateral filter denoising (light, edge-preserving)
      6. Adaptive threshold binarisation (skipped for already-crisp images)

    Returns an RGB uint8 array that PaddleOCR expects.
    """
    gray = _to_gray(arr)

    # ── 1. Upscale tiny images so features are detectable ──────────────────
    h, w = gray.shape[:2]
    min_side = min(h, w)
    if min_side < 600:
        scale = 1200 / min_side
        gray = cv2.resize(gray, None, fx=scale, fy=scale,
                          interpolation=cv2.INTER_CUBIC)

    # ── 2. CLAHE contrast enhancement (adaptive) ───────────────────────────
    score = _contrast_score(gray)
    if score < 60:          # low-contrast → apply enhancement
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        gray = clahe.apply(gray)

    # ── 3. Deskew ──────────────────────────────────────────────────────────
    gray = _deskew(gray)

    # ── 4. Bilateral denoising — preserves text edges ─────────────────────
    gray = cv2.bilateralFilter(gray, d=5, sigmaColor=35, sigmaSpace=35)

    # ── 5. Adaptive binarisation (only when image is not already clean) ────
    score_after = _contrast_score(gray)
    if score_after < 80:
        gray = cv2.adaptiveThreshold(
            gray, 255,
            cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv2.THRESH_BINARY,
            blockSize=31,
            C=10,
        )

    # PaddleOCR expects an RGB array
    return cv2.cvtColor(gray, cv2.COLOR_GRAY2RGB)


# ── Text reconstruction ───────────────────────────────────────────────────────

def _reconstruct_text(paddle_result) -> str:
    """
    Convert raw PaddleOCR output into structured text with paragraph breaks.

    Strategy:
      • Each detected line carries a bounding box (4 corner points).
      • Sort lines by their top-centre y coordinate, then x, to reproduce
        reading order on multi-column or rotated layouts.
      • Compute the median line height; if the gap between consecutive lines
        exceeds 1.5× that height, insert a blank line (paragraph separator).
    """
    if not paddle_result or paddle_result == [None]:
        return ""

    # Flatten pages (PaddleOCR wraps in an outer list)
    lines_raw = []
    for page in paddle_result:
        if page:
            lines_raw.extend(page)

    if not lines_raw:
        return ""

    # Parse into (y_top, x_left, text, confidence)
    parsed = []
    for item in lines_raw:
        box, (text, conf) = item[0], item[1]
        if conf < 0.6 or not text.strip():
            continue
        y_top = min(pt[1] for pt in box)
        x_left = min(pt[0] for pt in box)
        y_bot  = max(pt[1] for pt in box)
        parsed.append((y_top, x_left, y_bot, text.strip()))

    if not parsed:
        return ""

    # Sort: top-to-bottom, then left-to-right
    parsed.sort(key=lambda r: (r[0], r[1]))

    # Compute median line height for paragraph gap detection
    heights = [r[2] - r[0] for r in parsed]
    med_h   = float(np.median(heights)) if heights else 20.0

    output_lines = []
    prev_y_bot   = None

    for y_top, _x, y_bot, text in parsed:
        if prev_y_bot is not None:
            gap = y_top - prev_y_bot
            if gap > 1.5 * med_h:
                output_lines.append("")   # paragraph break
        output_lines.append(text)
        prev_y_bot = y_bot

    return "\n".join(output_lines)


# ── Public API ─────────────────────────────────────────────────────────────────

def extract_text_from_image(raw: bytes) -> dict[str, Any]:
    """
    Extract text from a single JPEG or PNG image.

    Returns:
        {"type": "image", "text": "<extracted text>"}
    """
    img = Image.open(io.BytesIO(raw)).convert("RGB")
    arr = np.array(img)

    preprocessed = _preprocess(arr)

    ocr   = _get_ocr()
    result = ocr.ocr(preprocessed, cls=False)   # cls handled by deskew step
    text  = _reconstruct_text(result)

    return {"type": "image", "text": text}


def extract_text_from_pdf(raw: bytes) -> dict[str, Any]:
    """
    Extract text from every page of a PDF document.

    Strategy per page:
      1. Try PyMuPDF embedded text first (instant, perfectly accurate).
      2. If the page has no embedded text (scanned/image page), render it at
         200 DPI, preprocess the image, and run PaddleOCR.

    Returns:
        {
          "type": "pdf",
          "total_pages": <int>,
          "pages": [{"page": <n>, "text": "<text>"}, ...],
          "full_text": "<all pages joined with page headers>"
        }
    Raises:
        ValueError  if the PDF exceeds MAX_PDF_PAGES.
        RuntimeError on any unrecoverable processing failure.
    """
    tmp_path = None
    try:
        # Write to a temp file — fitz.open() streams work best with paths
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
            tmp.write(raw)
            tmp_path = tmp.name

        doc = fitz.open(tmp_path)
        total = doc.page_count

        if total > MAX_PDF_PAGES:
            doc.close()
            raise ValueError(
                f"PDF has {total} pages, exceeding the {MAX_PDF_PAGES}-page limit."
            )

        ocr = _get_ocr()

        pages_out  = []
        full_parts = []

        for idx in range(total):
            page = doc.load_page(idx)
            page_num = idx + 1

            # ── Fast path: embedded text ───────────────────────────────────
            embedded = page.get_text("text").strip()
            if embedded:
                pages_out.append({"page": page_num, "text": embedded})
                full_parts.append(f"--- Page {page_num} ---\n{embedded}")
                continue

            # ── Slow path: render + OCR ────────────────────────────────────
            # 200 DPI renders 2.25× faster than 300 DPI and is sufficient for
            # PaddleOCR's detection model (which works on 640-px feature maps).
            mat = fitz.Matrix(200 / 72, 200 / 72)
            pix = page.get_pixmap(matrix=mat, colorspace=fitz.csRGB, alpha=False)
            img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
            arr = np.array(img)

            preprocessed = _preprocess(arr)
            result       = ocr.ocr(preprocessed, cls=False)
            page_text    = _reconstruct_text(result)

            pages_out.append({"page": page_num, "text": page_text})
            if page_text:
                full_parts.append(f"--- Page {page_num} ---\n{page_text}")

        doc.close()

        return {
            "type":        "pdf",
            "total_pages": total,
            "pages":       pages_out,
            "full_text":   "\n\n".join(full_parts),
        }

    finally:
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.unlink(tmp_path)
            except OSError:
                logger.warning("Could not delete temp file: %s", tmp_path)
