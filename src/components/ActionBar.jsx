import { ArrowLeft, ArrowRight } from "lucide-react";

export default function ActionBar({ onBack, onNext, nextLabel = "Continue", nextDisabled, loading }) {
  return (
    <div className="action-bar">
      <button className="button secondary" type="button" onClick={onBack}>
        <ArrowLeft size={18} />
        Back
      </button>
      <button className="button primary" type="button" onClick={onNext} disabled={nextDisabled || loading}>
        {loading ? <span className="spinner" aria-hidden="true" /> : <ArrowRight size={18} />}
        {loading ? "Working" : nextLabel}
      </button>
    </div>
  );
}
