from typing import Literal

from pydantic import BaseModel


TimerMode = Literal["idle", "focus", "break", "paused"]
PreviousMode = Literal["focus", "break"]
PetState = Literal["idle", "focus", "rest", "hungry", "angry", "sleep", "drag", "tap"]
PetInteraction = Literal["drag", "tap"]
FoodId = Literal["fish", "cat_food", "can"]


class TimerStatus(BaseModel):
    mode: TimerMode
    previous_mode: PreviousMode | None
    remaining_seconds: int
    focus_seconds: int
    break_seconds: int
    is_running: bool


class PetAttributes(BaseModel):
    hunger: int
    mood: int
    energy: int


class PetStatus(BaseModel):
    state: PetState
    attributes: PetAttributes
    hunger: int
    mood: int
    energy: int
    reason: str
    temporary_active: bool
    timer_mode: TimerMode


class PetInteractionRequest(BaseModel):
    interaction: PetInteraction


class FeedRequest(BaseModel):
    food_id: FoodId


class FeedResult(BaseModel):
    food_id: FoodId
    food_name: str
    message: str
    hunger_added: int
    mood_added: int
    status: PetStatus
