import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, Play, RotateCcw, ScanFace } from "lucide-react";
import ActionBar from "../components/ActionBar.jsx";
import StepHeader from "../components/StepHeader.jsx";
import { useVerification } from "../context/VerificationContext.jsx";
import { runLiveness } from "../services/verificationApi.js";

const checks = ["Turn your head left", "Show your right hand", "Blink twice"];

export default function LivenessPage() {
  const navigate = useNavigate();
  const { state, updateVerification } = useVerification();
  const [activeCheck, setActiveCheck] = useState(state.livenessStatus === "verified" ? checks.length : 0);
  const [running, setRunning] = useState(false);

  const startCheck = async () => {
    setRunning(true);
    updateVerification({ livenessStatus: "running" });

    for (let index = 0; index < checks.length; index += 1) {
      setActiveCheck(index + 1);
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    const result = await runLiveness();
    updateVerification({ livenessStatus: result.status });
    setActiveCheck(checks.length);
    setRunning(false);
  };

  const verified = state.livenessStatus === "verified";

  return (
    <main className="page fade-in">
      <div className="shell">
        <StepHeader currentStep={3} title="Liveness Check" />
        <section className="panel">
          <div className="liveness-layout">
            <div className="liveness-visual" aria-hidden="true">
              <ScanFace size={76} />
              <span className="scan-line" />
            </div>
            <div className="instruction-card">
              <div className="section-heading compact">
                <h2>Follow the prompts</h2>
                <p>Complete each motion so we can confirm you are present.</p>
              </div>
              <ol className="check-list">
                {checks.map((check, index) => {
                  const complete = activeCheck > index;
                  return (
                    <li key={check} className={complete ? "complete" : ""}>
                      <span>{complete ? <CheckCircle2 size={18} /> : index + 1}</span>
                      {check}
                    </li>
                  );
                })}
              </ol>
              <button className="button primary" type="button" onClick={startCheck} disabled={running || verified}>
                {running ? <span className="spinner" aria-hidden="true" /> : verified ? <CheckCircle2 size={18} /> : <Play size={18} />}
                {running ? "Checking" : verified ? "Liveness Verified" : "Start Check"}
              </button>
              {verified && <p className="status-text verified">Liveness Verified</p>}
              {!verified && state.livenessStatus === "running" && (
                <p className="muted-line">Progress {activeCheck} of {checks.length}</p>
              )}
              {!running && !verified && activeCheck > 0 && (
                <button className="text-button" type="button" onClick={() => setActiveCheck(0)}>
                  <RotateCcw size={16} /> Reset check
                </button>
              )}
            </div>
          </div>
          <ActionBar
            onBack={() => navigate("/face-capture")}
            onNext={() => navigate("/review")}
            nextDisabled={!verified}
          />
        </section>
      </div>
    </main>
  );
}
