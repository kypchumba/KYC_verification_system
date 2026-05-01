import { createContext, useContext, useMemo, useState } from "react";

const VerificationContext = createContext(null);

const initialState = {
  started: false,
  sessionId: null,
  idFront: null,
  idBack: null,
  faceImage: null,
  livenessFrame: null,
  livenessStatus: "idle",
  verificationStatus: null,
  backendStatus: null,
  extractionStatus: "NOT_STARTED",
  faceMatchStatus: "NOT_STARTED",
  faceMatchScore: null,
  faceMatchPassed: false,
  riskScore: null,
};

export function VerificationProvider({ children }) {
  const [state, setState] = useState(initialState);

  const updateVerification = (updates) => {
    setState((current) => ({ ...current, ...updates }));
  };

  const resetVerification = () => {
    setState(initialState);
  };

  const value = useMemo(
    () => ({ state, updateVerification, resetVerification }),
    [state]
  );

  return (
    <VerificationContext.Provider value={value}>
      {children}
    </VerificationContext.Provider>
  );
}

export function useVerification() {
  const context = useContext(VerificationContext);

  if (!context) {
    throw new Error("useVerification must be used within VerificationProvider");
  }

  return context;
}
