import { Navigate, Route, Routes } from "react-router-dom";
import GuardedRoute from "./components/GuardedRoute.jsx";
import WelcomePage from "./pages/WelcomePage.jsx";
import IdUploadPage from "./pages/IdUploadPage.jsx";
import FaceCapturePage from "./pages/FaceCapturePage.jsx";
import LivenessPage from "./pages/LivenessPage.jsx";
import ReviewPage from "./pages/ReviewPage.jsx";
import ResultPage from "./pages/ResultPage.jsx";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<WelcomePage />} />
      <Route
        path="/upload-id"
        element={
          <GuardedRoute step="idUpload">
            <IdUploadPage />
          </GuardedRoute>
        }
      />
      <Route
        path="/face-capture"
        element={
          <GuardedRoute step="faceCapture">
            <FaceCapturePage />
          </GuardedRoute>
        }
      />
      <Route
        path="/liveness"
        element={
          <GuardedRoute step="liveness">
            <LivenessPage />
          </GuardedRoute>
        }
      />
      <Route
        path="/review"
        element={
          <GuardedRoute step="review">
            <ReviewPage />
          </GuardedRoute>
        }
      />
      <Route
        path="/result"
        element={
          <GuardedRoute step="result">
            <ResultPage />
          </GuardedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
