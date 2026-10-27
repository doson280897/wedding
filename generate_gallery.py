from __future__ import annotations

from pathlib import Path
from urllib.parse import quote
import hashlib
import json
import re

from PIL import Image, ImageOps, UnidentifiedImageError
import pillow_avif  # noqa: F401

ROOT = Path(__file__).resolve().parent
IMAGE_ROOT = ROOT / "images"

ORIGINAL_ROOT = IMAGE_ROOT / "original"
ORIGINAL_ASSETS = ORIGINAL_ROOT / "assets"
ORIGINAL_ALBUM = ORIGINAL_ROOT / "album"

OPTIMIZED_ROOT = IMAGE_ROOT / "optimized"
OPTIMIZED_ASSETS = OPTIMIZED_ROOT / "assets"
OPTIMIZED_ALBUM = OPTIMIZED_ROOT / "album"

MANIFEST_FILE = IMAGE_ROOT / "manifest.json"

SUPPORTED_EXTENSIONS = {
    ".jpg", ".jpeg", ".png", ".webp", ".avif", ".gif", ".bmp", ".tif", ".tiff"
}

ALBUM_MAX_SIDE = 960
ALBUM_QUALITY = 80

ASSET_SIZES = {
    "hero_bride": 1920,
    "hero_groom": 1920,
    "ending_bride": 1600,
    "ending_groom": 1600,
    "son-1": 1000,
    "son-2": 900,
    "nga-1": 1000,
    "nga-2": 900,
}
BACKGROUND = (16, 20, 25)


def natural_key(value: str):
    return [int(part) if part.isdigit() else part.casefold() for part in re.split(r"(\d+)", value)]


def safe_display_name(path: Path) -> str:
    return path.stem.replace("_", " ").replace("-", " ").strip()


def ensure_dirs():
    for path in (ORIGINAL_ASSETS, ORIGINAL_ALBUM, OPTIMIZED_ASSETS, OPTIMIZED_ALBUM):
        path.mkdir(parents=True, exist_ok=True)


def optimized_album_target(source: Path) -> Path:
    rel = source.relative_to(ORIGINAL_ALBUM)
    return OPTIMIZED_ALBUM / rel.parent / f"{rel.name}.webp"


def prepare_rgb(original: Image.Image, max_side: int) -> Image.Image:
    try:
        original.seek(0)
    except Exception:
        pass

    image = ImageOps.exif_transpose(original)
    image.thumbnail((max_side, max_side), Image.Resampling.LANCZOS)

    if image.mode in ("RGBA", "LA") or (image.mode == "P" and "transparency" in image.info):
        rgba = image.convert("RGBA")
        background = Image.new("RGBA", rgba.size, BACKGROUND + (255,))
        background.alpha_composite(rgba)
        return background.convert("RGB")

    return image.convert("RGB")


def build_album_image(source: Path, target: Path):
    target.parent.mkdir(parents=True, exist_ok=True)
    with Image.open(source) as original:
        image = prepare_rgb(original, ALBUM_MAX_SIDE)
        image.save(target, "WEBP", quality=ALBUM_QUALITY, method=6)


def discover_album_images() -> list[Path]:
    images = [
        path
        for path in ORIGINAL_ALBUM.rglob("*")
        if path.is_file() and path.suffix.lower() in SUPPORTED_EXTENSIONS
    ]
    images.sort(key=lambda path: natural_key(path.relative_to(ORIGINAL_ALBUM).as_posix()))
    return images


def find_asset_source(name: str) -> Path | None:
    candidates = sorted(
        (
            path
            for path in ORIGINAL_ASSETS.iterdir()
            if path.is_file()
            and path.stem.lower() == name
            and path.suffix.lower() in SUPPORTED_EXTENSIONS
        ),
        key=lambda path: (path.suffix.lower() != ".jpg", path.name.lower()),
    )
    return candidates[0] if candidates else None


def optimize_assets():
    """Build main website WebP assets from images/original/assets/."""
    ensure_dirs()

    for name, max_side in ASSET_SIZES.items():
        source = find_asset_source(name)
        target = OPTIMIZED_ASSETS / f"{name}.webp"

        if source is None:
            state = "giữ file tối ưu hiện có" if target.exists() else "chưa có file tối ưu"
            print(f"Thiếu ảnh gốc images/original/assets/{name}.* — {state}.")
            continue

        if target.exists() and target.stat().st_mtime_ns >= source.stat().st_mtime_ns:
            continue

        try:
            with Image.open(source) as original:
                image = prepare_rgb(original, max_side)
                quality = 80 if name.startswith(("hero", "ending")) else 82
                image.save(target, "WEBP", quality=quality, method=6)
            print(
                f"Asset: {source.name} -> "
                f"images/optimized/assets/{name}.webp "
                f"({target.stat().st_size // 1024} KB)"
            )
        except (OSError, ValueError, UnidentifiedImageError) as exc:
            print(f"Không tối ưu được {source.name}: {exc}")
            print("Giữ nguyên file tối ưu cũ nếu đang có.")


def generate_manifest():
    """Build album WebP files and images/manifest.json."""
    ensure_dirs()
    found = discover_album_images()
    manifest = {"total": 0, "photos": []}
    expected_targets: set[Path] = set()
    # Preserve already-published album photos when adding new selections.
    previous = []
    if MANIFEST_FILE.exists():
        try:
            old = json.loads(MANIFEST_FILE.read_text(encoding="utf-8"))
            previous = old if isinstance(old, list) else old.get("photos", [])
        except (OSError, ValueError, TypeError):
            previous = []

    if not found:
        existing_photos = []
        if MANIFEST_FILE.exists():
            try:
                existing = json.loads(MANIFEST_FILE.read_text(encoding="utf-8"))
                existing_photos = existing if isinstance(existing, list) else existing.get("photos", [])
            except (OSError, ValueError, TypeError):
                existing_photos = []

        if existing_photos or any(OPTIMIZED_ALBUM.rglob("*.webp")):
            print(
                "Không có ảnh gốc trong images/original/album/. "
                "Giữ nguyên manifest và album tối ưu hiện có."
            )
            return

        MANIFEST_FILE.write_text(
            json.dumps(manifest, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        print("Chưa có album. Đã tạo images/manifest.json rỗng.")
        return

    for source in found:
        target = optimized_album_target(source)
        expected_targets.add(target.resolve())

        try:
            if not target.exists() or source.stat().st_mtime_ns > target.stat().st_mtime_ns:
                build_album_image(source, target)
                print(f"Optimized: {source.relative_to(ROOT).as_posix()}")
        except (OSError, ValueError, UnidentifiedImageError) as exc:
            print(f"Skipped {source.relative_to(ROOT).as_posix()}: {exc}")
            continue

        digest = hashlib.sha1(target.read_bytes()).hexdigest()[:10]
        try:
            with Image.open(target) as optimized:
                width, height = optimized.size
        except (OSError, ValueError, UnidentifiedImageError):
            width, height = 0, 0

        manifest["photos"].append(
            {
                "src": quote(target.relative_to(ROOT).as_posix(), safe="/"),
                "name": safe_display_name(source),
                "v": digest,
                "width": width,
                "height": height,
            }
        )

    # Never delete optimized photos just because their original is absent.
    existing_src = {item["src"] for item in manifest["photos"]}
    for item in previous:
        if item.get("src") not in existing_src and (ROOT / item.get("src", "")).is_file():
            manifest["photos"].append(item)
            existing_src.add(item["src"])

    manifest["total"] = len(manifest["photos"])
    MANIFEST_FILE.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"\nHoàn tất: {manifest['total']} ảnh.")
    print("Đã cập nhật images/manifest.json và images/optimized/album/.")


if __name__ == "__main__":
    generate_manifest()
    optimize_assets()
