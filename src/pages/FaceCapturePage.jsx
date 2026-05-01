import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Camera, CheckCircle2, UploadCloud, Video } from "lucide-react";
import ActionBar from "../components/ActionBar.jsx";
import StepHeader from "../components/StepHeader.jsx";
import { useVerification } from "../context/VerificationContext.jsx";
import { mapServerState, uploadFace } from "../services/verificationApi.js";

function createImageState(file) {
  return {
    file,
    name: file.name,
    previewUrl: URL.createObjectURL(file),
    uploaded: true,
  };
}

export default function FaceCapturePage() {
  const navigate = useNavigate();
  const { state, updateVerification } = useVerification();
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraReady(false);
  };

  const startCamera = async () => {
    if (state.faceImage || streamRef.current) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Camera access is not supported in this browser. Upload a selfie image instead.");
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
      setCameraError(cameraAccessError.message || "Camera permission was denied. Upload a selfie image instead.");
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
          reject(new Error("Could not capture image from camera"));
          return;
        }
        resolve(new File([blob], "face.jpg", { type: "image/jpeg" }));
      }, "image/jpeg", 0.92);
    });
  };

  const uploadFaceImage = async (file) => {
    setUploading(true);
    setError("");
    try {
      const localFace = createImageState(file);
      const result = await uploadFace({ sessionId: state.sessionId, faceImage: file });
      updateVerification({ ...mapServerState(result), faceImage: localFace });
      stopCamera();
    } catch (uploadError) {
      setError(uploadError.message);
    } finally {
      setUploading(false);
    }
  };

  const handleCapture = async () => {
    try {
      const file = await captureFrame();
      await uploadFaceImage(file);
    } catch (captureError) {
      setError(captureError.message);
    }
  };

  const handleUpload = async (event) => {
    const file = event.target.files?.[0];
    if (file) {
      await uploadFaceImage(file);
    }
    event.target.value = "";
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
                <>
                  <video ref={videoRef} className="camera-video" autoPlay muted playsInline />
                  {!cameraReady && (
                    <div className="camera-placeholder">
                      <Video size={42} />
                      <p>{cameraError || "Starting camera"}</p>
                    </div>
                  )}
                </>
              )}
            </div>
            <aside className="capture-side panel-soft">
              <h2>Capture a clear selfie</h2>
              <p>Use your camera or upload an image. Matching starts in the backend after the selfie reaches the server.</p>
              <div className="capture-actions">
                <button className="button primary" type="button" onClick={handleCapture} disabled={!cameraReady || uploading || Boolean(state.faceImage)}>
                  {uploading ? <span className="spinner" aria-hidden="true" /> : <Camera size={18} />}
                  {uploading ? "Uploading" : "Capture Face"}
                </button>
                <label className="button secondary file-button" htmlFor="face-upload">
                  <UploadCloud size={18} /> Upload Image
                </label>
                <input id="face-upload" className="sr-only" type="file" accept="image/png,image/jpeg,image/jpg" onChange={handleUpload} disabled={uploading || Boolean(state.faceImage)} />
              </div>
              {cameraError && <p className="muted-line">{cameraError}</p>}
              {error && <p className="error-line">{error}</p>}
              {state.faceImage && (
                <div className="status-stack">
                  <p className="inline-success">
                    <CheckCircle2 size={17} /> Face uploaded
                  </p>
                  <p className="muted-line">Face match: {state.faceMatchStatus || "QUEUED"}</p>
                </div>
              )}
            </aside>
          </div>
          <canvas ref={canvasRef} className="sr-only" />
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
