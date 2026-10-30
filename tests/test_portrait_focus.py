import json
from pathlib import Path
import tempfile
import unittest
from unittest import mock

import numpy as np
from PIL import Image
from scripts.portrait_focus import generate_focus


class PortraitFocusTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.output = Path(self.temporary.name)
        (self.output / "assets").mkdir()
        Image.new("RGB", (600, 900), "white").save(self.output / "assets/person.webp")
        self.src = "images/optimized/assets/person.webp"
        self.info = {
            "parties": {
                "bride": {
                    "images": {
                        "portraitMain": self.src,
                        "portraitSecondary": self.src,
                    }
                }
            }
        }

    def test_face_coordinates_are_normalized_and_duplicate_paths_deduplicated(self):
        detector = mock.Mock()
        detector.detect.return_value = (
            None,
            np.array([[150, 180, 120, 180, *([0] * 10), 0.95]]),
        )
        with mock.patch("cv2.FaceDetectorYN.create", return_value=detector):
            result = generate_focus(self.output, self.info)
        self.assertEqual(result["images"][self.src]["faces"], [[0.25, 0.2, 0.2, 0.2]])
        detector.detect.assert_called_once()
        self.assertEqual(
            json.loads((self.output / "portrait-focus.json").read_text()), result
        )

    def test_real_detector_warns_for_no_face_and_writes_fallback_metadata(self):
        with self.assertWarnsRegex(UserWarning, "No face detected"):
            result = generate_focus(self.output, self.info)
        self.assertEqual(result["images"][self.src]["faces"], [])

    def test_invalid_model_fails_without_publishing_metadata(self):
        with mock.patch("scripts.portrait_focus.MODEL_SHA256", "invalid"):
            with self.assertRaisesRegex(ValueError, "checksum"):
                generate_focus(self.output, self.info)
        self.assertFalse((self.output / "portrait-focus.json").exists())

    def test_query_fragment_and_unicode_paths(self):
        source = self.output / "assets/person.webp"
        source.rename(self.output / "assets/cô dâu.webp")
        src = "images/optimized/assets/c%C3%B4%20d%C3%A2u.webp?v=2#portrait"
        self.info["parties"]["bride"]["images"] = {"portraitMain": src}
        with self.assertWarnsRegex(UserWarning, "No face detected"):
            result = generate_focus(self.output, self.info)
        self.assertEqual(result["images"][src]["width"], 600)

    def test_external_portrait_uses_fallback_without_network_access(self):
        self.info["parties"]["bride"]["images"] = {
            "portraitMain": "https://example.com/portrait.webp?v=2"
        }
        with self.assertWarnsRegex(UserWarning, "External portrait"):
            result = generate_focus(self.output, self.info)
        self.assertEqual(result["images"], {})

    def test_unsafe_paths_are_rejected(self):
        for src in (
            "images/optimized/../private.webp",
            "/tmp/private.webp",
            "//example.com/a.webp",
            "file:///tmp/a.webp",
            "images/optimized/%2e%2e/private.webp",
        ):
            with self.subTest(src=src):
                self.info["parties"]["bride"]["images"] = {"portraitMain": src}
                with self.assertRaisesRegex(ValueError, "Unsafe portrait path"):
                    generate_focus(self.output, self.info)
