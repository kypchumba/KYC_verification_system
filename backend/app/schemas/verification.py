from datetime import datetime
from enum import Enum
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field


class VerificationStatusSchema(str, Enum):
    STARTED = "STARTED"
    IN_PROGRESS = "IN_PROGRESS"
    VERIFIED = "VERIFIED"
    REJECTED = "REJECTED"
    REVIEW = "REVIEW"


class ProcessingStatusSchema(str, Enum):
    NOT_STARTED = "NOT_STARTED"
    QUEUED = "QUEUED"
    PROCESSING = "PROCESSING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class SessionIdRequest(BaseModel):
    session_id: UUID = Field(..., description="Verification session UUID")


class StartSessionResponse(BaseModel):
    session_id: UUID
    status: VerificationStatusSchema
    current_step: int


class StepResponse(BaseModel):
    session_id: UUID
    status: VerificationStatusSchema
    current_step: int
    message: str
    extraction_status: ProcessingStatusSchema | None = None
    face_match_status: ProcessingStatusSchema | None = None
    face_match_score: int | None = None
    face_match_passed: bool | None = None
    liveness_status: ProcessingStatusSchema | None = None
    liveness_passed: bool | None = None
    risk_score: int | None = None


class UploadCleanupResponse(BaseModel):
    session_id: UUID
    uploads_deleted: bool
    message: str


class VerificationStatusResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    session_id: UUID
    status: VerificationStatusSchema
    current_step: int
    id_front_path: str | None = None
    id_back_path: str | None = None
    extracted_face_path: str | None = None
    extraction_status: ProcessingStatusSchema
    extraction_error: str | None = None
    face_image_path: str | None = None
    face_match_status: ProcessingStatusSchema
    face_match_score: int | None = None
    face_match_passed: bool
    face_match_error: str | None = None
    liveness_artifact_path: str | None = None
    liveness_status: ProcessingStatusSchema
    liveness_passed: bool
    liveness_error: str | None = None
    risk_score: int | None = None
    created_at: datetime
    updated_at: datetime
