from uuid import UUID
from sqlalchemy.orm import Session
from app.models.verification_session import ProcessingStatus, VerificationSession, VerificationStatus
from app.services.exceptions import VerificationError

STEP_UPLOAD_ID = 1
STEP_UPLOAD_FACE = 2
STEP_LIVENESS = 3
STEP_SUBMIT = 4
STEP_COMPLETE = 5


class VerificationService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def start_session(self) -> VerificationSession:
        session = VerificationSession(status=VerificationStatus.STARTED, current_step=STEP_UPLOAD_ID)
        self.db.add(session)
        self.db.commit()
        self.db.refresh(session)
        return session

    def get_session(self, session_id: UUID) -> VerificationSession:
        session = self.db.get(VerificationSession, session_id)
        if session is None:
            raise VerificationError("Verification session not found", status_code=404)
        return session

    def require_step(self, session: VerificationSession, expected_step: int) -> None:
        if session.current_step != expected_step:
            raise VerificationError("Invalid step progression")

    def record_id_upload(self, session_id: UUID, id_front_path: str, id_back_path: str) -> VerificationSession:
        session = self.get_session(session_id)
        self.require_step(session, STEP_UPLOAD_ID)
        session.id_front_path = id_front_path
        session.id_back_path = id_back_path
        session.extracted_face_path = None
        session.extraction_status = ProcessingStatus.QUEUED.value
        session.extraction_error = None
        session.current_step = STEP_UPLOAD_FACE
        session.status = VerificationStatus.IN_PROGRESS
        self.db.commit()
        self.db.refresh(session)
        return session

    def record_face_upload(self, session_id: UUID, face_image_path: str) -> VerificationSession:
        session = self.get_session(session_id)
        self.require_step(session, STEP_UPLOAD_FACE)
        if not session.id_front_path or not session.id_back_path:
            raise VerificationError("ID upload must be completed first")
        session.face_image_path = face_image_path
        session.face_match_status = ProcessingStatus.QUEUED.value
        session.face_match_error = None
        session.face_match_score = None
        session.face_match_passed = False
        session.current_step = STEP_LIVENESS
        session.status = VerificationStatus.IN_PROGRESS
        self.db.commit()
        self.db.refresh(session)
        return session

    def record_liveness(self, session_id: UUID, liveness_artifact_path: str | None = None) -> VerificationSession:
        return self.record_liveness_passed(session_id, liveness_artifact_path)

    def record_liveness_passed(self, session_id: UUID, liveness_artifact_path: str | None = None) -> VerificationSession:
        session = self.get_session(session_id)
        self.require_step(session, STEP_LIVENESS)
        if not session.face_image_path:
            raise VerificationError("Face capture must be completed first")
        session.liveness_artifact_path = liveness_artifact_path
        session.liveness_status = ProcessingStatus.COMPLETED.value
        session.liveness_error = None
        session.liveness_passed = True
        session.current_step = STEP_SUBMIT
        session.status = VerificationStatus.IN_PROGRESS
        self.db.commit()
        self.db.refresh(session)
        return session

    def record_liveness_failed(self, session_id: UUID, error: str) -> VerificationSession:
        session = self.get_session(session_id)
        self.require_step(session, STEP_LIVENESS)
        if not session.face_image_path:
            raise VerificationError("Face capture must be completed first")
        session.liveness_artifact_path = None
        session.liveness_status = ProcessingStatus.FAILED.value
        session.liveness_error = error
        session.liveness_passed = False
        session.current_step = STEP_LIVENESS
        session.status = VerificationStatus.IN_PROGRESS
        self.db.commit()
        self.db.refresh(session)
        return session

    def mark_extraction_processing(self, session_id: UUID) -> VerificationSession:
        session = self.get_session(session_id)
        session.extraction_status = ProcessingStatus.PROCESSING.value
        session.extraction_error = None
        self.db.commit()
        self.db.refresh(session)
        return session

    def mark_extraction_completed(self, session_id: UUID, extracted_face_path: str) -> VerificationSession:
        session = self.get_session(session_id)
        session.extracted_face_path = extracted_face_path
        session.extraction_status = ProcessingStatus.COMPLETED.value
        session.extraction_error = None
        self.db.commit()
        self.db.refresh(session)
        return session

    def mark_extraction_failed(self, session_id: UUID, error: str) -> VerificationSession:
        session = self.get_session(session_id)
        session.extraction_status = ProcessingStatus.FAILED.value
        session.extraction_error = error
        self.db.commit()
        self.db.refresh(session)
        return session

    def mark_match_processing(self, session_id: UUID) -> VerificationSession:
        session = self.get_session(session_id)
        session.face_match_status = ProcessingStatus.PROCESSING.value
        session.face_match_error = None
        self.db.commit()
        self.db.refresh(session)
        return session

    def mark_match_completed(self, session_id: UUID, score: int, passed: bool) -> VerificationSession:
        session = self.get_session(session_id)
        session.face_match_score = score
        session.face_match_passed = passed
        session.face_match_status = ProcessingStatus.COMPLETED.value
        session.face_match_error = None
        self.db.commit()
        self.db.refresh(session)
        return session

    def mark_match_failed(self, session_id: UUID, error: str) -> VerificationSession:
        session = self.get_session(session_id)
        session.face_match_status = ProcessingStatus.FAILED.value
        session.face_match_error = error
        self.db.commit()
        self.db.refresh(session)
        return session

    def submit(self, session_id: UUID) -> VerificationSession:
        session = self.get_session(session_id)
        self.require_step(session, STEP_SUBMIT)
        score = self.calculate_risk_score(session)
        session.risk_score = score
        session.status = self.decide_status(session, score)
        session.current_step = STEP_COMPLETE
        self.db.commit()
        self.db.refresh(session)
        return session

    def clear_upload_references(self, session_id: UUID) -> VerificationSession:
        session = self.get_session(session_id)
        if session.current_step != STEP_COMPLETE:
            raise VerificationError("Verification must be completed before uploads can be deleted")

        session.id_front_path = None
        session.id_back_path = None
        session.extracted_face_path = None
        session.face_image_path = None
        session.liveness_artifact_path = None
        self.db.commit()
        self.db.refresh(session)
        return session

    @staticmethod
    def calculate_risk_score(session: VerificationSession) -> int:
        score = 0
        if session.id_front_path and session.id_back_path and session.extracted_face_path:
            score += 20
        if session.face_image_path:
            score += 20
        if session.liveness_passed:
            score += 20
        if session.face_match_passed:
            score += 40
        return score

    @staticmethod
    def decide_status(session: VerificationSession, score: int) -> VerificationStatus:
        if session.extraction_status != ProcessingStatus.COMPLETED.value:
            return VerificationStatus.REVIEW
        if session.face_match_status != ProcessingStatus.COMPLETED.value:
            return VerificationStatus.REVIEW
        if not session.face_match_passed:
            return VerificationStatus.REJECTED
        if score >= 80:
            return VerificationStatus.VERIFIED
        if score >= 50:
            return VerificationStatus.REVIEW
        return VerificationStatus.REJECTED
