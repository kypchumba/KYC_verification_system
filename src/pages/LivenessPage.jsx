import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, Play, ScanFace, Video, XCircle } from "lucide-react";
import ActionBar from "../components/ActionBar.jsx";
import StepHeader from "../components/StepHeader.jsx";
import { useVerification } from "../context/VerificationContext.jsx";
import { createLivenessSocket, mapServerState } from "../services/verificationApi.js";

const FRAME_INTERVAL_MS = 120;

function createFrameState(file) {
  return {
    file,
    name: file.name,
    previewUrl: URL.createObjectURL(file),
  };
}

function formatProgress(progress = {}) {
  if (typeof progress.blink_count === "number") {
    return `${progress.blink_count}/${progress.target ?? 2} blinks`;
  }
  if (typeof progress.yaw === "number") {
    return `Yaw ${progress.yaw.toFixed(1)} deg`;
  }
  if (typeof progress.smile_ratio === "number") {
    return `Smile ${progress.smile_ratio.toFixed(2)}`;
  }
  if (typeof progress.pitch === "number") {
    return `Pitch ${progress.pitch.toFixed(1)} deg`;
  }
  return "";
}

export default function LivenessPage() {
  const navigate = useNavigate();
  const { state, updateVerification } = useVerification();
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const socketRef = useRef(null);
  const frameTimerRef = useRef(null);
  const frameInFlightRef = useRef(false);
  const terminalRef = useRef(false);

  const [challengePlan, setChallengePlan] = useState([]);
  const [activeChallenge, setActiveChallenge] = useState(null);
  const [completedChallenges, setCompletedChallenges] = useState([]);
  const [countdown, setCountdown] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [progressText, setProgressText] = useState("");
  const [running, setRunning] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [error, setError] = useState("");

  const verified = state.livenessStatus === "verified";

  const stopFrameLoop = () => {
    if (frameTimerRef.current) {
      clearInterval(frameTimerRef.current);
      frameTimerRef.current = null;
    }
    frameInFlightRef.current = false;
  };

  const closeSocket = () => {
    const socket = socketRef.current;
    socketRef.current = null;
    if (socket && socket.readyState !== WebSocket.CLOSED) {
      socket.close();
    }
  };

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
    return () => {
      stopFrameLoop();
      closeSocket();
      stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const capturePreviewFrame = () => {
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

  const sendFrame = () => {
    const socket = socketRef.current;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN || !video || !canvas || !video.videoWidth || frameInFlightRef.current) {
      return;
    }

    frameInFlightRef.current = true;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(async (blob) => {
      try {
        if (blob && socket.readyState === WebSocket.OPEN) {
          socket.send(await blob.arrayBuffer());
        }
      } finally {
        frameInFlightRef.current = false;
      }
    }, "image/jpeg", 0.78);
  };

  const handleServerMessage = async (message) => {
    if (message.plan) {
      setChallengePlan(message.plan);
    }
    if (message.challenge) {
      setActiveChallenge(message.challenge);
      setCountdown(Math.ceil(message.challenge.remaining_seconds || 0));
    }
    if (message.completed) {
      setCompletedChallenges(message.completed);
    }
    if (message.feedback) {
      setFeedback(message.feedback);
    }
    setProgressText(formatProgress(message.progress));

    if (message.status === "LIVE") {
      terminalRef.current = true;
      stopFrameLoop();
      setCountdown(0);
      setFeedback("Liveness verified");
      setProgressText("");
      setRunning(false);

      const updates = {
        ...(message.server_state ? mapServerState(message.server_state) : {}),
        livenessStatus: "verified",
      };
      try {
        updates.livenessFrame = createFrameState(await capturePreviewFrame());
      } catch {
        // The streaming transcript is the verification artifact; this preview is best effort.
      }
      updateVerification(updates);
      closeSocket();
      stopCamera();
      return;
    }

    if (message.status === "FAIL") {
      terminalRef.current = true;
      stopFrameLoop();
      setRunning(false);
      setError(message.error || "Active liveness failed");
      updateVerification({
        ...(message.server_state ? mapServerState(message.server_state) : {}),
        livenessStatus: "failed",
      });
      closeSocket();
    }
  };

  const startCheck = () => {
    if (!state.sessionId) {
      setError("Start a verification session before liveness.");
      return;
    }

    terminalRef.current = false;
    setChallengePlan([]);
    setActiveChallenge(null);
    setCompletedChallenges([]);
    setCountdown(0);
    setFeedback("Center your face in the frame");
    setProgressText("");
    setError("");
    setRunning(true);
    updateVerification({ livenessStatus: "running" });

    const socket = createLivenessSocket(state.sessionId);
    socketRef.current = socket;

    socket.onopen = () => {
      sendFrame();
      frameTimerRef.current = setInterval(sendFrame, FRAME_INTERVAL_MS);
    };

    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        void handleServerMessage(message);
      } catch {
        setError("Received an invalid liveness response.");
      }
    };

    socket.onerror = () => {
      setError("Could not connect to the active liveness stream.");
    };

    socket.onclose = () => {
      stopFrameLoop();
      socketRef.current = null;
      setRunning(false);
      if (!terminalRef.current) {
        updateVerification({ livenessStatus: "failed" });
        setError("Liveness stream closed before verification completed.");
      }
    };
  };

  const visibleChallenges = challengePlan.length ? challengePlan : activeChallenge ? [activeChallenge] : [];

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
                  {running && activeChallenge && (
                    <div className="camera-prompt">
                      <ScanFace size={20} />
                      <span>{activeChallenge.instruction}</span>
                      <strong>{countdown}s</strong>
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="instruction-card">
              <div className="section-heading compact">
                <h2>Follow the prompts</h2>
                <p>Each prompt advances only when the requested action is detected.</p>
              </div>
              <ol className="check-list">
                {visibleChallenges.length ? (
                  visibleChallenges.map((challenge) => {
                    const complete = verified || completedChallenges.some((item) => item.index === challenge.index);
                    const active = activeChallenge?.index === challenge.index && !complete;
                    return (
                      <li key={`${challenge.index}-${challenge.type}`} className={complete ? "complete" : active ? "active" : ""}>
                        <span>{complete ? <CheckCircle2 size={18} /> : challenge.index}</span>
                        {challenge.instruction}
                        {active && <strong className="countdown-badge">{countdown}s</strong>}
                      </li>
                    );
                  })
                ) : (
                  <li className={running ? "active" : ""}>
                    <span>{running ? <ScanFace size={18} /> : 1}</span>
                    Ready for a random challenge
                  </li>
                )}
              </ol>
              <button className="button primary" type="button" onClick={startCheck} disabled={running || verified || !cameraReady}>
                {running ? <span className="spinner" aria-hidden="true" /> : verified ? <CheckCircle2 size={18} /> : <Play size={18} />}
                {running ? "Checking" : verified ? "Liveness Verified" : "Start Check"}
              </button>
              {verified && <p className="status-text verified">Liveness Verified</p>}
              {state.livenessStatus === "failed" && <p className="status-text"><XCircle size={16} /> Liveness failed</p>}
              {feedback && !verified && <p className="muted-line">{feedback}</p>}
              {progressText && !verified && <p className="muted-line">{progressText}</p>}
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
