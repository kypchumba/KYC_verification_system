from pathlib import Path
from uuid import UUID
from fastapi import UploadFile
from app.config import get_settings

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/jpg"}


class StorageService:
    def __init__(self, uploads_dir: Path | None = None) -> None:
        self.uploads_dir = Path(uploads_dir or get_settings().uploads_dir)

    def session_dir(self, session_id: UUID) -> Path:
        directory = self.uploads_dir / str(session_id)
        directory.mkdir(parents=True, exist_ok=True)
        return directory

    async def save_upload(self, session_id: UUID, upload: UploadFile, filename: str) -> str:
        if upload.content_type not in ALLOWED_IMAGE_TYPES:
            raise ValueError("Only PNG and JPEG image uploads are supported")

        destination = self.session_dir(session_id) / filename
        contents = await upload.read()
        if not contents:
            raise ValueError("Uploaded file is empty")

        destination.write_bytes(contents)
        await upload.close()
        return destination.as_posix()
