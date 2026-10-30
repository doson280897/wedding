"""Validate originals, rebuild every optimized image, then publish as one batch."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import sys
import tempfile
import time
from urllib.parse import quote, unquote, urlsplit
import xml.etree.ElementTree as ET

from PIL import Image, ImageOps
import pillow_avif  # noqa: F401

ROOT = Path(__file__).resolve().parent
IMAGE_ROOT = ROOT / "images"
MANIFEST_FILE = IMAGE_ROOT / "manifest.json"
SUPPORTED_EXTENSIONS = {
    ".jpg",
    ".jpeg",
    ".png",
    ".webp",
    ".avif",
    ".gif",
    ".bmp",
    ".tif",
    ".tiff",
}


class Progress:
    """Plain, flushed lines work in Windows terminals and redirected logs alike."""

    def __init__(self):
        self.started = time.monotonic()

    def log(self, message):
        elapsed = time.monotonic() - self.started
        print(f"[{elapsed:6.1f}s] {message}", file=sys.stderr, flush=True)

    def run(self, label, operation, *args, index, total, **kwargs):
        self.log(f"[{index}/{total}] Đang xử lý: {label}")
        started = time.monotonic()
        result = operation(*args, **kwargs)
        elapsed = time.monotonic() - started
        self.log(f"[{index}/{total}] Xong {index / total:.0%}: {label} ({elapsed:.1f}s)")
        return result


def read_wedding_info(root: Path) -> dict:
    source = (root / "wedding-info.js").read_text(encoding="utf-8")
    marker = "window.WEDDING_INFO = "
    if marker not in source:
        raise ValueError("Không tìm thấy window.WEDDING_INFO trong wedding-info.js")
    return json.JSONDecoder().raw_decode(source.split(marker, 1)[1].lstrip())[0]


def local_path(value: str) -> Path | None:
    parsed = urlsplit(value)
    if parsed.scheme in ("https", "http"):
        return None
    path = Path(unquote(parsed.path))
    if parsed.scheme or parsed.netloc or path.is_absolute() or ".." in path.parts:
        raise ValueError("Đường dẫn ảnh không an toàn: " + value)
    return path


def image_references(node, prefix="images/optimized/"):
    if isinstance(node, dict):
        for value in node.values():
            yield from image_references(value, prefix)
    elif isinstance(node, list):
        for value in node:
            yield from image_references(value, prefix)
    elif isinstance(node, str) and node.startswith(prefix):
        yield node


def asset_plan(info: dict) -> dict:
    """Map each configured output to a mandatory original and its conversion."""
    plan = {}

    def add(value, *, max_side=None, width=None, source_name=None, copy=False):
        relative = local_path(value)
        if relative is None:
            return
        if relative.parts[:3] != ("images", "optimized", "assets"):
            raise ValueError(
                "Ảnh cấu hình phải nằm trong images/optimized/assets/: " + value
            )
        output = relative.relative_to("images/optimized")
        source = Path(source_name) if source_name else output.relative_to("assets")
        if source.is_absolute() or ".." in source.parts:
            raise ValueError("Tên ảnh gốc không an toàn: " + str(source))
        exact = copy or (source_name is not None and bool(source.suffix))
        if not exact:
            source = source.with_suffix("")
        rule = {
            "source": source,
            "exact": exact,
            "copy": copy,
            "max_side": max_side,
            "width": width,
        }
        previous = plan.get(output)
        if previous and previous != rule:
            raise ValueError("Hai quy tắc ảnh xung đột: " + str(output))
        plan[output] = rule

    for party in info["parties"].values():
        for key, size in (
            ("hero", 1920),
            ("ending", 1600),
            ("portraitMain", 1000),
            ("portraitSecondary", 900),
        ):
            add(party["images"][key], max_side=size)
        # Gift QR images are shipped as-is, alongside the entrance artwork.
        value = party["gift"]["qrImage"]
        relative = local_path(value)
        if relative is not None and relative.parts[:2] != ("images", "static"):
            raise ValueError("Ảnh QR phải nằm trong images/static/: " + value)
    entrance = info["site"]["entrance"]
    # Entrance artwork is shipped as-is, outside the generated directory.
    for key in ("image", "lock"):
        value = entrance[key]
        relative = local_path(value)
        if relative is not None and relative.parts[:2] != ("images", "static"):
            raise ValueError("Ảnh cổng/khóa phải nằm trong images/static/: " + value)
    for image in info.get("story", {}).get("images", {}).values():
        source_name = image.get("sourceName")
        if not source_name:
            raise ValueError("Ảnh story cần sourceName trong wedding-info.js")
        outputs = {image["src"]: image["width"]}
        for variant in image.get("variants", []):
            if (
                variant["src"] in outputs
                and outputs[variant["src"]] != variant["width"]
            ):
                raise ValueError("Chiều rộng srcset xung đột: " + variant["src"])
            outputs[variant["src"]] = variant["width"]
        for src, width in outputs.items():
            if type(width) is not int or not 1 <= width <= 8192:
                raise ValueError("Chiều rộng story không hợp lệ: " + str(width))
            add(src, width=width, source_name=source_name)
    # Cover custom images too; no configured optimized asset may disappear.
    for value in image_references(info):
        relative = local_path(value).relative_to("images/optimized")
        if relative not in plan:
            add(value, copy=True)
    return plan


def source_label(rule):
    suffix = "" if rule["exact"] else ".{jpg,jpeg,png,webp,avif,gif,bmp,tif,tiff}"
    return "images/original/assets/" + rule["source"].as_posix() + suffix


def required_sources(plan):
    return sorted({source_label(rule) for rule in plan.values()})


def resolve_source(root, rule):
    folder = root / "images/original/assets"
    expected = rule["source"]
    parent = folder / expected.parent
    matches = []
    if parent.is_dir():
        for item in parent.iterdir():
            match = (
                item.name == expected.name
                if rule["exact"]
                else (
                    item.stem == expected.name
                    and item.suffix.lower() in SUPPORTED_EXTENSIONS
                )
            )
            if match and item.is_file():
                if item.is_symlink() or not item.resolve().is_relative_to(
                    folder.resolve()
                ):
                    raise ValueError("Không dùng symlink cho ảnh gốc: " + str(item))
                matches.append(item)
    if len(matches) != 1:
        detail = "Thiếu" if not matches else "Trùng tên (chỉ giữ một định dạng)"
        raise ValueError(detail + ": " + source_label(rule))
    return matches[0]


def inspect_image(path):
    if path.suffix.lower() == ".svg":
        root = ET.parse(path).getroot()
        if root.tag.split("}")[-1] != "svg":
            raise ValueError("File không phải SVG: " + str(path))
        return None
    with Image.open(path) as image:
        image.verify()
    with Image.open(path) as image:
        image = ImageOps.exif_transpose(image)
        image.load()
        return image.size


def natural_key(value):
    return [
        int(part) if part.isdigit() else part.casefold()
        for part in re.split(r"(\d+)", str(value))
    ]


def preflight(root, info, manifest, plan, progress=None):
    progress = progress or Progress()
    progress.log("Bước 1/4 — Kiểm tra đầu vào")
    errors = []
    resolved = {}
    sizes = {}
    for index, (output, rule) in enumerate(plan.items(), 1):
        progress.log(f"Ảnh cấu hình [{index}/{len(plan)}]: {source_label(rule)}")
        try:
            source = resolve_source(root, rule)
            if source not in sizes:
                sizes[source] = inspect_image(source)
            if not rule["copy"] and sizes[source] is None:
                raise ValueError("Cần ảnh raster: " + str(source))
            if rule["width"] and sizes[source][0] < rule["width"]:
                raise ValueError(
                    f"Ảnh {source.name} cần chiều rộng ít nhất {rule['width']} px sau xoay EXIF"
                )
            if not rule["copy"] and output.suffix.lower() != ".webp":
                raise ValueError("Ảnh tối ưu phải có đuôi .webp: " + str(output))
            resolved[output] = source
        except (OSError, ValueError, SyntaxError) as error:
            errors.append(str(error))
    # Validate static artwork, but never encode, copy, or publish it here.
    for value in sorted(set(image_references(info, "images/static/"))):
        progress.log("Kiểm tra ảnh tĩnh: " + value)
        try:
            relative = local_path(value)
            path = root / relative
            if not path.is_file():
                raise ValueError("Thiếu ảnh tĩnh: " + relative.as_posix())
            if path.is_symlink() or not path.resolve().is_relative_to(
                (root / "images/static").resolve()
            ):
                raise ValueError("Không dùng symlink cho ảnh tĩnh: " + str(path))
            inspect_image(path)
        except (OSError, ValueError, SyntaxError) as error:
            errors.append(str(error))
    # Favicons are built separately; require their configured templates to exist.
    for party in info["parties"].values():
        path = local_path(party["images"]["favicon"])
        if path is not None and not (root / path).is_file():
            errors.append("Thiếu favicon template: " + str(path))
    album_root = root / "images/original/album"
    album = []
    targets = set()
    progress.log("Đang quét thư mục ảnh album...")
    candidates = [
        path
        for path in sorted(
            album_root.rglob("*"), key=lambda p: natural_key(p.relative_to(album_root))
        )
        if path.is_file() and not any(
            part.startswith(".") for part in path.relative_to(album_root).parts
        )
    ]
    for index, path in enumerate(candidates, 1):
        progress.log(
            f"Kiểm tra album [{index}/{len(candidates)}]: {path.relative_to(album_root)}"
        )
        try:
            if path.is_symlink() or not path.resolve().is_relative_to(
                album_root.resolve()
            ):
                raise ValueError("Không dùng symlink cho ảnh album: " + str(path))
            if path.suffix.lower() not in SUPPORTED_EXTENSIONS:
                raise ValueError("Định dạng album không hỗ trợ: " + str(path))
            inspect_image(path)
            target = (path.relative_to(album_root).as_posix() + ".webp").casefold()
            if target in targets:
                raise ValueError("Tên ảnh album trùng trên Windows: " + str(path))
            targets.add(target)
            album.append(path)
        except (OSError, ValueError, SyntaxError) as error:
            errors.append(str(error))
    if not album:
        errors.append(
            "images/original/album/ phải có ít nhất một ảnh; không xóa album khi đầu vào rỗng."
        )
    if manifest.get("mode") != "replace":
        errors.append(
            'images/manifest.json: mode phải là "replace"; append không còn được hỗ trợ.'
        )
    if not isinstance(manifest.get("shuffle"), bool) or not isinstance(
        manifest.get("photos"), list
    ):
        errors.append("Manifest cần shuffle boolean và photos array.")
    optimization = manifest.get("optimization", {})
    for key, low, high in (("maxSide", 160, 4096), ("quality", 1, 100)):
        value = optimization.get(key)
        if type(value) is not int or not low <= value <= high:
            errors.append(f"optimization.{key} phải từ {low} đến {high}.")
    if errors:
        raise ValueError(
            "Kiểm tra đầu vào thất bại:\n- " + "\n- ".join(dict.fromkeys(errors))
        )
    progress.log(
        f"Kiểm tra xong: {len(set(resolved.values()))} ảnh gốc, {len(album)} ảnh album; ảnh tĩnh hợp lệ."
    )
    return resolved, album


def encode(source, target, *, quality, max_side=None, width=None):
    target.parent.mkdir(parents=True, exist_ok=True)
    with Image.open(source) as original:
        image = ImageOps.exif_transpose(original)
        if width:
            image = image.resize(
                (width, max(1, round(image.height * width / image.width))),
                Image.Resampling.LANCZOS,
            )
        else:
            image.thumbnail((max_side, max_side), Image.Resampling.LANCZOS)
        # Preserve alpha for gate/lock artwork; never flatten onto a dark square.
        alpha = image.mode in ("RGBA", "LA") or "transparency" in image.info
        image = image.convert("RGBA" if alpha else "RGB")
        image.save(target, "WEBP", quality=quality, method=6)
        return image.size


def publish(root, stage):
    """Replace generated files only, with rollback on publication errors."""
    optimized = root / "images/optimized"
    manifest = root / "images/manifest.json"
    backup = stage / "previous-optimized"
    had_previous = optimized.exists()
    if had_previous:
        os.replace(optimized, backup)
    try:
        os.replace(stage / "optimized", optimized)
        os.replace(stage / "manifest.json", manifest)
    except BaseException:
        if optimized.exists():
            shutil.rmtree(optimized)
        if had_previous:
            os.replace(backup, optimized)
        raise


def rebuild(root=ROOT, *, check=False, progress=None):
    progress = progress or Progress()
    progress.log("Bắt đầu kiểm tra ảnh" if check else "Bắt đầu tạo lại bộ ảnh")
    root = Path(root)
    image_root = root / "images"
    # Refuse concurrent writers and symlinked generated destinations.
    for path in (image_root, image_root / "optimized", image_root / "manifest.json"):
        if path.is_symlink():
            raise ValueError("Không dùng symlink cho đầu ra: " + str(path))
    lock = image_root / ".gallery.lock"
    try:
        descriptor = os.open(lock, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    except FileExistsError:
        raise ValueError(
            "Đang có tiến trình tạo ảnh (.gallery.lock). Nếu tiến trình trước bị dừng đột ngột, kiểm tra rồi xóa lock để chạy lại."
        ) from None
    os.close(descriptor)
    try:
        info = read_wedding_info(root)
        manifest = json.loads(
            (image_root / "manifest.json").read_text(encoding="utf-8")
        )
        plan = asset_plan(info)
        resolved, album = preflight(root, info, manifest, plan, progress)
        if check:
            progress.log("HOÀN TẤT kiểm tra — chưa thay đổi bộ ảnh đang dùng.")
            return
        with tempfile.TemporaryDirectory(
            prefix=".gallery-build-", dir=image_root
        ) as temporary:
            stage = Path(temporary)
            progress.log("Bước 2/4 — Tạo ảnh cấu hình và các kích thước responsive")
            for index, (output, rule) in enumerate(plan.items(), 1):
                target = stage / "optimized" / output
                target.parent.mkdir(parents=True, exist_ok=True)
                if rule["copy"]:
                    progress.run(
                        output.as_posix(),
                        shutil.copyfile,
                        resolved[output],
                        target,
                        index=index,
                        total=len(plan),
                    )
                else:
                    progress.run(
                        output.as_posix(),
                        encode,
                        resolved[output],
                        target,
                        quality=84,
                        index=index,
                        total=len(plan),
                        max_side=rule["max_side"],
                        width=rule["width"],
                    )
            from scripts.portrait_focus import generate_focus

            progress.log("Đang phân tích khuôn mặt để căn khung chân dung...")
            generate_focus(stage / "optimized", info)
            progress.log("Đã căn khung chân dung.")
            previous = {
                item.get("src"): item
                for item in manifest["photos"]
                if isinstance(item, dict)
            }
            photos = []
            progress.log("Bước 3/4 — Tối ưu ảnh album")
            for index, source in enumerate(album, 1):
                relative = source.relative_to(root / "images/original/album")
                output = Path("album") / relative.parent / (relative.name + ".webp")
                target = stage / "optimized" / output
                width, height = progress.run(
                    relative.as_posix(),
                    encode,
                    source,
                    target,
                    index=index,
                    total=len(album),
                    quality=manifest["optimization"]["quality"],
                    max_side=manifest["optimization"]["maxSide"],
                )
                src = quote("images/optimized/" + output.as_posix(), safe="/")
                photo = {
                    "src": src,
                    "name": source.stem.replace("_", " ").replace("-", " ").strip(),
                    "v": hashlib.sha256(target.read_bytes()).hexdigest()[:12],
                    "width": width,
                    "height": height,
                }
                # Keep authored captions only for photos still present in originals.
                if "caption" in previous.get(src, {}):
                    photo["caption"] = previous[src]["caption"]
                photos.append(photo)
            progress.log("Bước 4/4 — Ghi manifest và thay bộ ảnh đã tạo")
            manifest["photos"] = photos
            manifest["total"] = len(photos)
            (stage / "manifest.json").write_text(
                json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
                encoding="utf-8",
            )
            publish(root, stage)
        progress.log(
            f"HOÀN TẤT: {len(plan)} tài nguyên, {len(photos)} ảnh album. Đã cập nhật images/optimized/ và manifest."
        )
    finally:
        lock.unlink()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    group = parser.add_mutually_exclusive_group()
    group.add_argument(
        "--check",
        action="store_true",
        help="Chỉ kiểm tra đầy đủ đầu vào; không thay đầu ra",
    )
    group.add_argument(
        "--list-required",
        action="store_true",
        help="Liệt kê chính xác tên ảnh bắt buộc từ config",
    )
    args = parser.parse_args()
    try:
        if args.list_required:
            print("\n".join(required_sources(asset_plan(read_wedding_info(ROOT)))))
        else:
            rebuild(check=args.check)
    except (OSError, ValueError, SyntaxError, KeyError, TypeError) as error:
        print("FAILED: " + str(error), file=sys.stderr, flush=True)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
