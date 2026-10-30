"""Offline face bounds; generated metadata is published with the optimized images."""

import hashlib
import json
from pathlib import Path
from urllib.parse import unquote, urlsplit
import warnings

MODEL = Path(__file__).parent / "models/face_detection_yunet_2023mar.onnx"
MODEL_SHA256 = "8f2383e4dd3cfbb4553ea8718107fc0423210dc964f9f4280604804ed2552fa4"


def generate_focus(optimized, info):
    import cv2
    import numpy as np

    if hashlib.sha256(MODEL.read_bytes()).hexdigest() != MODEL_SHA256:
        raise ValueError("YuNet model checksum mismatch")
    paths = sorted(
        {
            party["images"][key]
            for party in info["parties"].values()
            for key in ("portraitMain", "portraitSecondary")
            if party.get("images", {}).get(key)
        }
    )
    result = {"version": 1, "images": {}}
    detector = cv2.FaceDetectorYN.create(str(MODEL), "", (320, 320), 0.85, 0.3, 5000)
    for src in paths:
        parsed = urlsplit(src)
        if parsed.scheme in ("http", "https"):
            warnings.warn("External portrait; using portraitPosition fallback: " + src)
            continue
        relative = Path(unquote(parsed.path))
        if (
            parsed.scheme
            or parsed.netloc
            or relative.is_absolute()
            or ".." in relative.parts
            or relative.parts[:2] != ("images", "optimized")
        ):
            raise ValueError("Unsafe portrait path: " + src)
        path = Path(optimized) / relative.relative_to("images/optimized")
        # imread's filename handling is unreliable for Unicode paths on Windows.
        image = cv2.imdecode(np.fromfile(path, dtype=np.uint8), cv2.IMREAD_COLOR)
        if image is None:
            raise ValueError("Cannot read portrait: " + src)
        height, width = image.shape[:2]
        scale = min(1, 1000 / max(width, height))
        if scale < 1:
            image = cv2.resize(image, (round(width * scale), round(height * scale)))
        h, w = image.shape[:2]
        detector.setInputSize((w, h))
        _, faces = detector.detect(image)
        boxes = (
            []
            if faces is None
            else [
                [
                    round(float(x / w), 6),
                    round(float(y / h), 6),
                    round(float(fw / w), 6),
                    round(float(fh / h), 6),
                ]
                for x, y, fw, fh, *_ in faces
            ]
        )
        if not boxes:
            warnings.warn("No face detected; using portraitPosition fallback: " + src)
        elif len(boxes) > 1:
            warnings.warn("Multiple faces; framing all detected faces: " + src)
        result["images"][src] = {"width": width, "height": height, "faces": boxes}
    target = Path(optimized) / "portrait-focus.json"
    target.write_text(
        json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    return result
