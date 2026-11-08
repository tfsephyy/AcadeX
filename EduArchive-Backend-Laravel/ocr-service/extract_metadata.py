"""
EduArchive Standalone Metadata Extractor
========================================
Extracts bibliographical metadata from capstone PDFs (text-based and scanned).
Uses PyMuPDF (fitz) for fast front-matter page slicing and text extraction.
Uses Tesseract OCR for scanned/image pages.
"""

from __future__ import annotations

import io
import json
import os
import re
import sys
from typing import Any

# Ensure UTF-8 output
if sys.stdout.encoding != "utf-8":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

import pymupdf as fitz
from PIL import Image

try:
    import pytesseract
    # Check standard Tesseract paths
    if os.name == "nt":
        for tess_candidate in [
            r"C:\Program Files\Tesseract-OCR\tesseract.exe",
            r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
        ]:
            if os.path.exists(tess_candidate):
                pytesseract.pytesseract.tesseract_cmd = tess_candidate
                break
    HAS_TESSERACT = True
except ImportError:
    HAS_TESSERACT = False

MONTH_PATTERN = r'(?:january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)'

STOP_WORDS_AUTHORS = {
    "university", "mindoro", "bongabong", "college", "department", "bachelor",
    "science", "information", "technology", "computer", "engineering", "campus",
    "faculty", "partial", "fulfillment", "requirements", "degree", "capstone",
    "project", "research", "study", "farming", "relatively", "accessible",
    "profitable", "source", "meat", "income", "trend", "driven", "management",
    "system", "the", "in", "of",
    "adviser", "critic", "representative", "chairperson", "dean", "committee",
    "has", "been", "successfully", "presented", "recommended", "approval", "accepted", "approved"
}

BOILERPLATE_PATTERNS = [
    r'republic\s+of\s+the\s+philippines',
    r'mindoro\s+state\s+university',
    r'victoria,?\s*oriental\s+mindoro',
    r'labasan,?\s*bongabong',
    r'college\s+of\s+computer\s+studies',
    r'bongabong\s+campus',
    r'resilience|integrity|commitment|excellence',
    r'camscanner',
]


def is_boilerplate(line: str) -> bool:
    line_lower = line.strip().lower()
    if not line_lower or len(line_lower) < 2:
        return True
    # Strip leading OCR bullets or symbols like "(i)", "@", "OP.", "fe}", ".&J"
    line_clean = re.sub(r'^[^\w\s]+', '', line_lower).strip()
    line_clean = re.sub(r'^\([a-z0-9]\)\s*', '', line_clean).strip()
    for pat in BOILERPLATE_PATTERNS:
        if re.search(pat, line_clean):
            return True
    return False


def clean_extracted_title(t: str | None) -> str | None:
    if not t:
        return None
    lines = [l.strip() for l in t.splitlines() if l.strip()]
    good_lines = []
    for l in lines:
        if is_boilerplate(l):
            continue
        if re.match(r'^(?:a\s+)?(?:research\s*\/\s*)?capstone\s+project', l, re.IGNORECASE):
            break
        if re.match(r'^presented\s+to', l, re.IGNORECASE):
            break
        if re.match(r'^in\s+partial\s+fulfillment', l, re.IGNORECASE):
            break
        good_lines.append(l)
    t = " ".join(good_lines)
    # Strip leading bullets or OCR junk like "(a)", "#", "*.", "(i)"
    t = re.sub(r'^[^\w\s]+', '', t).strip()
    t = re.sub(r'^\([a-z0-9]\)\s*', '', t, flags=re.IGNORECASE).strip()
    t = re.sub(r'\s+', ' ', t).strip(' "“\'”‘.,')
    return t if len(t) > 5 else None


def normalize_author_name(name: str) -> str:
    name = re.sub(r'[\/\\|"\']+', '', name)
    name = re.sub(r'\s+', ' ', name).strip(' .,')
    # If name is merged like "VANESSAM.VILLAFLOR" -> "VANESSA M. VILLAFLOR"
    name = re.sub(r'([A-Z]{2,})([A-Z]\.)([A-Z]{2,})', r'\1 \2 \3', name)
    name = re.sub(r'([A-Z]{2,})([A-Z]\.)', r'\1 \2', name)
    name = re.sub(r'([A-Z]\.)([A-Z]{2,})', r'\1 \2', name)
    return name


def extract_front_matter_pages(doc: fitz.Document, max_pages: int = 15) -> list[str]:
    pages = []
    num_pages_to_read = min(max_pages, doc.page_count)
    for pno in range(num_pages_to_read):
        page = doc[pno]
        text = page.get_text().strip()
        # If page has sparse text (< 60 chars), run OCR if Tesseract is available
        if len(text) < 60 and HAS_TESSERACT:
            try:
                pix = page.get_pixmap(dpi=150)
                img = Image.open(io.BytesIO(pix.tobytes("png")))
                ocr_text = pytesseract.image_to_string(img).strip()
                if len(ocr_text) > len(text):
                    text = ocr_text
            except Exception:
                pass
        pages.append(text)
    return pages


def extract_metadata_from_pages(pages: list[str], doc: fitz.Document | None = None) -> dict[str, Any]:
    full_text = "\n\n--- PAGE BREAK ---\n\n".join(pages)
    first_page = pages[0] if pages else ""
    front_text = "\n".join(pages[:4])

    title = None
    author = None
    year = None
    date_str = None
    program = None
    abstract = None
    keywords: list[str] = []

    # ──────────────────────────────────────────────────────────
    # 1. TITLE EXTRACTION
    # ──────────────────────────────────────────────────────────
    # Strategy A: Approval sheet (Pages 2-3)
    title_app = None
    m_app = re.search(
        r'(?:entitled|titled)\s+["“\'‘]?(.*?)["”\'’]?\s*,?\s+prepared\s+and\s+submitted\s+by',
        front_text,
        re.IGNORECASE | re.DOTALL,
    )
    if m_app:
        raw_t = m_app.group(1).strip()
        cleaned_t = clean_extracted_title(raw_t)
        if cleaned_t and len(cleaned_t) > 10:
            title_app = cleaned_t

    # Strategy B: First page before presentation anchor
    title_cover = None
    m_cover = re.search(
        r'^(.*?)(?=(?:A\s+(?:Research\s*\/\s*)?Capstone\s+Project|Presented\s+to\s+the\s+Faculty|In\s+Partial\s+Fulfillment))',
        first_page,
        re.IGNORECASE | re.DOTALL,
    )
    if m_cover:
        cleaned_t = clean_extracted_title(m_cover.group(1))
        if cleaned_t and len(cleaned_t) > 10:
            title_cover = cleaned_t

    if title_app and title_cover:
        # Prefer the more complete one if approval sheet lost leading letters due to scan margin
        if len(title_cover) > len(title_app) and title_app[0].islower() and title_cover[0].isupper():
            title = title_cover
        else:
            title = title_app
    else:
        title = title_app or title_cover

    # Strategy C: Longest prominent title block on first page
    if not title:
        lines = [l.strip() for l in first_page.splitlines() if l.strip()]
        candidates = []
        for l in lines:
            if is_boilerplate(l):
                continue
            if re.search(
                r'(?:capstone|presented|faculty|partial|fulfillment|bachelor|submitted|prepared|degree|chapter|introduction)',
                l,
                re.IGNORECASE,
            ):
                continue
            if len(l) > 15:
                candidates.append(l)
        if candidates:
            cand_title = clean_extracted_title(" ".join(candidates[:2]))
            if cand_title and not cand_title.lower().startswith("introduction"):
                title = cand_title

    # ──────────────────────────────────────────────────────────
    # 2. AUTHORS EXTRACTION
    # ──────────────────────────────────────────────────────────
    # Strategy A: Approval sheet
    m_auth_app = re.search(
        r'prepared\s+and\s+submitted\s+(?:by|a)\s+([A-Za-z\s.,\'\/\\\-–—]+?)(?=[,\s\/\\\\]+(?:has|have)\s+been|[,\s\/\\\\]+in\s+partial|\n\s*\n)',
        front_text,
        re.IGNORECASE,
    )
    if m_auth_app:
        raw_authors = m_auth_app.group(1).strip()
        raw_authors = re.sub(r'[\/\\|]+', ' ', raw_authors)
        raw_authors = re.sub(r'\s+', ' ', raw_authors)
        parts = re.split(r',\s*and\s+|,\s*|\s+and\s+', raw_authors, flags=re.IGNORECASE)
        valid_authors = []
        for p in parts:
            p = normalize_author_name(p)
            words = [w.lower() for w in p.split()]
            if 1 < len(words) <= 5 and not any(w in STOP_WORDS_AUTHORS for w in words):
                valid_authors.append(p)
        if valid_authors:
            author = ", ".join(valid_authors)

    # Strategy B: Page 1 "by" / "Prepared by" / "Submitted by"
    if not author:
        lines = first_page.splitlines()
        for idx, line in enumerate(lines):
            t_line = line.strip().lower()
            if t_line in ["by", "by:", "prepared by", "prepared by:", "submitted by", "submitted by:"]:
                valid_authors = []
                for j in range(idx + 1, min(idx + 6, len(lines))):
                    next_l = lines[j].strip()
                    if not next_l:
                        continue
                    if re.search(
                        r'(?:bachelor|in partial|degree|20\d{2}|january|february|march|april|may|june|july|august|september|october|november|december)',
                        next_l,
                        re.IGNORECASE,
                    ):
                        break
                    next_l = normalize_author_name(next_l)
                    words = [w.lower() for w in next_l.split()]
                    if 1 < len(words) <= 5 and not any(w in STOP_WORDS_AUTHORS for w in words):
                        valid_authors.append(next_l)
                if valid_authors:
                    author = ", ".join(valid_authors)
                    break

    # Strategy C: Page 1 lines between Degree and Date
    if not author:
        lines = first_page.splitlines()
        in_degree_zone = False
        valid_authors = []
        for line in lines:
            t_line = line.strip()
            if not t_line:
                continue
            if re.search(r'(?:degree|bachelor\s+of\s+science)', t_line, re.IGNORECASE):
                in_degree_zone = True
                continue
            if in_degree_zone:
                if re.search(r'(?:january|february|march|april|may|june|july|august|september|october|november|december)\s*\d{0,4}|\b20\d{2}\b', t_line, re.IGNORECASE):
                    break
                p = normalize_author_name(t_line)
                words = [w.lower() for w in p.split()]
                if 1 < len(words) <= 5 and not any(w in STOP_WORDS_AUTHORS for w in words):
                    valid_authors.append(p)
        if valid_authors:
            author = ", ".join(valid_authors)

    # ──────────────────────────────────────────────────────────
    # 3. DATE & YEAR EXTRACTION
    # ──────────────────────────────────────────────────────────
    date_regex = re.compile(
        rf'(?:\b|(?<=[a-z]))({MONTH_PATTERN})[,\s]*(20\d{{2}})(?!\d)',
        re.IGNORECASE,
    )
    for p in pages[:4]:
        m_date = date_regex.search(p)
        if m_date:
            date_str = f"{m_date.group(1).capitalize()} {m_date.group(2)}"
            year = int(m_date.group(2))
            break

    if not year:
        # Fallback to standalone year
        year_regex = re.compile(r'(?<!\d)(20[12]\d)(?!\d)')
        for p in pages[:4]:
            lines = [l.strip() for l in p.splitlines() if l.strip()]
            for l in reversed(lines):
                # Don't pick numbers from phone/zip/course codes
                if re.search(r'(?:5205|iso|iec|tel|contact)', l, re.IGNORECASE):
                    continue
                m_yr = year_regex.search(l)
                if m_yr:
                    year = int(m_yr.group(1))
                    break
            if year:
                break

    # ──────────────────────────────────────────────────────────
    # 4. PROGRAM EXTRACTION
    # ──────────────────────────────────────────────────────────
    if re.search(
        r'\b(BS\s*IT|B\.?S\.?\s*I\.?T\.?|Bachelor\s+of\s+Science\s+in\s+Information\s+Technology)\b',
        full_text,
        re.IGNORECASE,
    ):
        program = "BSIT"
    elif re.search(
        r'\b(BS\s*CpE|B\.?S\.?\s*Cp\.?E\.?|Bachelor\s+of\s+Science\s+in\s+Computer\s+Engineering)\b',
        full_text,
        re.IGNORECASE,
    ):
        program = "BSCpE"

    # ──────────────────────────────────────────────────────────
    # 5. ABSTRACT / EXECUTIVE SUMMARY EXTRACTION
    # ──────────────────────────────────────────────────────────
    end_markers = (
        r'(?:TABLE\s+OF\s+CONTENTS|ACKNOWLEDGEMENTS?|ACKNOWLEDGMENT|'
        r'LIST\s+OF\s+(?:TABLES|FIGURES|APPENDICES)|CHAPTER\s+[I1V]|1\.0\s+INTRODUCTION|KEYWORDS?\s*:|$)'
    )
    m_abs = re.search(
        r'(?:EXECUTIVE\s+SUMMARY|ABSTRACT)[^\n]*\n(.*?)(?=' + end_markers + ')',
        full_text,
        re.IGNORECASE | re.DOTALL,
    )
    if m_abs:
        raw_abs = m_abs.group(1)
        abs_lines = []
        for l in raw_abs.splitlines():
            l_str = l.strip()
            if not l_str:
                abs_lines.append("")
                continue
            if is_boilerplate(l_str):
                continue
            # Drop standalone page numbers (digits or roman numerals)
            if re.match(r'^\s*(?:[\divxlc\-_.]+|page\s+\d+)\s*$', l_str, re.IGNORECASE):
                continue
            # Drop heading-like short all-caps lines
            if re.match(r'^[A-Z\s]{3,40}$', l_str) and len(l_str.split()) <= 4:
                continue
            abs_lines.append(l_str)

        paras = []
        cur_para: list[str] = []
        for l in abs_lines:
            if not l:
                if cur_para:
                    paras.append(" ".join(cur_para))
                    cur_para = []
            else:
                cur_para.append(l)
        if cur_para:
            paras.append(" ".join(cur_para))

        clean_paras = []
        for p in paras:
            # Rejoin hyphenated line wraps (e.g. "time- consuming" or "infor- mation")
            p = re.sub(r'([a-zA-Z])-\s+([a-zA-Z])', r'\1\2', p)
            # Remove space before punctuation
            p = re.sub(r'\s+([.,;:!?])', r'\1', p)
            # Add missing space after punctuation when followed by capital letter
            p = re.sub(r'([.!?])([A-Z][a-z])', r'\1 \2', p)
            p = re.sub(r'\s+', ' ', p).strip()
            if len(p) > 20:
                clean_paras.append(p)

        if clean_paras:
            abstract = "\n\n".join(clean_paras)

    # ──────────────────────────────────────────────────────────
    # 6. KEYWORDS
    # ──────────────────────────────────────────────────────────
    m_kw = re.search(
        r'\b(?:key\s*words?|index\s+terms?)\s*[:—–]\s*(.*?)(?:[\r\n]{2,}|\b(?:chapter|introduction)\b|$)',
        full_text,
        re.IGNORECASE,
    )
    if m_kw:
        kw_raw = m_kw.group(1).strip()
        for item in re.split(r'[,;|\n]', kw_raw):
            item = re.sub(r'\s+', ' ', item).strip(' .')
            # Avoid code or exif artifacts like "$meta"
            if 2 < len(item) < 60 and not is_boilerplate(item) and not item.startswith(('$', '{', '/*')):
                keywords.append(item.lower())

    if len(keywords) < 3:
        tech_terms = [
            'machine learning', 'deep learning', 'artificial intelligence',
            'web application', 'mobile application', 'database', 'api',
            'php', 'laravel', 'react', 'python', 'javascript', 'mysql',
            'iot', 'rfid', 'qr code', 'management system', 'monitoring system',
            'aeroponics', 'poultry', 'e-commerce', 'guidance counseling'
        ]
        lower_full = full_text.lower()
        for t in tech_terms:
            if t in lower_full and t not in keywords:
                keywords.append(t)
            if len(keywords) >= 10:
                break

    # ──────────────────────────────────────────────────────────
    # 7. AUTHOR DETAILS
    # ──────────────────────────────────────────────────────────
    author_details = []
    if author and doc:
        names = [n.strip() for n in author.split(",") if n.strip()]
        last_pages = []
        total_p = doc.page_count
        start_p = max(0, total_p - 25)
        for pno in range(start_p, total_p):
            t = doc[pno].get_text().strip()
            if t:
                last_pages.append(t)
        cv_text = "\n".join(last_pages)
        email_re = re.compile(r'[\w.+\-]+@[\w\-]+(?:\.[\w\-]+)+')
        phone_re = re.compile(r'(?:\+?63|0)9\d{9}|09\d{2}[\-\s]?\d{3}[\-\s]?\d{4}')

        for name in names:
            name_parts = [p.lower() for p in name.split() if len(p) > 2]
            found_email = ""
            found_phone = ""
            lines = cv_text.splitlines()
            for idx, l in enumerate(lines):
                l_low = l.lower()
                if sum(1 for p in name_parts if p in l_low) >= min(2, len(name_parts)):
                    window = "\n".join(lines[idx:idx + 35])
                    m_em = email_re.search(window)
                    if m_em:
                        found_email = m_em.group(0)
                    m_ph = phone_re.search(window)
                    if m_ph:
                        raw_ph = re.sub(r'[^0-9+]', '', m_ph.group(0))
                        if raw_ph.startswith('639'):
                            raw_ph = '0' + raw_ph[2:]
                        elif raw_ph.startswith('+639'):
                            raw_ph = '0' + raw_ph[3:]
                        found_phone = raw_ph
                    break
            author_details.append({
                "name": name,
                "email": found_email,
                "contact": found_phone,
            })

    return {
        "title": title,
        "author": author,
        "year": year,
        "date": date_str,
        "program": program,
        "keywords": keywords[:10],
        "abstract": abstract,
        "author_details": author_details,
    }


def process_pdf(pdf_path: str, max_pages: int = 15) -> dict[str, Any]:
    doc = fitz.open(pdf_path)
    try:
        pages = extract_front_matter_pages(doc, max_pages=max_pages)
        meta = extract_metadata_from_pages(pages, doc=doc)
        source = "\n\n".join(pages)
        return {
            "metadata": meta,
            "source": source,
            "scope": f"first_{len(pages)}_pages" if len(pages) < doc.page_count else "full_document",
        }
    finally:
        doc.close()


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Missing PDF path argument"}))
        sys.exit(1)

    pdf_path = sys.argv[1]
    if not os.path.exists(pdf_path):
        print(json.dumps({"error": f"File not found: {pdf_path}"}))
        sys.exit(1)

    try:
        result = process_pdf(pdf_path)
        print(json.dumps(result, ensure_ascii=False))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)


if __name__ == "__main__":
    main()
