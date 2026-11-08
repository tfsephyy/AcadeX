"""Exercise the actual PDF loop with synthetic pages, without loading OCR models."""
import ast
import logging
import os
import sys
import tempfile
import types
import unittest
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from validators import has_usable_embedded_text


class MetadataPageTests(unittest.TestCase):
    def run_pdf(self, total, limit):
        class SyntheticDocument:
            page_count = total
            is_closed = False
            loaded = []

            def load_page(self, index):
                self.loaded.append(index)
                return types.SimpleNamespace(get_text=lambda mode: 'Synthetic PDF source text. ' * 8)

            def close(self):
                self.is_closed = True

        document = SyntheticDocument()
        module = ast.parse((Path(__file__).resolve().parents[1] / 'ocr_service.py').read_text(encoding='utf-8'))
        function = next(node for node in module.body if isinstance(node, ast.FunctionDef) and node.name == 'extract_text_from_pdf')
        namespace = {'Any': Any, 'MAX_PDF_PAGES': 30, 'tempfile': tempfile, 'os': os,
                     'fitz': types.SimpleNamespace(open=lambda path: document),
                     'has_usable_embedded_text': has_usable_embedded_text, 'logger': logging.getLogger(__name__)}
        exec(compile(ast.Module(body=[function], type_ignores=[]), 'ocr_service.py', 'exec'), namespace)
        return namespace['extract_text_from_pdf'](b'%PDF synthetic', max_pages=limit), document

    def test_metadata_reads_twelve_of_twenty_pages_without_rendering_or_rewording(self):
        result, document = self.run_pdf(20, 12)
        self.assertEqual(document.loaded, list(range(12)))
        self.assertEqual(result['total_pages'], 20)
        self.assertEqual(len(result['pages']), 12)
        self.assertEqual(result['pages'][0]['text'], ('Synthetic PDF source text. ' * 8).strip())
        self.assertTrue(document.is_closed)

    def test_existing_full_document_limit_and_small_pdf_behavior_remain(self):
        result, document = self.run_pdf(2, 12)
        self.assertEqual(len(result['pages']), 2)
        self.assertEqual(document.loaded, [0, 1])
        with self.assertRaises(ValueError):
            self.run_pdf(31, 12)

    def test_request_cannot_raise_or_remove_the_page_budget(self):
        for limit in [0, -1, 31]:
            with self.assertRaises(ValueError):
                self.run_pdf(20, limit)
