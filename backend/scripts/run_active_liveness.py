from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

import cv2

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.liveness.session import ActiveLivenessSession  # noqa: E402


def draw_overlay(frame, message: dict[str, Any]) -> None:
    challenge = message.get("challenge")
    completed = message.get("completed") or []
    status = message.get("status", "RUNNING")
    feedback = message.get("feedback") or message.get("error") or ""

    if status == "LIVE":
        title = "LIVE"
        color = (40, 190, 80)
    elif status == "FAIL":
        title = "FAIL"
        color = (40, 40, 220)
    else:
        instruction = challenge.get("instruction") if challenge else "Starting challenge"
        remaining = challenge.get("remaining_seconds") if challenge else 0
        title = f"{instruction}  {remaining:.1f}s"
        color = (40, 160, 240)

    cv2.rectangle(frame, (0, 0), (frame.shape[1], 96), (18, 24, 32), thickness=-1)
    cv2.putText(frame, title, (24, 38), cv2.FONT_HERSHEY_SIMPLEX, 0.9, color, 2, cv2.LINE_AA)
    cv2.putText(
        frame,
        f"Completed: {len(completed)} | Press q to quit",
        (24, 72),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.65,
        (230, 230, 230),
        1,
        cv2.LINE_AA,
    )
    if feedback:
        cv2.putText(frame, feedback, (24, frame.shape[0] - 28), cv2.FONT_HERSHEY_SIMPLEX, 0.65, color, 2, cv2.LINE_AA)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run active liveness detection from a local webcam.")
    parser.add_argument("--camera", type=int, default=0, help="OpenCV camera index")
    parser.add_argument("--challenges", type=int, default=3, help="Number of random challenges to run")
    parser.add_argument("--width", type=int, default=1280, help="Requested camera width")
    parser.add_argument("--height", type=int, default=720, help="Requested camera height")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    liveness = ActiveLivenessSession(challenge_count=args.challenges)
    capture = cv2.VideoCapture(args.camera)
    capture.set(cv2.CAP_PROP_FRAME_WIDTH, args.width)
    capture.set(cv2.CAP_PROP_FRAME_HEIGHT, args.height)

    if not capture.isOpened():
        print("Could not open webcam", file=sys.stderr)
        return 1

    message = liveness.start()
    try:
        while True:
            ok, frame = capture.read()
            if not ok:
                print("Could not read webcam frame", file=sys.stderr)
                return 1

            ok, encoded = cv2.imencode(".jpg", frame, [int(cv2.IMWRITE_JPEG_QUALITY), 85])
            if ok and liveness.status not in {"LIVE", "FAIL"}:
                message = liveness.process_jpeg(encoded.tobytes())

            draw_overlay(frame, message)
            cv2.imshow("Active Liveness Detection", frame)

            key = cv2.waitKey(1) & 0xFF
            if key == ord("q") or liveness.status in {"LIVE", "FAIL"}:
                cv2.waitKey(1200)
                break
    finally:
        capture.release()
        cv2.destroyAllWindows()
        liveness.close()

    print(json.dumps(liveness.transcript(), indent=2))
    return 0 if liveness.status == "LIVE" else 2


if __name__ == "__main__":
    raise SystemExit(main())
