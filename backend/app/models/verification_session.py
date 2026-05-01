import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import Optional
from sqlalchemy import Boolean, DateTime, Integer, Text, Uuid
from sqlalchemy import Enum as SqlEnum
from sqlalchemy.orm import Mapped, mapped_column
from app.database.base import Base


class VerificationStatus(str, Enum):
    STARTED = "STARTED"
    IN_PROGRESS = "IN_PROGRESS"
    VERIFIED = "VERIFIED"
    REJECTED = "REJECTED"
    REVIEW = "REVIEW"


class ProcessingStatus(str, Enum):
    NOT_STARTED = "NOT_STARTED"
    QUEUED = "QUEUED"
    PROCESSING = "PROCESSING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class VerificationSession(Base):
    __tablename__ = "users_verification_sessions"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    status: Mapped[VerificationStatus] = mapped_column(
        SqlEnum(VerificationStatus, name="verification_status"),
        nullable=False,
        default=VerificationStatus.STARTED,
        index=True,
    )
    current_step: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    id_front_path: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    id_back_path: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    extracted_face_path: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    extraction_status: Mapped[str] = mapped_column(Text, nullable=False, default=ProcessingStatus.NOT_STARTED.value)
    extraction_error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    face_image_path: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    face_match_status: Mapped[str] = mapped_column(Text, nullable=False, default=ProcessingStatus.NOT_STARTED.value)
    face_match_score: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    face_match_passed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    face_match_error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    liveness_artifact_path: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    liveness_status: Mapped[str] = mapped_column(Text, nullable=False, default=ProcessingStatus.NOT_STARTED.value)
    liveness_passed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    liveness_error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    risk_score: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=utc_now,
        onupdate=utc_now,
    )
