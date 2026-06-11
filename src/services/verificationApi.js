const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000").replace(/\/$/, "");

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, options);
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || data.detail || "Request failed");
  }

  return data;
}

function appendImage(formData, key, image) {
  const file = image?.file || image;
  if (!file) {
    throw new Error(`${key} is required`);
  }
  formData.append(key, file);
}

export function mapServerState(data) {
  return {
    sessionId: data.session_id,
    backendStatus: data,
    extractionStatus: data.extraction_status,
    faceMatchStatus: data.face_match_status,
    faceMatchScore: data.face_match_score,
    faceMatchPassed: data.face_match_passed,
    livenessPassed: data.liveness_passed,
    verificationStatus: data.status === "IN_PROGRESS" || data.status === "STARTED" ? null : data.status,
    riskScore: data.risk_score,
  };
}

export async function startSession() {
  return request("/start-session", { method: "POST" });
}

export async function uploadID({ sessionId, idFront, idBack }) {
  const formData = new FormData();
  formData.append("session_id", sessionId);
  appendImage(formData, "id_front", idFront);
  appendImage(formData, "id_back", idBack);

  return request("/upload-id", {
    method: "POST",
    body: formData,
  });
}

export async function uploadFace({ sessionId, faceImage }) {
  const formData = new FormData();
  formData.append("session_id", sessionId);
  appendImage(formData, "face_image", faceImage);

  return request("/upload-face", {
    method: "POST",
    body: formData,
  });
}

export function createLivenessSocket(sessionId) {
  const socketUrl = new URL(API_BASE_URL);
  socketUrl.protocol = socketUrl.protocol === "https:" ? "wss:" : "ws:";
  const basePath = socketUrl.pathname.replace(/\/$/, "");
  socketUrl.pathname = `${basePath}/liveness-stream/${sessionId}`;
  socketUrl.search = "";
  return new WebSocket(socketUrl.toString());
}


export async function submitVerification(sessionId) {
  return request("/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: sessionId }),
  });
}

export async function cleanupVerificationUploads(sessionId) {
  return request("/cleanup-uploads", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: sessionId }),
  });
}

export async function getVerificationStatus(sessionId) {
  return request(`/status/${sessionId}`);
}
