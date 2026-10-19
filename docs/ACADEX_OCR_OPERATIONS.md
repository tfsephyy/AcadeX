# Private OCR operations

This is preparation, not an executed Ubuntu deployment. CPU PaddleOCR 2.8.1 / PaddlePaddle 2.6.2 and Python 3.11 remain the compatible baseline. `requirements-linux.lock` resolves the Linux x86_64 dependency graph with hashes; Windows uses its separate lock. A Windows installation must not be copied to Ubuntu. The Linux lock was resolved locally, not executed on Linux.

Use a dedicated service identity and virtual environment, loopback-only Uvicorn, one worker, no reload, bounded concurrency, and a persistent private model cache. `deploy/acadex-ocr.service.example` contains placeholders requiring administrator review. CPU work is serialized and runs off the async event loop so health can respond. Uvicorn rejects excess concurrency; Laravel retains manual/skip extraction and existing native fallback behavior. A 200 health response does not prove recognition accuracy.

Environment settings are process settings, not an automatically loaded Python `.env`: `OCR_MODEL_CACHE`, `TMPDIR`, `HOME`, `OMP_NUM_THREADS`, `MKL_NUM_THREADS`. A template is in `ocr-service/.env.example`. First startup can download publisher model weights; warm/cache them deliberately, verify controlled restart, and restrict cache writes to the service identity. Use a private directory and umask 0077. Temporary PDF handles close on failures before cleanup. PHP uses its own `PRIVATE_TEMP_PATH` with 0700 directories and 0600 files; verify ACLs on Windows and actual mode/ownership on Linux.

Limits: 20 MiB OCR request budget, 50 PDF pages, 20 million rendered pixels per image/page. The application upload ceiling is at most 64 MiB (under the current whole-file encryption baseline with 512M memory_limit and 64M PHP-FPM upload_max_filesize). Because the OCR request budget is 20 MiB, larger PDFs (between 20 MiB and 64 MiB) require the skip/manual extraction path or native fallback. Multipart uploads are bounded when read by the endpoint; the framework can spool uploads before endpoint validation, so Apache/proxy and service resource limits remain necessary. Embedded-text PDFs avoid model inference. Scanned recognition remains synchronous to Laravel; its 120-second OCR timeout and Cloudflare budget still require representative load tests. Queue processing is a separate maintenance path with a 600-second job and retry-after greater than 600 (default 660).

**Ubuntu prerequisites to verify, not blindly install:** Python 3.11 executable/wheels and venv, OpenMP runtime (typically libgomp), OpenCV dependencies (often libGL/libglib when Paddle's upstream non-headless OpenCV packages are present), Ghostscript, Tesseract English data, and optional Poppler for FastOcrService. The upstream PaddleOCR graph includes both opencv-python and opencv-contrib-python, with a headless direct dependency; verify actual imported cv2 and shared libraries. No Linux host is available in this inspection. Confirm publisher wheel availability, CPU architecture/instruction support, and imports under the service identity before accepting the target.

Conditional commands, **Ubuntu SSH session from the approved OCR release directory**, after host inspection and advisory disposition:

```bash
python3.11 -m venv .venv
.venv/bin/python -m pip install --require-hashes -r requirements-linux.lock
.venv/bin/python -m pip check
.venv/bin/python -m unittest discover -s tests
.venv/bin/python -m uvicorn main:app --host 127.0.0.1 --port 8001 --workers 1 --limit-concurrency 4 --timeout-graceful-shutdown 180
```

Run inference tests only with synthetic PDFs/images. Do not publish the OCR endpoint, model cache, temporary files, or uploads. Use process supervision, monitor RSS/OOM/restarts, temporary disk usage and request duration, drain requests before restarting, and keep a measured workload envelope. Initial combined-server sizing remains an estimate (2 vCPU / 8 GiB RAM plus archive/DB/temp capacity); swap is a cushion, not OCR capacity. No resources were purchased or provisioned. Tools used here are free; AWS/SMTP/domain eligibility and usage charges must be checked by the administrator and cannot be guaranteed free.

Remaining Paddle/imgaug/setuptools advisories are classified in `ACADEX_RELEASE_READINESS.md`. Private binding limits exposure but does not remediate a vulnerable library. A Paddle 3 migration requires separately validated compatibility; no blind major upgrade was applied.
