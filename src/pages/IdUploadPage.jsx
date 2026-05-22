import { useState } from "react";
import { useNavigate } from "react-router-dom";
import ActionBar from "../components/ActionBar.jsx";
import StepHeader from "../components/StepHeader.jsx";
import UploadCard from "../components/UploadCard.jsx";
import { useVerification } from "../context/VerificationContext.jsx";
import { mapServerState, uploadID } from "../services/verificationApi.js";

function createImageState(file) {
  if (!file) return null;

  return {
    file,
    name: file.name,
    previewUrl: URL.createObjectURL(file),
  };
}

export default function IdUploadPage() {
  const navigate = useNavigate();
  const { state, updateVerification } = useVerification();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const setImage = (key, file) => {
    if (state[key]?.previewUrl) {
      URL.revokeObjectURL(state[key].previewUrl);
    }

    updateVerification({ [key]: createImageState(file) });
  };

  const continueToFaceCapture = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await uploadID({ sessionId: state.sessionId, idFront: state.idFront, idBack: state.idBack });
      updateVerification({ ...mapServerState(result), idFront: state.idFront, idBack: state.idBack });
      navigate("/face-capture");
    } catch (uploadError) {
      setError(uploadError.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="page fade-in">
      <div className="shell">
        <StepHeader currentStep={1} title="Upload ID" />
        <section className="panel">
          <div className="section-heading">
            <h2>Government ID</h2>
            <p>Upload clear images of both sides of your identity document. Face extraction starts in the background as soon as the upload completes.</p>
          </div>
          <div className="upload-grid">
            <UploadCard
              id="id-front"
              title="Front of ID upload"
              value={state.idFront}
              onChange={(file) => setImage("idFront", file)}
            />
            <UploadCard
              id="id-back"
              title="Back of ID upload"
              value={state.idBack}
              onChange={(file) => setImage("idBack", file)}
            />
          </div>
          {error && <p className="error-line">{error}</p>}
          {state.extractionStatus && state.extractionStatus !== "NOT_STARTED" && (
            <p className="muted-line">ID face extraction: {state.extractionStatus}</p>
          )}
          <ActionBar
            onBack={() => navigate("/")}
            onNext={continueToFaceCapture}
            nextDisabled={!state.idFront || !state.idBack || !state.sessionId}
            loading={loading}
          />
        </section>
      </div>
    </main>
  );
}
