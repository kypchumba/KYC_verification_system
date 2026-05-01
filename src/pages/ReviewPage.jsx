import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Send } from "lucide-react";
import ActionBar from "../components/ActionBar.jsx";
import StepHeader from "../components/StepHeader.jsx";
import { useVerification } from "../context/VerificationContext.jsx";
import { submitVerification } from "../services/verificationApi.js";

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

export default function ReviewPage() {
  const navigate = useNavigate();
  const { state, updateVerification } = useVerification();
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setLoading(true);
    const result = await submitVerification({
      idFront: state.idFront,
      idBack: state.idBack,
      faceImage: state.faceImage,
      livenessStatus: state.livenessStatus,
    });
    updateVerification({ verificationStatus: result.verificationStatus });
    setLoading(false);
    navigate("/result");
  };

  return (
    <main className="page fade-in">
      <div className="shell">
        <StepHeader currentStep={4} title="Review" />
        <section className="panel">
          <div className="section-heading">
            <h2>Review & Submit</h2>
            <p>Confirm your documents and capture before sending them for verification.</p>
          </div>
          <div className="review-grid">
            <PreviewTile title="ID Front" image={state.idFront} />
            <PreviewTile title="ID Back" image={state.idBack} />
            <PreviewTile title="Face Capture" image={state.faceImage} />
            <article className="preview-tile status-tile">
              <h3>Liveness status</h3>
              <p className="status-text verified">{state.livenessStatus === "verified" ? "Verified" : "Not complete"}</p>
            </article>
          </div>
          <ActionBar
            onBack={() => navigate("/liveness")}
            onNext={submit}
            nextLabel="Submit for Verification"
            loading={loading}
          />
          <div className="submit-note" aria-hidden="true">
            <Send size={16} /> Ready for FastAPI integration
          </div>
        </section>
      </div>
    </main>
  );
}
