import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Send } from "lucide-react";
import ActionBar from "../components/ActionBar.jsx";
import StepHeader from "../components/StepHeader.jsx";
import { useVerification } from "../context/VerificationContext.jsx";
import { getVerificationStatus, mapServerState, submitVerification } from "../services/verificationApi.js";

function PreviewTile({ title, image }) {
  return (
    <article className="preview-tile">
      <h3>{title}</h3>
      <div className="preview-frame">
        {image?.previewUrl ? <img src={image.previewUrl} alt={`${title} preview`} /> : <span>Missing</span>}
      </div>
    </article>
  );
}

function StatusTile({ title, children }) {
  return (
    <article className="preview-tile status-tile">
      <h3>{title}</h3>
      {children}
    </article>
  );
}

export default function ReviewPage() {
  const navigate = useNavigate();
  const { state, updateVerification } = useVerification();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!state.sessionId) return undefined;

    let mounted = true;
    const refreshStatus = async () => {
      try {
        const status = await getVerificationStatus(state.sessionId);
        if (mounted) {
          updateVerification(mapServerState(status));
        }
      } catch {
        // Keep the review page usable even if a poll misses while the backend is starting.
      }
    };

    refreshStatus();
    const interval = window.setInterval(refreshStatus, 2500);
    return () => {
      mounted = false;
      window.clearInterval(interval);
    };
  }, [state.sessionId]);

  const submit = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await submitVerification(state.sessionId);
      updateVerification(mapServerState(result));
      navigate("/result");
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="page fade-in">
      <div className="shell">
        <StepHeader currentStep={4} title="Review" />
        <section className="panel">
          <div className="section-heading">
            <h2>Review & Submit</h2>
            <p>Queued extraction and matching can finish here if the backend is still processing.</p>
          </div>
          <div className="review-grid">
            <PreviewTile title="ID Front" image={state.idFront} />
            <PreviewTile title="ID Back" image={state.idBack} />
            <PreviewTile title="Face Capture" image={state.faceImage} />
            <PreviewTile title="Liveness Frame" image={state.livenessFrame} />
            <StatusTile title="ID face extraction">
              <p className="status-value">{state.extractionStatus || "NOT_STARTED"}</p>
            </StatusTile>
            <StatusTile title="Face match">
              <p className="status-value">{state.faceMatchStatus || "NOT_STARTED"}</p>
              {state.faceMatchScore !== null && <p className="muted-line">Score: {state.faceMatchScore}</p>}
            </StatusTile>
            <StatusTile title="Liveness status">
              <p className="status-text verified">{state.livenessStatus === "verified" ? "Verified" : "Not complete"}</p>
            </StatusTile>
            <StatusTile title="Session">
              <p className="muted-line break-text">{state.sessionId}</p>
            </StatusTile>
          </div>
          {error && <p className="error-line">{error}</p>}
          <ActionBar
            onBack={() => navigate("/liveness")}
            onNext={submit}
            nextLabel="Submit for Verification"
            loading={loading}
          />
          <div className="submit-note">
            <Send size={16} /> Submit waits for queued extraction and matching if needed
          </div>
        </section>
      </div>
    </main>
  );
}

