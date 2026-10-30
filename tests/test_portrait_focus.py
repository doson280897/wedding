import json
from pathlib import Path
import tempfile
import unittest
from scripts.portrait_focus import generate_focus

ROOT = Path(__file__).resolve().parents[1]


class PortraitFocusTests(unittest.TestCase):
    def test_real_portraits_have_one_face_each(self):
        # Regression: a classical cascade confused the bride's dress with a face.
        from shutil import copyfile

        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory)
            (output / "assets").mkdir()
            for name in ("son-1", "son-2", "nga-1", "nga-2"):
                copyfile(
                    ROOT / f"images/optimized/assets/{name}.webp",
                    output / f"assets/{name}.webp",
                )
            info = {
                "parties": {
                    person: {
                        "images": {
                            "portraitMain": f"images/optimized/assets/{person}-2.webp",
                            "portraitSecondary": f"images/optimized/assets/{person}-1.webp",
                        }
                    }
                    for person in ("son", "nga")
                }
            }
            result = generate_focus(output, info)
            self.assertEqual(len(result["images"]), 4)
            for entry in result["images"].values():
                self.assertEqual(len(entry["faces"]), 1)
                self.assertTrue(all(0 <= value <= 1 for value in entry["faces"][0]))
            self.assertEqual(
                json.loads((output / "portrait-focus.json").read_text()), result
            )
