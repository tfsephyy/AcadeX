"""Explicit local probe; uses only the guarded disposable database and synthetic PDF."""
import os
import socket
import subprocess
import sys
import time
from pathlib import Path

import httpx
import pymupdf
from test_ocr import OcrTests


def main():
    backend = Path(__file__).resolve().parents[2]
    output = backend.parent / '.local' / 'remediation-test'
    output.mkdir(parents=True, exist_ok=True)
    with socket.socket() as check:
        check.bind(('127.0.0.1', 18882))  # Refuse occupied ports, never stop existing services.
    doc = pymupdf.open()
    page = doc.new_page(width=576, height=108)
    page.insert_image(page.rect, stream=OcrTests.image())
    doc.save(output / 'synthetic-scan.pdf')
    doc.close()
    env = os.environ.copy()
    env.update(PYTHONDONTWRITEBYTECODE='1', OMP_NUM_THREADS='2', MKL_NUM_THREADS='2')
    with (output / 'uvicorn-probe.log').open('ab') as log:
        process = subprocess.Popen([sys.executable, '-m', 'uvicorn', 'main:app', '--host', '127.0.0.1',
                                    '--port', '18882', '--workers', '1'], cwd=backend / 'ocr-service',
                                   env=env, stdout=log, stderr=log,
                                   creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0)
        try:
            for _ in range(120):
                if process.poll() is not None:
                    raise RuntimeError('Owned Uvicorn probe exited before readiness; inspect its private log.')
                try:
                    if httpx.get('http://127.0.0.1:18882/health', timeout=1).status_code == 200:
                        break
                except httpx.HTTPError:
                    pass
                time.sleep(0.25)
            else:
                raise RuntimeError('Owned Uvicorn readiness timed out.')
            print('Live private Uvicorn startup/health: PASSED', flush=True)
            subprocess.run(['php', 'scripts/run-security-tests.php', '--ocr-check'], cwd=backend, check=True)
        finally:
            process.terminate()  # Only this probe's process. Linux service draining is separate acceptance.
            process.wait(timeout=15)


if __name__ == '__main__':
    main()
