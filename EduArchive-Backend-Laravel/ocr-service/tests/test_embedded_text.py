import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from validators import has_usable_embedded_text, choose_page_text


class EmbeddedTextTests(unittest.TestCase):
    def test_empty_ocr_preserves_readable_sparse_text(self):
        self.assertEqual(choose_page_text('A short title', ''), 'A short title')
        self.assertEqual(choose_page_text('A short title', '  \n'), 'A short title')
        self.assertEqual(choose_page_text('CamScanner', 'Recognized capstone title'), 'Recognized capstone title')

    def test_scanner_watermark_does_not_bypass_ocr(self):
        self.assertFalse(has_usable_embedded_text('CamScanner'))
        self.assertFalse(has_usable_embedded_text('Scanned with CamScanner\n12'))
        self.assertFalse(has_usable_embedded_text(' \n\t '))

    def test_substantial_embedded_text_keeps_the_fast_path(self):
        self.assertTrue(has_usable_embedded_text(
            'This academic document contains readable text about a research archive. '
            'The authors present a searchable system for students and faculty.'))


if __name__ == '__main__':
    unittest.main()
