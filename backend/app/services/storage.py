import shutil
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

    def delete_session_uploads(self, session_id: UUID) -> bool:
        uploads_root = self.uploads_dir.resolve()
        directory = (uploads_root / str(session_id)).resolve()

        try:
            directory.relative_to(uploads_root)
        except ValueError as exc:
            raise ValueError("Invalid upload cleanup path") from exc

        if not directory.exists():
            return False
        if not directory.is_dir():
            raise ValueError("Upload cleanup path is not a directory")

        shutil.rmtree(directory)
        return True

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
