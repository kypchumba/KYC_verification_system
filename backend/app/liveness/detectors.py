from __future__ import annotations

from dataclasses import dataclass
from math import dist
from pathlib import Path
from typing import Any

import cv2
import mediapipe as mp
import numpy as np


LEFT_EYE = (33, 160, 158, 133, 153, 144)
RIGHT_EYE = (362, 385, 387, 263, 373, 380)
TASK_MODEL_PATH = Path(__file__).resolve().parent / "models" / "face_landmarker.task"


@dataclass(frozen=True)
class FaceFeatures:
    face_found: bool
    ear: float = 0.0
    yaw: float = 0.0
    pitch: float = 0.0
    roll: float = 0.0
    nose_offset_x: float = 0.0
    nose_offset_y: float = 0.0
    smile_ratio: float = 0.0
    mouth_open_ratio: float = 0.0
    debug: dict[str, Any] | None = None


class FaceMeshAnalyzer:
    """Extracts liveness signals from one BGR frame at a time."""

    def __init__(
        self,
        *,
        max_num_faces: int = 1,
        min_detection_confidence: float = 0.5,
        min_tracking_confidence: float = 0.5,
    ) -> None:
        self._mode = "tasks"
        self._face_mesh = None
        self._face_landmarker = None

        if hasattr(mp, "solutions") and hasattr(mp.solutions, "face_mesh"):
            self._mode = "solutions"
            self._face_mesh = mp.solutions.face_mesh.FaceMesh(
                static_image_mode=False,
                max_num_faces=max_num_faces,
                refine_landmarks=True,
                min_detection_confidence=min_detection_confidence,
                min_tracking_confidence=min_tracking_confidence,
            )
            return

        if not TASK_MODEL_PATH.exists():
            raise RuntimeError(f"MediaPipe face landmarker model is missing: {TASK_MODEL_PATH}")

        from mediapipe.tasks import python
        from mediapipe.tasks.python import vision

        options = vision.FaceLandmarkerOptions(
            base_options=python.BaseOptions(model_asset_path=str(TASK_MODEL_PATH)),
            running_mode=vision.RunningMode.IMAGE,
            num_faces=max_num_faces,
            min_face_detection_confidence=min_detection_confidence,
            min_tracking_confidence=min_tracking_confidence,
        )
        self._face_landmarker = vision.FaceLandmarker.create_from_options(options)

    def close(self) -> None:
        if self._face_mesh is not None:
            self._face_mesh.close()
        if self._face_landmarker is not None:
            self._face_landmarker.close()

    def analyze_jpeg(self, frame_bytes: bytes) -> FaceFeatures:
        frame = self.decode_jpeg(frame_bytes)
        return self.analyze_bgr(frame)

    def analyze_bgr(self, frame: np.ndarray) -> FaceFeatures:
        if frame is None or frame.size == 0:
            return FaceFeatures(face_found=False, debug={"reason": "empty_frame"})

        height, width = frame.shape[:2]
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        rgb_frame = np.ascontiguousarray(rgb_frame)
        landmarks = self._detect_landmarks(rgb_frame, width, height)

        if not landmarks:
            return FaceFeatures(face_found=False, debug={"reason": "no_face"})

        points = [np.array([landmark.x * width, landmark.y * height], dtype=np.float64) for landmark in landmarks]

        face_width = max(dist(points[234], points[454]), 1.0)
        face_center = (points[234] + points[454]) / 2.0
        nose_tip = points[1]
        mouth_width = dist(points[61], points[291])
        mouth_open = dist(points[13], points[14])
        smile_ratio = mouth_width / face_width
        mouth_open_ratio = mouth_open / max(mouth_width, 1.0)

        pitch, yaw, roll = self._estimate_head_pose(points, width, height)

        return FaceFeatures(
            face_found=True,
            ear=(self._eye_aspect_ratio(points, LEFT_EYE) + self._eye_aspect_ratio(points, RIGHT_EYE)) / 2.0,
            yaw=yaw,
            pitch=pitch,
            roll=roll,
            nose_offset_x=(nose_tip[0] - face_center[0]) / face_width,
            nose_offset_y=(nose_tip[1] - face_center[1]) / face_width,
            smile_ratio=smile_ratio,
            mouth_open_ratio=mouth_open_ratio,
            debug={
                "detector": self._mode,
                "face_width": round(face_width, 3),
                "mouth_width": round(mouth_width, 3),
                "mouth_open": round(mouth_open, 3),
            },
        )

    def _detect_landmarks(self, rgb_frame: np.ndarray, width: int, height: int):
        if self._mode == "solutions":
            rgb_frame.flags.writeable = False
            results = self._face_mesh.process(rgb_frame)
            if not results.multi_face_landmarks:
                return None
            return results.multi_face_landmarks[0].landmark

        image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_frame)
        results = self._face_landmarker.detect(image)
        if not results.face_landmarks:
            return None
        return results.face_landmarks[0]

    @staticmethod
    def decode_jpeg(frame_bytes: bytes) -> np.ndarray:
        image_array = np.frombuffer(frame_bytes, dtype=np.uint8)
        frame = cv2.imdecode(image_array, cv2.IMREAD_COLOR)
        if frame is None:
            raise ValueError("Could not decode frame bytes as an image")
        return frame

    @staticmethod
    def _eye_aspect_ratio(points: list[np.ndarray], indexes: tuple[int, int, int, int, int, int]) -> float:
        p1, p2, p3, p4, p5, p6 = (points[index] for index in indexes)
        horizontal = dist(p1, p4)
        if horizontal == 0:
            return 0.0
        return (dist(p2, p6) + dist(p3, p5)) / (2.0 * horizontal)

    @staticmethod
    def _estimate_head_pose(points: list[np.ndarray], width: int, height: int) -> tuple[float, float, float]:
        image_points = np.array(
            [
                points[1],    # Nose tip
                points[152],  # Chin
                points[33],   # Left eye outer corner
                points[263],  # Right eye outer corner
                points[61],   # Left mouth corner
                points[291],  # Right mouth corner
            ],
            dtype=np.float64,
        )
        model_points = np.array(
            [
                (0.0, 0.0, 0.0),
                (0.0, -63.6, -12.5),
                (-43.3, 32.7, -26.0),
                (43.3, 32.7, -26.0),
                (-28.9, -28.9, -24.1),
                (28.9, -28.9, -24.1),
            ],
            dtype=np.float64,
        )
        focal_length = float(width)
        camera_matrix = np.array(
            [
                [focal_length, 0.0, width / 2.0],
                [0.0, focal_length, height / 2.0],
                [0.0, 0.0, 1.0],
            ],
            dtype=np.float64,
        )
        distortion_coefficients = np.zeros((4, 1), dtype=np.float64)

        success, rotation_vector, translation_vector = cv2.solvePnP(
            model_points,
            image_points,
            camera_matrix,
            distortion_coefficients,
            flags=cv2.SOLVEPNP_ITERATIVE,
        )
        if not success:
            return 0.0, 0.0, 0.0

        rotation_matrix, _ = cv2.Rodrigues(rotation_vector)
        projection_matrix = np.hstack((rotation_matrix, translation_vector))
        _, _, _, _, _, _, euler_angles = cv2.decomposeProjectionMatrix(projection_matrix)
        pitch, yaw, roll = (float(angle) for angle in euler_angles.flatten()[:3])
        return pitch, yaw, roll