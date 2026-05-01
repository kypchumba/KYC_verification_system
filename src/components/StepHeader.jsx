import { ShieldCheck } from "lucide-react";

export default function StepHeader({ currentStep, title }) {
  const progressPercent = (currentStep / 4) * 100;

  return (
    <header className="step-header" aria-label="Verification progress">
      <div className="brand-mark" aria-hidden="true">
        <ShieldCheck size={22} strokeWidth={2.2} />
      </div>
      <div className="step-header-content">
        <p className="eyebrow">Step {currentStep} of 4</p>
        <h1>{title}</h1>
        <div className="progress-track" aria-hidden="true">
          <span style={{ width: `${progressPercent}%` }} />
        </div>
      </div>
    </header>
  );
}
