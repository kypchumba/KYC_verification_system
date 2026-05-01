from sqlalchemy import text
from app.database.base import Base
from app.database.session import engine
from app.models import VerificationSession  # noqa: F401

COLUMN_UPGRADES = {
    "extracted_face_path": "TEXT",
    "extraction_status": "TEXT NOT NULL DEFAULT 'NOT_STARTED'",
    "extraction_error": "TEXT",
    "face_match_status": "TEXT NOT NULL DEFAULT 'NOT_STARTED'",
    "face_match_score": "INTEGER",
    "face_match_passed": "BOOLEAN NOT NULL DEFAULT FALSE",
    "face_match_error": "TEXT",
    "liveness_artifact_path": "TEXT",
    "liveness_status": "TEXT NOT NULL DEFAULT 'NOT_STARTED'",
    "liveness_error": "TEXT",
}


def init_db() -> None:
    Base.metadata.create_all(bind=engine)
    if engine.dialect.name != "postgresql":
        return

    with engine.begin() as connection:
        for column_name, column_type in COLUMN_UPGRADES.items():
            connection.execute(
                text(
                    f"ALTER TABLE users_verification_sessions "
                    f"ADD COLUMN IF NOT EXISTS {column_name} {column_type}"
                )
            )
