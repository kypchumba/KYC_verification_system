import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import { VerificationProvider } from "./context/VerificationContext.jsx";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <VerificationProvider>
        <App />
      </VerificationProvider>
    </BrowserRouter>
  </React.StrictMode>
);
