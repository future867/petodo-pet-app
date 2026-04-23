from typing import Literal

from pydantic import BaseModel


TimerMode = Literal["idle", "focus", "break", "paused"]
PreviousMode = Literal["focus", "break"]
PetState = Literal["idle", "focus", "rest", "hungry", "angry", "sleep", "drag", "tap"]
PetInteraction = Literal["drag", "tap"]


class TimerStatus(BaseModel):
    mode: TimerMode
    previous_mode: PreviousMode | None
    remaining_seconds: int
    focus_seconds: int
    break_seconds: int
    is_running: bool


class PetStatus(BaseModel):
    state: PetState
    hunger: int
    reason: str
    temporary_active: bool
    timer_mode: TimerMode


class PetInteractionRequest(BaseModel):
    interaction: PetInteraction
