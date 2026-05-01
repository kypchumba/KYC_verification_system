import { useNavigate } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { useVerification } from "../context/VerificationContext.jsx";

export default function WelcomePage() {
  const navigate = useNavigate();
  const { updateVerification } = useVerification();

  const startVerification = () => {
    updateVerification({ started: true });
    navigate("/upload-id");
  };

  return (
    <main className="page welcome-page fade-in">
      <section className="welcome-card">
        <div className="welcome-icon" aria-hidden="true">
          <ShieldCheck size={34} />
        </div>
        <h1>Identity Verification</h1>
        <p>Complete verification in a few simple steps</p>
        <button className="button primary large" type="button" onClick={startVerification}>
          Start Verification
        </button>
      </section>
    </main>
  );
}
