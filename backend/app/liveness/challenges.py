from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from random import Random
from time import monotonic
from typing import Any


class ChallengeType(str, Enum):
    BLINK_TWICE = "blink_twice"
    TURN_HEAD_LEFT = "turn_head_left"
    TURN_HEAD_RIGHT = "turn_head_right"
    SMILE = "smile"
    LOOK_UP = "look_up"


@dataclass(frozen=True)
class ChallengeDefinition:
    type: ChallengeType
    instruction: str


@dataclass
class ChallengeRun:
    index: int
    total: int
    type: ChallengeType
    instruction: str
    duration_seconds: int
    started_at: float
    expires_at: float
    passed_at: float | None = None
    metadata: dict[str, Any] = field(default_factory=dict)

    @property
    def passed(self) -> bool:
        return self.passed_at is not None

    def remaining_seconds(self, now: float | None = None) -> float:
        current_time = now if now is not None else monotonic()
        return max(0.0, self.expires_at - current_time)

    def to_public_dict(self, now: float | None = None) -> dict[str, Any]:
        return {
            "index": self.index,
            "total": self.total,
            "type": self.type.value,
            "instruction": self.instruction,
            "duration_seconds": self.duration_seconds,
            "remaining_seconds": round(self.remaining_seconds(now), 2),
            "passed": self.passed,
        }

    def to_transcript_dict(self) -> dict[str, Any]:
        return {
            "index": self.index,
            "type": self.type.value,
            "instruction": self.instruction,
            "duration_seconds": self.duration_seconds,
            "passed": self.passed,
            "elapsed_seconds": round((self.passed_at or self.expires_at) - self.started_at, 2),
            "metadata": self.metadata,
        }


DEFAULT_CHALLENGES = [
    ChallengeDefinition(ChallengeType.BLINK_TWICE, "Blink twice"),
    ChallengeDefinition(ChallengeType.TURN_HEAD_LEFT, "Turn your head left"),
    ChallengeDefinition(ChallengeType.TURN_HEAD_RIGHT, "Turn your head right"),
    ChallengeDefinition(ChallengeType.SMILE, "Smile"),
    ChallengeDefinition(ChallengeType.LOOK_UP, "Look up"),
]


def select_challenge_definitions(
    count: int,
    rng: Random | None = None,
    available: list[ChallengeDefinition] | None = None,
) -> list[ChallengeDefinition]:
    generator = rng or Random()
    challenge_pool = available or DEFAULT_CHALLENGES
    if count > len(challenge_pool):
        raise ValueError("Challenge count cannot exceed available challenge definitions")
    return generator.sample(challenge_pool, count)


def create_challenge_run(
    definition: ChallengeDefinition,
    *,
    index: int,
    total: int,
    min_seconds: int,
    max_seconds: int,
    rng: Random | None = None,
    now: float | None = None,
) -> ChallengeRun:
    if min_seconds > max_seconds:
        raise ValueError("min_seconds cannot be greater than max_seconds")

    generator = rng or Random()
    started_at = now if now is not None else monotonic()
    duration_seconds = generator.randint(min_seconds, max_seconds)
    return ChallengeRun(
        index=index,
        total=total,
        type=definition.type,
        instruction=definition.instruction,
        duration_seconds=duration_seconds,
        started_at=started_at,
        expires_at=started_at + duration_seconds,
    )
