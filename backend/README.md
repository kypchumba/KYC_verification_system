# KYC Verification Backend

FastAPI backend for a strict step-by-step KYC verification flow with queued local processing for ID face extraction, selfie matching, and liveness evidence capture.

## Local SQLite Setup

SQLite is the fastest local option and does not require installing PostgreSQL.

```powershell
cd C:\Users\hp\Documents\KYC
```

Use this `.env` for local development:

```env
DATABASE_URL=sqlite:///./kyc_dev.db
UPLOADS_DIR=uploads
CORS_ORIGINS=["http://127.0.0.1:5173","http://localhost:5173"]
```

Run the backend:

```powershell
.\.venv\Scripts\uvicorn app.main:app --host 127.0.0.1 --port 8000 --app-dir backend
```

Check it:

```powershell
Invoke-WebRequest http://127.0.0.1:8000/health
```

## PostgreSQL Setup Later

When you are ready for PostgreSQL, update `.env`:

```env
DATABASE_URL=postgresql+psycopg://postgres:YOUR_URL_ENCODED_PASSWORD@localhost:5432/kyc
UPLOADS_DIR=uploads
CORS_ORIGINS=["http://127.0.0.1:5173","http://localhost:5173"]
```

Create the database, then start the same Uvicorn command. URL-encode special password characters; for example, `@` becomes `%40`.

## Flow

1. `POST /start-session`
2. `POST /upload-id` with multipart fields: `session_id`, `id_front`, `id_back`
   - Saves files in `uploads/{session_id}/`
   - Queues ID face extraction to `uploads/{session_id}/id_face.jpg`
3. `POST /upload-face` with multipart fields: `session_id`, `face_image`
   - Saves the selfie as `uploads/{session_id}/face.jpg`
   - Queues face matching against the extracted ID face
4. Active liveness runs over `WS /liveness-stream/{session_id}` with continuous JPEG frames from the webcam. The backend randomly selects timed challenges and records `uploads/{session_id}/liveness.json` only after all selected challenges pass.
5. `POST /submit` with JSON `{ "session_id": "..." }`
   - Finalizes queued extraction/matching work before deciding `VERIFIED`, `REVIEW`, or `REJECTED`
6. `GET /status/{session_id}`

## Active Liveness CLI

Install the updated Python dependencies, then run the local OpenCV implementation directly from the project root:

```powershell
.\.venv\Scripts\python backend\scripts\run_active_liveness.py --challenges 3
```

The same detector powers the web flow. It evaluates every frame with MediaPipe FaceMesh landmarks, passes each challenge immediately when the requested action is detected, and fails if the active challenge expires.
## Frontend API URL

The React app calls `http://127.0.0.1:8000` by default. Override it with `VITE_API_BASE_URL` if needed.

## Biometric Engine Note

`backend/app/services/biometrics.py` is a local development engine. It performs real image crop and fingerprint comparison with Pillow, but it is not a production biometric model. Replace it with OCR, face detection, face embedding, and liveness ML services before handling real identity decisions.
