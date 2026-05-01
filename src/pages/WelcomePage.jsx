import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { useVerification } from "../context/VerificationContext.jsx";
import { startSession } from "../services/verificationApi.js";

export default function WelcomePage() {
  const navigate = useNavigate();
  const { resetVerification, updateVerification } = useVerification();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const startVerification = async () => {
    setLoading(true);
    setError("");
    try {
      const session = await startSession();
      resetVerification();
      updateVerification({
        started: true,
        sessionId: session.session_id,
        backendStatus: session,
      });
      navigate("/upload-id");
    } catch (startError) {
      setError(startError.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="page welcome-page fade-in">
      <section className="welcome-card">
        <div className="welcome-icon" aria-hidden="true">
          <ShieldCheck size={34} />
        </div>
        <h1>Identity Verification</h1>
        <p>Complete verification in a few simple steps</p>
        <button className="button primary large" type="button" onClick={startVerification} disabled={loading}>
          {loading ? <span className="spinner" aria-hidden="true" /> : null}
          {loading ? "Starting" : "Start Verification"}
        </button>
        {error && <p className="error-line">{error}</p>}
      </section>
    </main>
  );
}
