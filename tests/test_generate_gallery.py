"""Exercise the real image pipeline in disposable trees, never production images."""

import copy
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest import mock

from PIL import Image

REPO = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location(
    "gallery_generator", REPO / "generate_gallery.py"
)
gallery = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gallery)


class RebuildTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.assets = self.root / "images/original/assets"
        self.album = self.root / "images/original/album"
        self.assets.mkdir(parents=True)
        self.album.mkdir(parents=True)
        party = {
            "images": {
                "hero": "images/optimized/assets/hero.webp",
                "ending": "images/optimized/assets/ending.webp",
                "portraitMain": "images/optimized/assets/person.webp",
                "portraitSecondary": "images/optimized/assets/person-secondary.webp",
                "favicon": "favicon.svg",
            },
            "gift": {"qrImage": "images/static/qr.png"},
        }
        self.info = {
            "parties": {
                "bride": party,
                "groom": copy.deepcopy(party),
                "single": copy.deepcopy(party),
            },
            "site": {
                "entrance": {
                    "image": "images/static/gate.webp",
                    "lock": "images/static/lock.webp",
                }
            },
            "story": {
                "images": {
                    "together": {
                        "src": "images/optimized/assets/story.webp",
                        "sourceName": "story-together",
                        "width": 320,
                        "variants": [
                            {
                                "src": "images/optimized/assets/story-small.webp",
                                "width": 160,
                            },
                            {"src": "images/optimized/assets/story.webp", "width": 320},
                        ],
                    }
                }
            },
        }
        for name in ("hero", "ending", "person", "person-secondary"):
            Image.new("RGB", (400, 300), "red").save(self.assets / (name + ".jpg"))
        Image.new("RGB", (400, 300), "blue").save(self.assets / "story-together.JPG")
        self.static = self.root / "images/static"
        self.static.mkdir()
        Image.new("RGB", (400, 300), "red").save(self.static / "gate.webp")
        Image.new("RGBA", (80, 100), (230, 200, 100, 0)).save(self.static / "lock.webp")
        Image.new("RGB", (30, 30), "white").save(self.static / "qr.png")
        self.photo = self.album / "Ảnh 01.jpg"
        Image.new("RGB", (1800, 1200), "green").save(self.photo)
        (self.root / "favicon.svg").write_text(
            '<svg xmlns="http://www.w3.org/2000/svg"/>'
        )
        self.write_info()
        self.manifest = self.root / "images/manifest.json"
        self.manifest.write_text(
            json.dumps(
                {
                    "mode": "replace",
                    "shuffle": True,
                    "optimization": {"maxSide": 1440, "quality": 84},
                    "captions": {"vi": ["Chúng mình"]},
                    "total": 1,
                    "photos": [{"src": "images/optimized/album/old.webp"}],
                }
            ),
            encoding="utf-8",
        )
        self.output = self.root / "images/optimized"
        (self.output / "album").mkdir(parents=True)
        (self.output / "album/old.webp").write_bytes(b"previous image bytes")
        (self.output / "unused").mkdir()
        (self.output / "unused/stale.txt").write_text("remove on success")

    def write_info(self):
        (self.root / "wedding-info.js").write_text(
            "window.WEDDING_INFO = " + json.dumps(self.info) + ";"
        )

    def snapshot(self):
        return {
            str(p.relative_to(self.root)): p.read_bytes()
            for p in (self.root / "images").rglob("*")
            if p.is_file()
        }

    def assert_fails_unchanged(self, message):
        before = self.snapshot()
        with self.assertRaisesRegex(ValueError, message):
            gallery.rebuild(self.root)
        self.assertEqual(before, self.snapshot())

    def test_replaces_all_old_outputs_and_regenerates_after_settings_change(self):
        gallery.rebuild(self.root)
        self.assertFalse((self.output / "album/old.webp").exists())
        self.assertFalse((self.output / "unused").exists())
        data = json.loads(self.manifest.read_text())
        self.assertEqual(data["total"], 1)
        self.assertEqual(
            (data["photos"][0]["width"], data["photos"][0]["height"]), (1440, 960)
        )
        first_version = data["photos"][0]["v"]
        data["photos"][0]["caption"] = {"vi": "Kỷ niệm"}
        data["optimization"]["maxSide"] = 1200
        self.manifest.write_text(json.dumps(data))
        os.utime(self.photo, (1, 1))  # Older mtime must not skip regeneration.
        gallery.rebuild(self.root)
        data = json.loads(self.manifest.read_text())
        self.assertEqual(data["photos"][0]["width"], 1200)
        self.assertNotEqual(data["photos"][0]["v"], first_version)
        self.assertEqual(data["photos"][0]["caption"], {"vi": "Kỷ niệm"})
        self.assertTrue(self.photo.exists())
        self.photo.unlink()
        Image.new("RGB", (200, 150), "blue").save(self.album / "new.png")
        gallery.rebuild(self.root)
        data = json.loads(self.manifest.read_text())
        self.assertEqual(data["total"], 1)
        self.assertEqual(data["photos"][0]["width"], 200)  # No fake upscaling.
        self.assertEqual(
            [p.name for p in (self.output / "album").iterdir()], ["new.png.webp"]
        )

    def test_preserves_qr_bytes_alpha_and_responsive_widths(self):
        qr = (self.static / "qr.png").read_bytes()
        gallery.rebuild(self.root)
        self.assertEqual((self.static / "qr.png").read_bytes(), qr)
        self.assertFalse((self.output / "assets/qr.png").exists())
        with Image.open(self.static / "lock.webp") as image:
            self.assertEqual(image.mode, "RGBA")
            self.assertEqual(image.getpixel((0, 0))[3], 0)
        for name, width in (("story", 320), ("story-small", 160)):
            with Image.open(self.output / ("assets/" + name + ".webp")) as image:
                self.assertEqual(image.width, width)

    def test_static_artwork_survives_rebuild_byte_for_byte_without_originals(self):
        before = {p.name: p.read_bytes() for p in self.static.iterdir()}
        gallery.rebuild(self.root)
        gallery.rebuild(self.root)
        self.assertEqual(before, {p.name: p.read_bytes() for p in self.static.iterdir()})
        self.assertFalse((self.output / "assets/gate.webp").exists())
        required = "\n".join(gallery.required_sources(gallery.asset_plan(self.info)))
        self.assertNotIn("gate", required)
        self.assertNotIn("lock", required)
        self.assertNotIn("qr", required)

    def test_missing_static_artwork_fails_before_publishing(self):
        (self.static / "lock.webp").unlink()
        self.assert_fails_unchanged("Thiếu ảnh tĩnh: images/static/lock.webp")

    def test_missing_static_qr_fails_before_publishing(self):
        (self.static / "qr.png").unlink()
        self.assert_fails_unchanged("Thiếu ảnh tĩnh: images/static/qr.png")

    def test_story_source_stem_accepts_other_formats_and_rejects_duplicates(self):
        source = self.assets / "story-together.JPG"
        source.unlink()
        Image.new("RGB", (400, 300), "blue").save(self.assets / "story-together.png")
        gallery.rebuild(self.root)
        Image.new("RGB", (400, 300), "blue").save(source)
        self.assert_fails_unchanged("Trùng tên.*story-together")

    def test_missing_required_file_fails_even_with_existing_optimized_assets(self):
        (self.assets / "hero.jpg").unlink()
        self.assert_fails_unchanged("Thiếu.*hero")

    def test_wrong_case_and_ambiguous_stem_fail(self):
        (self.assets / "hero.jpg").rename(self.assets / "Hero.jpg")
        self.assert_fails_unchanged("Thiếu.*hero")
        (self.assets / "Hero.jpg").rename(self.assets / "hero.jpg")
        Image.new("RGB", (10, 10)).save(self.assets / "hero.png")
        self.assert_fails_unchanged("Trùng tên")

    def test_corrupt_album_fails_without_touching_existing_outputs(self):
        self.photo.write_bytes(b"not a jpeg")
        self.assert_fails_unchanged("Kiểm tra đầu vào thất bại")

    def test_empty_album_and_old_append_mode_fail(self):
        self.photo.unlink()
        self.assert_fails_unchanged("ít nhất một ảnh")
        Image.new("RGB", (20, 20)).save(self.photo)
        data = json.loads(self.manifest.read_text())
        data["mode"] = "append"
        self.manifest.write_text(json.dumps(data))
        self.assert_fails_unchanged("append không còn")

    def test_check_only_is_read_only_and_story_cannot_fake_srcset_width(self):
        before = self.snapshot()
        gallery.rebuild(self.root, check=True)
        self.assertEqual(before, self.snapshot())
        Image.new("RGB", (100, 80)).save(self.assets / "story-together.JPG")
        self.assert_fails_unchanged("chiều rộng ít nhất")

    def test_encoding_failure_keeps_old_batch(self):
        before = self.snapshot()
        with mock.patch.object(gallery, "encode", side_effect=OSError("disk full")):
            with self.assertRaisesRegex(OSError, "disk full"):
                gallery.rebuild(self.root)
        self.assertEqual(before, self.snapshot())

    def test_manifest_publish_failure_rolls_back_images(self):
        before = self.snapshot()
        replace = os.replace

        def fail_manifest(source, destination):
            if Path(destination) == self.manifest:
                raise OSError("manifest replace failed")
            return replace(source, destination)

        with mock.patch.object(gallery.os, "replace", side_effect=fail_manifest):
            with self.assertRaisesRegex(OSError, "manifest replace failed"):
                gallery.rebuild(self.root)
        self.assertEqual(before, self.snapshot())

    def test_concurrent_writer_is_rejected(self):
        (self.root / "images/.gallery.lock").write_text("busy")
        self.assert_fails_unchanged("Đang có tiến trình")

    def test_cli_failure_has_nonzero_exit_and_lists_missing_names(self):
        script = self.root / "generate_gallery.py"
        script.write_text((REPO / "generate_gallery.py").read_text())
        (self.assets / "hero.jpg").unlink()
        result = subprocess.run(
            [sys.executable, str(script)], text=True, capture_output=True
        )
        self.assertEqual(result.returncode, 1)
        self.assertIn("hero", result.stderr)
        self.assertIn("FAILED", result.stderr)

    def test_actual_repository_config_covers_every_optimized_reference(self):
        info = gallery.read_wedding_info(REPO)
        plan = gallery.asset_plan(info)
        for value in gallery.image_references(info):
            self.assertIn(
                gallery.local_path(value).relative_to("images/optimized"), plan
            )


if __name__ == "__main__":
    unittest.main()
