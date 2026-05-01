from pathlib import Path
from PIL import Image, ImageOps


class BiometricEngine:
    """Local development biometric engine.

    This provides a real image-processing pipeline for the prototype: it crops a
    face candidate from the ID image and compares compact grayscale fingerprints.
    Replace this class with OCR/face-recognition/liveness ML services before any
    production identity decisioning.
    """

    def extract_face_from_id(self, id_front_path: str, output_path: str) -> str:
        source = Path(id_front_path)
        destination = Path(output_path)
        destination.parent.mkdir(parents=True, exist_ok=True)

        with Image.open(source) as image:
            normalized = ImageOps.exif_transpose(image).convert("RGB")
            face_crop = self._crop_face_candidate(normalized)
            face_crop.save(destination, format="JPEG", quality=92)

        return destination.as_posix()

    def compare_faces(self, id_face_path: str, captured_face_path: str) -> tuple[int, bool]:
        id_vector = self._fingerprint(id_face_path)
        captured_vector = self._fingerprint(captured_face_path)
        if len(id_vector) != len(captured_vector):
            return 0, False

        total_delta = sum(abs(a - b) for a, b in zip(id_vector, captured_vector))
        max_delta = 255 * len(id_vector)
        score = max(0, min(100, round(100 - ((total_delta / max_delta) * 100))))
        return score, score >= 72

    def _crop_face_candidate(self, image: Image.Image) -> Image.Image:
        width, height = image.size
        short_side = min(width, height)
        crop_size = int(short_side * 0.58)

        if width >= height:
            center_x = int(width * 0.32)
            center_y = int(height * 0.48)
        else:
            center_x = int(width * 0.5)
            center_y = int(height * 0.38)

        left = max(0, center_x - crop_size // 2)
        top = max(0, center_y - crop_size // 2)
        right = min(width, left + crop_size)
        bottom = min(height, top + crop_size)

        if right - left < crop_size:
            left = max(0, right - crop_size)
        if bottom - top < crop_size:
            top = max(0, bottom - crop_size)

        return image.crop((left, top, right, bottom)).resize((320, 320))

    def _fingerprint(self, image_path: str) -> list[int]:
        with Image.open(image_path) as image:
            normalized = ImageOps.exif_transpose(image).convert("L").resize((24, 24))
            return list(normalized.getdata())
