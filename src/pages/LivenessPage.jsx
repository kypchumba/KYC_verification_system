import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, Play, ScanFace, Video } from "lucide-react";
import ActionBar from "../components/ActionBar.jsx";
import StepHeader from "../components/StepHeader.jsx";
import { useVerification } from "../context/VerificationContext.jsx";
import { mapServerState, runLiveness } from "../services/verificationApi.js";

const checks = [
  { label: "Turn your head left", seconds: 5 },
  { label: "Show your right hand", seconds: 5 },
  { label: "Blink twice", seconds: 4 },
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function createFrameState(file) {
  return {
    file,
    name: file.name,
    previewUrl: URL.createObjectURL(file),
  };
}

export default function LivenessPage() {
  const navigate = useNavigate();
  const { state, updateVerification } = useVerification();
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [activeCheck, setActiveCheck] = useState(-1);
  const [completedCount, setCompletedCount] = useState(state.livenessStatus === "verified" ? checks.length : 0);
  const [countdown, setCountdown] = useState(0);
  const [running, setRunning] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [error, setError] = useState("");

  const verified = state.livenessStatus === "verified";

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraReady(false);
  };

  const startCamera = async () => {
    if (verified || streamRef.current) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Camera access is not supported in this browser.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraReady(true);
      setCameraError("");
    } catch (cameraAccessError) {
      setCameraError(cameraAccessError.message || "Camera permission was denied.");
    }
  };

  useEffect(() => {
    startCamera();
    return stopCamera;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const captureFrame = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !video.videoWidth) {
      throw new Error("Camera is not ready yet");
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error("Could not capture liveness frame"));
          return;
        }
        resolve(new File([blob], "liveness.jpg", { type: "image/jpeg" }));
      }, "image/jpeg", 0.92);
    });
  };

  const startCheck = async () => {
    setRunning(true);
    setError("");
    updateVerification({ livenessStatus: "running" });

    try {
      for (let index = 0; index < checks.length; index += 1) {
        setActiveCheck(index);
        for (let remaining = checks[index].seconds; remaining > 0; remaining -= 1) {
          setCountdown(remaining);
          await sleep(1000);
        }
        setCompletedCount(index + 1);
      }

      const file = await captureFrame();
      const frame = createFrameState(file);
      const result = await runLiveness({ sessionId: state.sessionId, livenessImage: file });
      updateVerification({
        ...mapServerState(result),
        livenessFrame: frame,
        livenessStatus: result.liveness_status === "COMPLETED" ? "verified" : "failed",
      });
      stopCamera();
    } catch (checkError) {
      updateVerification({ livenessStatus: "failed" });
      setError(checkError.message);
    } finally {
      setCountdown(0);
      setActiveCheck(-1);
      setRunning(false);
    }
  };

  return (
    <main className="page fade-in">
      <div className="shell">
        <StepHeader currentStep={3} title="Liveness Check" />
        <section className="panel">
          <div className="liveness-layout">
            <div className={state.livenessFrame ? "camera-box captured" : "camera-box"}>
              {state.livenessFrame ? (
                <img src={state.livenessFrame.previewUrl} alt="Liveness capture preview" />
              ) : (
                <>
                  <video ref={videoRef} className="camera-video" autoPlay muted playsInline />
                  {!cameraReady && (
                    <div className="camera-placeholder">
                      <Video size={42} />
                      <p>{cameraError || "Starting camera"}</p>
                    </div>
                  )}
                  {running && activeCheck >= 0 && (
                    <div className="camera-prompt">
                      <ScanFace size={20} />
                      <span>{checks[activeCheck].label}</span>
                      <strong>{countdown}s</strong>
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="instruction-card">
              <div className="section-heading compact">
                <h2>Follow the prompts</h2>
                <p>The camera stays on while each activity is timed.</p>
              </div>
              <ol className="check-list">
                {checks.map((check, index) => {
                  const complete = completedCount > index;
                  const active = activeCheck === index;
                  return (
                    <li key={check.label} className={complete ? "complete" : active ? "active" : ""}>
                      <span>{complete ? <CheckCircle2 size={18} /> : index + 1}</span>
                      {check.label}
                      {active && <strong className="countdown-badge">{countdown}s</strong>}
                    </li>
                  );
                })}
              </ol>
              <button className="button primary" type="button" onClick={startCheck} disabled={running || verified || !cameraReady}>
                {running ? <span className="spinner" aria-hidden="true" /> : verified ? <CheckCircle2 size={18} /> : <Play size={18} />}
                {running ? "Checking" : verified ? "Liveness Verified" : "Start Check"}
              </button>
              {verified && <p className="status-text verified">Liveness Verified</p>}
              {cameraError && <p className="muted-line">{cameraError}</p>}
              {error && <p className="error-line">{error}</p>}
            </div>
          </div>
          <canvas ref={canvasRef} className="sr-only" />
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
