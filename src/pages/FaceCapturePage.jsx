import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Camera, CheckCircle2 } from "lucide-react";
import ActionBar from "../components/ActionBar.jsx";
import StepHeader from "../components/StepHeader.jsx";
import { useVerification } from "../context/VerificationContext.jsx";
import { captureFace } from "../services/verificationApi.js";

const mockFaceImage = {
  name: "face-capture-placeholder",
  previewUrl:
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='720' height='480' viewBox='0 0 720 480'%3E%3Crect width='720' height='480' fill='%23f1f5f9'/%3E%3Ccircle cx='360' cy='190' r='72' fill='%23dbeafe' stroke='%232563eb' stroke-width='8'/%3E%3Cpath d='M230 390c28-83 91-125 130-125s102 42 130 125' fill='%23dbeafe' stroke='%232563eb' stroke-width='8' stroke-linecap='round'/%3E%3C/svg%3E",
};

export default function FaceCapturePage() {
  const navigate = useNavigate();
  const { state, updateVerification } = useVerification();
  const [captureLoading, setCaptureLoading] = useState(false);

  const handleCapture = async () => {
    setCaptureLoading(true);
    const result = await captureFace(mockFaceImage);
    updateVerification({ faceImage: result.faceImage });
    setCaptureLoading(false);
  };

  return (
    <main className="page fade-in">
      <div className="shell">
        <StepHeader currentStep={2} title="Face Capture" />
        <section className="panel">
          <div className="camera-layout">
            <div className={state.faceImage ? "camera-box captured" : "camera-box"}>
              {state.faceImage ? (
                <img src={state.faceImage.previewUrl} alt="Face capture preview" />
              ) : (
                <div className="camera-placeholder">
                  <Camera size={42} />
                  <p>Position your face inside the frame</p>
                </div>
              )}
            </div>
            <aside className="capture-side panel-soft">
              <h2>Capture a clear selfie</h2>
              <p>Use a well-lit space and keep your face centered for the best verification result.</p>
              <button className="button primary" type="button" onClick={handleCapture} disabled={captureLoading}>
                {captureLoading ? <span className="spinner" aria-hidden="true" /> : <Camera size={18} />}
                {captureLoading ? "Capturing" : "Capture Face"}
              </button>
              {state.faceImage && (
                <p className="inline-success">
                  <CheckCircle2 size={17} /> Face captured
                </p>
              )}
            </aside>
          </div>
          <ActionBar
            onBack={() => navigate("/upload-id")}
            onNext={() => navigate("/liveness")}
            nextDisabled={!state.faceImage}
          />
        </section>
      </div>
    </main>
  );
}
