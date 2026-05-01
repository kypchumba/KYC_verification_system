from uuid import UUID
from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, UploadFile, status
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.schemas.verification import SessionIdRequest, StartSessionResponse, StepResponse, VerificationStatusResponse
from app.services.exceptions import VerificationError
from app.services.jobs import finalize_pending_processing, run_face_match, run_id_face_extraction
from app.services.storage import StorageService
from app.services.verification import STEP_UPLOAD_FACE, STEP_UPLOAD_ID, VerificationService

router = APIRouter(tags=["verification"])
storage = StorageService()


def serialize_status(session) -> dict:
    return {
        "session_id": session.id,
        "status": session.status,
        "current_step": session.current_step,
        "id_front_path": session.id_front_path,
        "id_back_path": session.id_back_path,
        "extracted_face_path": session.extracted_face_path,
        "extraction_status": session.extraction_status,
        "extraction_error": session.extraction_error,
        "face_image_path": session.face_image_path,
        "face_match_status": session.face_match_status,
        "face_match_score": session.face_match_score,
        "face_match_passed": session.face_match_passed,
        "face_match_error": session.face_match_error,
        "liveness_artifact_path": session.liveness_artifact_path,
        "liveness_status": session.liveness_status,
        "liveness_passed": session.liveness_passed,
        "liveness_error": session.liveness_error,
        "risk_score": session.risk_score,
        "created_at": session.created_at,
        "updated_at": session.updated_at,
    }


def serialize_step(session, message: str) -> dict:
    return {
        "session_id": session.id,
        "status": session.status,
        "current_step": session.current_step,
        "message": message,
        "extraction_status": session.extraction_status,
        "face_match_status": session.face_match_status,
        "face_match_score": session.face_match_score,
        "face_match_passed": session.face_match_passed,
        "liveness_status": session.liveness_status,
        "risk_score": session.risk_score,
    }


@router.post("/start-session", response_model=StartSessionResponse, status_code=status.HTTP_201_CREATED)
def start_session(db: Session = Depends(get_db)):
    session = VerificationService(db).start_session()
    return {
        "session_id": session.id,
        "status": session.status,
        "current_step": session.current_step,
    }


@router.post("/upload-id", response_model=StepResponse)
async def upload_id(
    background_tasks: BackgroundTasks,
    session_id: UUID = Form(...),
    id_front: UploadFile = File(...),
    id_back: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    service = VerificationService(db)
    session = service.get_session(session_id)
    service.require_step(session, STEP_UPLOAD_ID)

    id_front_path = await storage.save_upload(session_id, id_front, "id_front.jpg")
    id_back_path = await storage.save_upload(session_id, id_back, "id_back.jpg")
    session = service.record_id_upload(session_id, id_front_path, id_back_path)
    background_tasks.add_task(run_id_face_extraction, session.id)
    return serialize_step(session, "ID uploaded. Face extraction queued.")


@router.post("/upload-face", response_model=StepResponse)
async def upload_face(
    background_tasks: BackgroundTasks,
    session_id: UUID = Form(...),
    face_image: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    service = VerificationService(db)
    session = service.get_session(session_id)
    service.require_step(session, STEP_UPLOAD_FACE)
    if not session.id_front_path or not session.id_back_path:
        raise VerificationError("ID upload must be completed first")

    face_image_path = await storage.save_upload(session_id, face_image, "face.jpg")
    session = service.record_face_upload(session_id, face_image_path)
    background_tasks.add_task(run_face_match, session.id)
    return serialize_step(session, "Face image uploaded. Face matching queued.")


@router.post("/liveness-check", response_model=StepResponse)
async def liveness_check(
    session_id: UUID = Form(...),
    liveness_image: UploadFile | None = File(None),
    db: Session = Depends(get_db),
):
    liveness_path = None
    if liveness_image is not None:
        liveness_path = await storage.save_upload(session_id, liveness_image, "liveness.jpg")
    session = VerificationService(db).record_liveness(session_id, liveness_path)
    return serialize_step(session, "Liveness prompts completed")


@router.post("/submit", response_model=StepResponse)
def submit_verification(payload: SessionIdRequest, db: Session = Depends(get_db)):
    finalize_pending_processing(payload.session_id)
    db.expire_all()
    session = VerificationService(db).submit(payload.session_id)
    return serialize_step(session, "Verification submitted")


@router.get("/status/{session_id}", response_model=VerificationStatusResponse)
def get_status(session_id: UUID, db: Session = Depends(get_db)):
    session = VerificationService(db).get_session(session_id)
    return serialize_status(session)
