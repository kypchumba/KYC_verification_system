from uuid import UUID
from app.database.session import SessionLocal
from app.models.verification_session import ProcessingStatus
from app.services.biometrics import BiometricEngine
from app.services.verification import VerificationService

biometric_engine = BiometricEngine()


def run_id_face_extraction(session_id: UUID) -> None:
    with SessionLocal() as db:
        service = VerificationService(db)
        session = service.get_session(session_id)
        if not session.id_front_path:
            service.mark_extraction_failed(session_id, "ID front image is missing")
            return
        if session.extraction_status == ProcessingStatus.COMPLETED.value:
            return

        service.mark_extraction_processing(session_id)
        try:
            destination = session.id_front_path.rsplit("/", 1)[0] + "/id_face.jpg"
            extracted_face_path = biometric_engine.extract_face_from_id(session.id_front_path, destination)
            service.mark_extraction_completed(session_id, extracted_face_path)
        except Exception as exc:  # pragma: no cover - defensive boundary around ML integrations
            service.mark_extraction_failed(session_id, str(exc))


def run_face_match(session_id: UUID) -> None:
    with SessionLocal() as db:
        service = VerificationService(db)
        session = service.get_session(session_id)
        if session.face_match_status == ProcessingStatus.COMPLETED.value:
            return
        if session.extraction_status != ProcessingStatus.COMPLETED.value:
            run_id_face_extraction(session_id)
            db.refresh(session)
        if not session.extracted_face_path or not session.face_image_path:
            service.mark_match_failed(session_id, "Both extracted ID face and captured face are required")
            return

        service.mark_match_processing(session_id)
        try:
            score, passed = biometric_engine.compare_faces(session.extracted_face_path, session.face_image_path)
            service.mark_match_completed(session_id, score, passed)
        except Exception as exc:  # pragma: no cover - defensive boundary around ML integrations
            service.mark_match_failed(session_id, str(exc))


def finalize_pending_processing(session_id: UUID) -> None:
    with SessionLocal() as db:
        service = VerificationService(db)
        session = service.get_session(session_id)
        if session.extraction_status in {ProcessingStatus.NOT_STARTED.value, ProcessingStatus.QUEUED.value, ProcessingStatus.PROCESSING.value}:
            run_id_face_extraction(session_id)
        db.refresh(session)
        if session.face_image_path and session.face_match_status in {
            ProcessingStatus.NOT_STARTED.value,
            ProcessingStatus.QUEUED.value,
            ProcessingStatus.PROCESSING.value,
        }:
            run_face_match(session_id)
