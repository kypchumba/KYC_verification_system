import { useNavigate } from "react-router-dom";
import { CheckCircle2, Clock3, XCircle } from "lucide-react";
import { useVerification } from "../context/VerificationContext.jsx";

const statusContent = {
  VERIFIED: {
    className: "verified",
    icon: CheckCircle2,
    title: "VERIFIED",
    message: "Your identity verification has been completed successfully.",
  },
  "PENDING REVIEW": {
    className: "pending",
    icon: Clock3,
    title: "PENDING REVIEW",
    message: "Your submission was received and is waiting for manual review.",
  },
  REJECTED: {
    className: "rejected",
    icon: XCircle,
    title: "REJECTED",
    message: "We could not verify the submitted information. Please try again.",
  },
};

export default function ResultPage() {
  const navigate = useNavigate();
  const { state, resetVerification } = useVerification();
  const content = statusContent[state.verificationStatus] || statusContent["PENDING REVIEW"];
  const StatusIcon = content.icon;

  const backToStart = () => {
    resetVerification();
    navigate("/");
  };

  return (
    <main className="page result-page fade-in">
      <section className="result-card">
        <div className={`result-icon ${content.className}`} aria-hidden="true">
          <StatusIcon size={42} />
        </div>
        <p className={`result-status ${content.className}`}>{content.title}</p>
        <h1>Verification Result</h1>
        <p>{content.message}</p>
        <button className="button primary large" type="button" onClick={backToStart}>
          Back to Start
        </button>
      </section>
    </main>
  );
}
