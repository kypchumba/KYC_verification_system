import { useState } from "react";
import { useNavigate } from "react-router-dom";
import ActionBar from "../components/ActionBar.jsx";
import StepHeader from "../components/StepHeader.jsx";
import UploadCard from "../components/UploadCard.jsx";
import { useVerification } from "../context/VerificationContext.jsx";
import { uploadID } from "../services/verificationApi.js";

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

  const setImage = (key, file) => {
    updateVerification({ [key]: createImageState(file) });
  };

  const continueToFaceCapture = async () => {
    setLoading(true);
    const result = await uploadID({ idFront: state.idFront, idBack: state.idBack });
    updateVerification({ idFront: result.idFront, idBack: result.idBack });
    setLoading(false);
    navigate("/face-capture");
  };

  return (
    <main className="page fade-in">
      <div className="shell">
        <StepHeader currentStep={1} title="Upload ID" />
        <section className="panel">
          <div className="section-heading">
            <h2>Government ID</h2>
            <p>Upload clear images of both sides of your identity document.</p>
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
          <ActionBar
            onBack={() => navigate("/")}
            onNext={continueToFaceCapture}
            nextDisabled={!state.idFront || !state.idBack}
            loading={loading}
          />
        </section>
      </div>
    </main>
  );
}
