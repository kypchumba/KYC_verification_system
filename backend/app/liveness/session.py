from __future__ import annotations

from dataclasses import dataclass, field
from random import Random
from time import monotonic
from typing import Any

from app.liveness.challenges import (
    ChallengeDefinition,
    ChallengeRun,
    ChallengeType,
    create_challenge_run,
    select_challenge_definitions,
)
from app.liveness.detectors import FaceFeatures, FaceMeshAnalyzer


BLINK_CLOSED_EAR = 0.2
BLINK_OPEN_EAR = 0.24
HEAD_YAW_DEGREES = 14.0
NOSE_X_OFFSET = 0.055
LOOK_UP_PITCH_DEGREES = 12.0
LOOK_UP_NOSE_Y_OFFSET = -0.035
SMILE_RATIO = 0.41
SMILE_DELTA = 0.035


@dataclass
class ChallengeState:
    eyes_were_closed: bool = False
    blink_count: int = 0
    smile_samples: list[float] = field(default_factory=list)
    smile_baseline: float | None = None


class ActiveLivenessSession:
    """Runs a time-bound challenge-response liveness session over streaming frames."""

    def __init__(
        self,
        *,
        challenge_count: int = 3,
        min_challenge_seconds: int = 3,
        max_challenge_seconds: int = 5,
        rng: Random | None = None,
        analyzer: FaceMeshAnalyzer | None = None,
    ) -> None:
        self._rng = rng or Random()
        self._challenge_definitions = select_challenge_definitions(challenge_count, self._rng)
        self._min_challenge_seconds = min_challenge_seconds
        self._max_challenge_seconds = max_challenge_seconds
        self._analyzer = analyzer or FaceMeshAnalyzer()
        self._current_run: ChallengeRun | None = None
        self._current_state = ChallengeState()
        self._completed_runs: list[ChallengeRun] = []
        self._status = "READY"
        self._failure_reason: str | None = None

    @property
    def status(self) -> str:
        return self._status

    @property
    def completed(self) -> list[ChallengeRun]:
        return self._completed_runs

    def close(self) -> None:
        self._analyzer.close()

    def start(self) -> dict[str, Any]:
        if self._status == "READY":
            self._activate_next_challenge(monotonic())
        return self._challenge_started_payload()

    def process_jpeg(self, frame_bytes: bytes) -> dict[str, Any]:
        if self._status == "READY":
            self.start()

        if self._status in {"LIVE", "FAIL"}:
            return self._terminal_payload()

        if self._current_run is None:
            return self._fail("No active liveness challenge")

        now = monotonic()
        if now > self._current_run.expires_at:
            return self._fail(f"Time expired for challenge: {self._current_run.instruction}")

        features = self._analyzer.analyze_jpeg(frame_bytes)
        if not features.face_found:
            return self._frame_payload(
                now,
                feedback="No face detected. Keep your face centered in the frame.",
                progress={"face_detected": False},
            )

        passed, feedback, progress, metadata = self._evaluate_current_challenge(features)
        if passed:
            return self._pass_current_challenge(now, metadata)

        return self._frame_payload(now, feedback=feedback, progress=progress)

    def seconds_until_deadline(self) -> float:
        if self._status != "RUNNING" or self._current_run is None:
            return 1.0
        return max(0.01, self._current_run.remaining_seconds())

    def fail_current_timeout(self) -> dict[str, Any]:
        if self._current_run is None:
            return self._fail("No active liveness challenge")
        return self._fail(f"Time expired for challenge: {self._current_run.instruction}")
    def transcript(self) -> dict[str, Any]:
        return {
            "result": self._status,
            "passed": self._status == "LIVE",
            "failure_reason": self._failure_reason,
            "challenge_count": len(self._challenge_definitions),
            "completed_challenges": [run.to_transcript_dict() for run in self._completed_runs],
            "active_challenge": self._current_run.to_transcript_dict() if self._current_run else None,
        }

    def _activate_next_challenge(self, now: float) -> None:
        next_index = len(self._completed_runs)
        definition = self._challenge_definitions[next_index]
        self._current_run = create_challenge_run(
            definition,
            index=next_index + 1,
            total=len(self._challenge_definitions),
            min_seconds=self._min_challenge_seconds,
            max_seconds=self._max_challenge_seconds,
            rng=self._rng,
            now=now,
        )
        self._current_state = ChallengeState()
        self._status = "RUNNING"

    def _evaluate_current_challenge(self, features: FaceFeatures) -> tuple[bool, str, dict[str, Any], dict[str, Any]]:
        if self._current_run is None:
            return False, "No active challenge", {}, {}

        challenge_type = self._current_run.type
        if challenge_type == ChallengeType.BLINK_TWICE:
            return self._detect_blink_twice(features)
        if challenge_type == ChallengeType.TURN_HEAD_LEFT:
            return self._detect_head_turn(features, direction="left")
        if challenge_type == ChallengeType.TURN_HEAD_RIGHT:
            return self._detect_head_turn(features, direction="right")
        if challenge_type == ChallengeType.SMILE:
            return self._detect_smile(features)
        if challenge_type == ChallengeType.LOOK_UP:
            return self._detect_look_up(features)

        return False, "Unsupported challenge", {}, {}

    def _detect_blink_twice(self, features: FaceFeatures) -> tuple[bool, str, dict[str, Any], dict[str, Any]]:
        state = self._current_state
        if features.ear < BLINK_CLOSED_EAR:
            state.eyes_were_closed = True
        elif state.eyes_were_closed and features.ear > BLINK_OPEN_EAR:
            state.blink_count += 1
            state.eyes_were_closed = False

        progress = {
            "blink_count": state.blink_count,
            "target": 2,
            "ear": round(features.ear, 3),
        }
        metadata = dict(progress)
        if state.blink_count >= 2:
            return True, "Blink challenge passed", progress, metadata

        remaining = max(0, 2 - state.blink_count)
        return False, f"{remaining} blink{'s' if remaining != 1 else ''} remaining", progress, metadata

    def _detect_head_turn(self, features: FaceFeatures, *, direction: str) -> tuple[bool, str, dict[str, Any], dict[str, Any]]:
        progress = {
            "yaw": round(features.yaw, 2),
            "nose_offset_x": round(features.nose_offset_x, 3),
        }
        if direction == "left":
            passed = features.yaw < -HEAD_YAW_DEGREES or features.nose_offset_x < -NOSE_X_OFFSET
            feedback = "Turn a bit farther left"
        else:
            passed = features.yaw > HEAD_YAW_DEGREES or features.nose_offset_x > NOSE_X_OFFSET
            feedback = "Turn a bit farther right"

        if passed:
            return True, "Head turn challenge passed", progress, dict(progress)
        return False, feedback, progress, dict(progress)

    def _detect_smile(self, features: FaceFeatures) -> tuple[bool, str, dict[str, Any], dict[str, Any]]:
        state = self._current_state
        state.smile_samples.append(features.smile_ratio)
        if state.smile_baseline is None and len(state.smile_samples) >= 3:
            state.smile_baseline = min(state.smile_samples[:3])

        baseline = state.smile_baseline if state.smile_baseline is not None else min(state.smile_samples)
        smile_delta = features.smile_ratio - baseline
        passed = features.smile_ratio >= SMILE_RATIO or smile_delta >= SMILE_DELTA
        progress = {
            "smile_ratio": round(features.smile_ratio, 3),
            "smile_delta": round(smile_delta, 3),
            "mouth_open_ratio": round(features.mouth_open_ratio, 3),
        }

        if passed:
            return True, "Smile challenge passed", progress, dict(progress)
        return False, "Smile naturally and keep your face centered", progress, dict(progress)

    def _detect_look_up(self, features: FaceFeatures) -> tuple[bool, str, dict[str, Any], dict[str, Any]]:
        progress = {
            "pitch": round(features.pitch, 2),
            "nose_offset_y": round(features.nose_offset_y, 3),
        }
        passed = features.pitch > LOOK_UP_PITCH_DEGREES or features.nose_offset_y < LOOK_UP_NOSE_Y_OFFSET
        if passed:
            return True, "Look up challenge passed", progress, dict(progress)
        return False, "Look up slightly", progress, dict(progress)

    def _pass_current_challenge(self, now: float, metadata: dict[str, Any]) -> dict[str, Any]:
        if self._current_run is None:
            return self._fail("No active challenge to pass")

        self._current_run.passed_at = now
        self._current_run.metadata = metadata
        passed_run = self._current_run
        self._completed_runs.append(passed_run)

        if len(self._completed_runs) == len(self._challenge_definitions):
            self._status = "LIVE"
            return {
                "type": "live",
                "status": "LIVE",
                "result": "LIVE",
                "passed_challenge": passed_run.to_public_dict(now),
                "completed": [run.to_public_dict(now) for run in self._completed_runs],
                "transcript": self.transcript(),
            }

        self._activate_next_challenge(now)
        return {
            "type": "challenge_passed",
            "status": "CHALLENGE_PASSED",
            "passed_challenge": passed_run.to_public_dict(now),
            "challenge": self._current_run.to_public_dict(now),
            "completed": [run.to_public_dict(now) for run in self._completed_runs],
            "plan": self._plan_payload(),
        }

    def _frame_payload(self, now: float, *, feedback: str, progress: dict[str, Any]) -> dict[str, Any]:
        return {
            "type": "frame_result",
            "status": "RUNNING",
            "challenge": self._current_run.to_public_dict(now) if self._current_run else None,
            "completed": [run.to_public_dict(now) for run in self._completed_runs],
            "feedback": feedback,
            "progress": progress,
        }

    def _challenge_started_payload(self) -> dict[str, Any]:
        now = monotonic()
        return {
            "type": "challenge_started",
            "status": "RUNNING",
            "challenge": self._current_run.to_public_dict(now) if self._current_run else None,
            "completed": [run.to_public_dict(now) for run in self._completed_runs],
            "plan": self._plan_payload(),
        }

    def _terminal_payload(self) -> dict[str, Any]:
        payload_type = "live" if self._status == "LIVE" else "fail"
        return {
            "type": payload_type,
            "status": self._status,
            "result": self._status,
            "error": self._failure_reason,
            "completed": [run.to_public_dict() for run in self._completed_runs],
            "transcript": self.transcript(),
        }

    def _fail(self, reason: str) -> dict[str, Any]:
        self._status = "FAIL"
        self._failure_reason = reason
        return {
            "type": "fail",
            "status": "FAIL",
            "result": "FAIL",
            "error": reason,
            "challenge": self._current_run.to_public_dict() if self._current_run else None,
            "completed": [run.to_public_dict() for run in self._completed_runs],
            "transcript": self.transcript(),
        }

    def _plan_payload(self) -> list[dict[str, Any]]:
        total = len(self._challenge_definitions)
        return [
            {
                "index": index,
                "total": total,
                "type": definition.type.value,
                "instruction": definition.instruction,
            }
            for index, definition in enumerate(self._challenge_definitions, start=1)
        ]
