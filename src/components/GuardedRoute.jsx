import { Navigate } from "react-router-dom";
import { useVerification } from "../context/VerificationContext.jsx";

const fallbackByStep = {
  idUpload: "/",
  faceCapture: "/upload-id",
  liveness: "/face-capture",
  review: "/liveness",
  result: "/review",
};

export default function GuardedRoute({ step, children }) {
  const { state } = useVerification();

  const canAccess = {
    idUpload: state.started && Boolean(state.sessionId),
    faceCapture: state.started && Boolean(state.sessionId && state.idFront && state.idBack),
    liveness: state.started && Boolean(state.sessionId && state.idFront && state.idBack && state.faceImage),
    review:
      state.started &&
      Boolean(state.sessionId && state.idFront && state.idBack && state.faceImage) &&
      state.livenessStatus === "verified",
    result: Boolean(state.sessionId && state.verificationStatus),
  };

  if (!canAccess[step]) {
    return <Navigate to={fallbackByStep[step] || "/"} replace />;
  }

  return children;
}
