# Production Release — UI Refinements, ID Format Update, and Modular Extraction — November 9, 2026

## Executive Summary

- **Backend Release:** `/srv/acadex-staging/releases/acadex-20261109-e32fa20/EduArchive-Backend-Laravel`
- **Frontend Release:** `/srv/acadex-staging/frontend-releases/acadex-20261109-e32fa20/dist`
- **Base Commit:** `e32fa20dd69418252fbc627f5425c278f58e67c5` merged into `main` and pushed to GitHub `origin/main`.
- **Public Domain:** `https://veload.site`

This release resolves the issue where client updates were not appearing on the deployed site. The client's changes from branch `release/ui-refinement` were reconciled into `main`, tested, built, and deployed to both the backend and frontend on AWS EC2.

---

## What Was Deployed and Verified

### 1. Uploads Grid Card Layout
- **Behavior:** By default, cards display **3 per row** (`lg:grid-cols-3`). When the sidebar rail is collapsed and categories are hidden, cards expand to **4 per row** (`repeat(4, minmax(0, 1fr))`).
- **Files:** `refinements.css`, `StudentUploadedCapstones.jsx`, `FacultyUploadedCapstones.jsx`, `PublishedCapstones.jsx`.
- **Status:** Verified in built production asset bundle `index-Dqxqu3pJ.js` and `index-Bau6mt0A.css`.

### 2. Registration ID Validation
- **Behavior:** Strict regex `^MBC\d{4}-\d{5}$` is removed. Students and faculty can register with their standard ID number without validation rejections.
- **Files:** `RegisterRequest.php`, `registrationValidation.js`.
- **Status:** Active on live backend and frontend.

### 3. Admin Dashboard Uploaded Capstone by Year
- **Behavior:** Fixed the bar graph query to calculate by upload calendar year (`YEAR(created_at)`) over a 6-year window, displaying empty years properly rather than showing misleading reversed bars.
- **Files:** `AdminDashboardController.php`, `AdminDashboard.jsx`.
- **Status:** Active in live backend API and frontend charts.

### 4. Faculty Adviser Dashboard ("New look ng faculty")
- **Behavior:** Faculty dashboard now renders the dedicated Adviser Dashboard with assigned metrics and upload/view trends chart.
- **Files:** `FacultyDashboard.jsx`.
- **Status:** Active in live frontend bundle.

### 5. Modular PDF Metadata Extraction & Adviser Matching
- **Behavior:** Complete modular pipeline under `app/Services/Extraction/` (`TitleExtractor`, `AuthorExtractor`, `AdviserExtractor`, `AbstractExtractor`, `YearExtractor`, `KeywordExtractor`, `ContactExtractor`, `HeaderFooterCleaner`, `MetadataPipeline`).
- **Database Migration:** Applied `2026_11_08_000001_add_capstone_adviser_name` (adds `adviser_name` nullable column).
- **OCR Microservice:** Active on port 8001 with health check returning `{"status":"ok"}`.

---

## Production Verification Results

- `https://veload.site/`: HTTP 200 with entry assets `index-Dqxqu3pJ.js` and `index-Bau6mt0A.css`.
- `https://veload.site/assets/index-Dqxqu3pJ.js`: HTTP 200.
- `https://veload.site/assets/index-Bau6mt0A.css`: HTTP 200.
- `https://veload.site/api/v1/user`: HTTP 401 unauthenticated JSON response.
- `http://127.0.0.1:8001/health`: `{"status":"ok"}`.
- Systemd services: `acadex-queue`, `acadex-scheduler`, `acadex-ocr`, `apache2`, `php8.3-fpm`, `mysql` all active and running.
- Database backup saved to `/var/backups/acadex/ui-refinement-20261109/database.sql.gz` (215 KB, gzip integrity verified).
- Preserved persistent assets: `APP_KEY`, `.env` (`/srv/acadex-staging/shared/config/laravel.env`), and document storage (`/srv/acadex-staging/shared/storage`).
