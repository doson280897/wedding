from __future__ import annotations

from pathlib import Path
from urllib.parse import quote
import json
import re

from PIL import Image, ImageOps, UnidentifiedImageError
import pillow_avif  # noqa: F401

ROOT = Path(__file__).resolve().parent
IMAGES_DIR = ROOT / "images"
THUMBS_DIR = ROOT / "thumbs"
MANIFEST_FILE = ROOT / "images.json"
ASSETS_DIR = ROOT / "assets"
OPTIMIZED_ASSETS = ROOT / "assets-optimized"

SUPPORTED_EXTENSIONS = {
    ".jpg", ".jpeg", ".png", ".webp", ".avif", ".gif", ".bmp", ".tif", ".tiff"
}

MAX_SIDE = 1100
QUALITY = 82

# Asset display size: cover images 1920px; portrait photos 1000px.
ASSET_SIZES = {"hero": 1920, "ending": 1600, "son-1": 1000, "son-2": 900, "nga-1": 1000, "nga-2": 900}
BACKGROUND = (16, 20, 25)


def natural_key(value: str):
    return [int(part) if part.isdigit() else part.casefold() for part in re.split(r"(\d+)", value)]


def safe_display_name(path: Path) -> str:
    return path.stem.replace("_", " ").replace("-", " ").strip()


def ensure_dirs():
    IMAGES_DIR.mkdir(exist_ok=True)
    THUMBS_DIR.mkdir(exist_ok=True)
    ASSETS_DIR.mkdir(exist_ok=True)
    OPTIMIZED_ASSETS.mkdir(exist_ok=True)


def optimized_target(image_path: Path) -> Path:
    rel = image_path.relative_to(IMAGES_DIR)
    return THUMBS_DIR / rel.parent / f"{rel.name}.webp"


def build_thumbnail(source: Path, target: Path):
    target.parent.mkdir(parents=True, exist_ok=True)
    with Image.open(source) as original:
        try:
            original.seek(0)
        except Exception:
            pass
        image = ImageOps.exif_transpose(original)
        image.thumbnail((MAX_SIDE, MAX_SIDE), Image.Resampling.LANCZOS)
        if image.mode in ("RGBA", "LA") or (image.mode == "P" and "transparency" in image.info):
            rgba = image.convert("RGBA")
            bg = Image.new("RGBA", rgba.size, BACKGROUND + (255,))
            bg.alpha_composite(rgba)
            image = bg.convert("RGB")
        else:
            image = image.convert("RGB")
        image.save(target, "WEBP", quality=QUALITY, method=6)


def discover_images() -> list[Path]:
    images = [
        path for path in IMAGES_DIR.rglob("*")
        if path.is_file() and path.suffix.lower() in SUPPORTED_EXTENSIONS
    ]
    images.sort(key=lambda p: natural_key(p.relative_to(IMAGES_DIR).as_posix()))
    return images


def optimize_assets():
    """Create lightweight assets from assets/* using stable *.webp names.

    This runs in the same local command and GitHub Actions step that build the album.
    Originals are retained, and the optimized files are never scanned into the 3D album.
    """
    ensure_dirs()
    for name, max_side in ASSET_SIZES.items():
        candidates = sorted((p for p in ASSETS_DIR.iterdir()
                             if p.is_file() and p.stem.lower() == name
                             and p.suffix.lower() in SUPPORTED_EXTENSIONS),
                            key=lambda p: (p.suffix.lower() != ".jpg", p.name.lower()))
        target = OPTIMIZED_ASSETS / f"{name}.webp"
        if not candidates:
            # Don't leave a stale optimized photo after removing its original.
            if target.exists():
                target.unlink()
            print(f"Asset chưa có: assets/{name}.*")
            continue
        source = candidates[0]
        if (target.exists() and target.stat().st_mtime_ns >= source.stat().st_mtime_ns):
            continue
        try:
            with Image.open(source) as original:
                original.seek(0)
                image = ImageOps.exif_transpose(original)
                image.thumbnail((max_side, max_side), Image.Resampling.LANCZOS)
                if image.mode in ("RGBA", "LA") or (image.mode == "P" and "transparency" in image.info):
                    rgba = image.convert("RGBA")
                    background = Image.new("RGBA", rgba.size, BACKGROUND + (255,))
                    background.alpha_composite(rgba)
                    image = background.convert("RGB")
                else:
                    image = image.convert("RGB")
                image.save(target, "WEBP", quality=80 if name in ("hero", "ending") else 82, method=6)
                print(f"Asset: {source.name} -> assets-optimized/{name}.webp ({target.stat().st_size // 1024} KB)")
        except (OSError, ValueError, UnidentifiedImageError) as exc:
            print(f"Không tối ưu được {source.name}: {exc}")
            if target.exists():
                target.unlink()


def generate_manifest():
    ensure_dirs()
    found = discover_images()
    manifest = {"total": 0, "photos": []}
    expected_targets: set[Path] = set()

    if not found:
        MANIFEST_FILE.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
        print("Không có ảnh trong thư mục images/. Đã tạo images.json rỗng.")
        return

    for source in found:
        target = optimized_target(source)
        expected_targets.add(target.resolve())
        try:
            if not target.exists() or source.stat().st_mtime > target.stat().st_mtime:
                build_thumbnail(source, target)
                print(f"Optimized: {source.relative_to(ROOT).as_posix()}")
        except (OSError, ValueError, UnidentifiedImageError) as exc:
            print(f"Skipped {source.relative_to(ROOT).as_posix()}: {exc}")
            continue

        manifest["photos"].append({
            "src": quote(target.relative_to(ROOT).as_posix(), safe="/"),
            "name": safe_display_name(source)
        })

    for stale in THUMBS_DIR.rglob("*.webp"):
        if stale.resolve() not in expected_targets:
            stale.unlink(missing_ok=True)

    manifest["total"] = len(manifest["photos"])
    MANIFEST_FILE.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\nHoàn tất: {manifest['total']} ảnh.")
    print("Đã tạo images.json và thư mục thumbs/.")


if __name__ == "__main__":
    generate_manifest()
    optimize_assets()
