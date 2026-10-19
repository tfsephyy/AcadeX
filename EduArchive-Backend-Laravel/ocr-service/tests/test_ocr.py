"""Synthetic OCR regression tests; requires the pinned environment and model cache."""
import io
import os
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import pymupdf
from PIL import Image, ImageDraw, ImageFont
from fastapi.testclient import TestClient
from main import app
from validators import MAX_FILE_SIZE_BYTES


class OcrTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        cls.client.__enter__()

    @classmethod
    def tearDownClass(cls):
        cls.client.__exit__(None, None, None)

    @staticmethod
    def image():
        image = Image.new('RGB', (1600, 300), 'white')
        font = None
        for name in ['DejaVuSans.ttf', 'C:/Windows/Fonts/arial.ttf']:
            try:
                font = ImageFont.truetype(name, 64)
                break
            except OSError:
                pass
        if font is None:
            raise unittest.SkipTest('A scalable synthetic-test font is required.')
        ImageDraw.Draw(image).text((30, 90), 'ACADEX SYNTHETIC OCR TEST', fill='black', font=font)
        buffer = io.BytesIO()
        image.save(buffer, format='PNG')
        return buffer.getvalue()

    def post(self, name, data, mime):
        return self.client.post('/api/ocr', files={'file': (name, data, mime)})

    def test_health_and_invalid_uploads(self):
        self.assertEqual(self.client.get('/health').status_code, 200)
        for name, data in [('invalid.pdf', b'not a pdf'), ('script.exe', b'payload'),
                           ('empty.pdf', b''), ('large.pdf', b'%PDF-'+b'x'*MAX_FILE_SIZE_BYTES)]:
            self.assertEqual(self.post(name, data, 'application/pdf').status_code, 422)

    def test_embedded_pdf_text_and_page_limit(self):
        doc = pymupdf.open()
        doc.new_page().insert_text((40, 60), 'ACADEX SYNTHETIC TEXT PDF')
        response = self.post('synthetic.pdf', doc.tobytes(), 'application/pdf')
        doc.close()
        self.assertEqual(response.status_code, 200)
        self.assertIn('ACADEX SYNTHETIC TEXT PDF', response.json()['full_text'])
        doc = pymupdf.open()
        for _ in range(51):
            doc.new_page()
        self.assertEqual(self.post('pages.pdf', doc.tobytes(), 'application/pdf').status_code, 422)
        doc.close()

    def test_image_and_scanned_pdf_inference(self):
        image = self.image()
        response = self.post('synthetic.png', image, 'image/png')
        self.assertEqual(response.status_code, 200)
        self.assertIn('SYNTHETIC', response.json()['text'].upper())
        doc = pymupdf.open()
        page = doc.new_page(width=576, height=108)
        page.insert_image(page.rect, stream=image)
        response = self.post('scan.pdf', doc.tobytes(), 'application/pdf')
        doc.close()
        self.assertEqual(response.status_code, 200)
        self.assertIn('SYNTHETIC', response.json()['full_text'].upper())

    def test_render_limits_close_document_and_remove_plaintext_temp(self):
        old = tempfile.tempdir
        with tempfile.TemporaryDirectory() as private:
            tempfile.tempdir = private
            try:
                doc = pymupdf.open()
                doc.new_page(width=10_000, height=10_000)
                response = self.post('huge-page.pdf', doc.tobytes(), 'application/pdf')
                doc.close()
                self.assertEqual(response.status_code, 422)
                self.assertEqual(os.listdir(private), [])
            finally:
                tempfile.tempdir = old


if __name__ == '__main__':
    unittest.main()
