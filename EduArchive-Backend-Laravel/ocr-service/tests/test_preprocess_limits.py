"""No model imports or image allocation; verify the allocation decision itself."""
import sys
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from validators import planned_preprocess_size


class PreprocessLimits(unittest.TestCase):
    def test_thin_and_oversized_inputs_are_rejected_before_resize(self):
        for dimensions in [(1, 10000), (10000, 1), (100, 10000), (0, 100), (5000, 5000)]:
            with self.assertRaises(ValueError):
                planned_preprocess_size(*dimensions)

    def test_ordinary_scans_preserve_aspect_and_stay_within_budget(self):
        self.assertEqual(planned_preprocess_size(1024, 768), (1024, 768))
        self.assertEqual(planned_preprocess_size(1600, 300), (6400, 1200))
        self.assertEqual(planned_preprocess_size(300, 1600), (1200, 6400))


if __name__ == '__main__':
    unittest.main()
