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

def read_wedding_info() -> dict:
    """Read the JSON object stored inside the one editable wedding-info.js file."""
    source = (ROOT / "wedding-info.js").read_text(encoding="utf-8")
    marker = "window.WEDDING_INFO = "
    if marker not in source:
        raise ValueError("Không tìm thấy window.WEDDING_INFO trong wedding-info.js")
    value, _ = json.JSONDecoder().raw_decode(source.split(marker, 1)[1].lstrip())
    return value


WEDDING_INFO = read_wedding_info()
MANIFEST_FILE = IMAGE_ROOT / "manifest.json"


def read_album_manifest() -> dict:
    """Read the only album config/photo list, never a second gallery config."""
    if not MANIFEST_FILE.is_file():
        raise FileNotFoundError(
            "Thiếu images/manifest.json: hãy tạo file cấu hình album trước."
        )
    data = json.loads(MANIFEST_FILE.read_text(encoding="utf-8"))
    if not isinstance(data, dict) or not isinstance(data.get("photos"), list):
        raise ValueError("images/manifest.json phải là object với photos là một mảng")
    return data


ALBUM_MANIFEST = read_album_manifest()
ALBUM_MODE = ALBUM_MANIFEST.get("mode")
if ALBUM_MODE not in ("append", "replace"):
    raise ValueError("images/manifest.json: mode phải là append hoặc replace")
if not isinstance(ALBUM_MANIFEST.get("shuffle"), bool):
    raise ValueError("images/manifest.json: shuffle phải là true hoặc false")

optimization = ALBUM_MANIFEST.get("optimization")
if not isinstance(optimization, dict):
    raise ValueError("images/manifest.json: cần khai báo optimization")
ALBUM_MAX_SIDE = optimization.get("maxSide")
ALBUM_QUALITY = optimization.get("quality")
if type(ALBUM_MAX_SIDE) is not int or not 160 <= ALBUM_MAX_SIDE <= 4096:
    raise ValueError("images/manifest.json: optimization.maxSide phải từ 160 đến 4096")
if type(ALBUM_QUALITY) is not int or not 1 <= ALBUM_QUALITY <= 100:
    raise ValueError("images/manifest.json: optimization.quality phải từ 1 đến 100")


SUPPORTED_EXTENSIONS = {
    ".jpg", ".jpeg", ".png", ".webp", ".avif", ".gif", ".bmp", ".tif", ".tiff"
}

# Read portrait / hero / ending filenames from wedding-info.js.
# Changing the couple's photo filenames does not require editing this script.
ASSET_SIZES = {}
for party in WEDDING_INFO["parties"].values():
    images = party["images"]
    for key, max_side in (
        ("hero", 1920),
        ("ending", 1600),
        ("portraitMain", 1000),
        ("portraitSecondary", 900),
    ):
        asset_name = Path(images[key]).stem
        ASSET_SIZES[asset_name] = max_side

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
    """Add new optimized photos without erasing manifest settings or captions."""
    ensure_dirs()
    found = discover_album_images()

    # Preserve all manual options and per-photo custom metadata. In append
    # mode the original heavy images may be absent (they are gitignored);
    # their existing optimized photos must remain in the published manifest.
    manifest = dict(ALBUM_MANIFEST)
    previous = [
        dict(item) for item in manifest["photos"]
        if isinstance(item, dict) and isinstance(item.get("src"), str)
        and item["src"]
    ]
    photos = list(previous) if ALBUM_MODE == "append" else []
    indexes = {photo["src"]: index for index, photo in enumerate(photos)}

    for source in found:
        target = optimized_album_target(source)
        try:
            if not target.exists() or source.stat().st_mtime_ns > target.stat().st_mtime_ns:
                build_album_image(source, target)
                print(f"Optimized: {source.relative_to(ROOT).as_posix()}")
            digest = hashlib.sha1(target.read_bytes()).hexdigest()[:10]
            with Image.open(target) as optimized:
                width, height = optimized.size
        except (OSError, ValueError, UnidentifiedImageError) as exc:
            print(f"Skipped {source.relative_to(ROOT).as_posix()}: {exc}")
            continue

        generated = {
            "src": quote(target.relative_to(ROOT).as_posix(), safe="/"),
            "name": safe_display_name(source),
            "v": digest,
            "width": width,
            "height": height,
        }
        path = generated["src"]
        if path in indexes:
            # Retain hand-edited 'caption' and unknown future metadata.
            photos[indexes[path]].update(generated)
        else:
            indexes[path] = len(photos)
            photos.append(generated)

    unique = []
    seen = set()
    for item in photos:
        if item["src"] in seen:
            continue
        seen.add(item["src"])
        unique.append(item)

    manifest["photos"] = unique
    manifest["total"] = len(unique)
    MANIFEST_FILE.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    if not found and ALBUM_MODE == "append":
        print("Không có ảnh gốc mới; giữ nguyên danh sách ảnh và tùy chỉnh.")
    elif not found:
        print("Replace mode: không có ảnh gốc nên album mới rỗng.")
    print(f"Hoàn tất: {manifest['total']} ảnh trong images/manifest.json.")


if __name__ == "__main__":
    generate_manifest()
    optimize_assets()
