from typing import Literal

from pydantic import BaseModel


TimerMode = Literal["idle", "focus", "break", "paused"]
PreviousMode = Literal["focus", "break"]
PetState = Literal[
    "idle",
    "focus",
    "rest",
    "happy",
    "sleep",
    "hungry",
    "hungry_heavy",
    "angry",
    "eating",
    "eating_hamburger",
    "eating_pizza",
    "eating_chicken_leg",
    "finished_eating",
    "tap",
    "fishing",
]
PetInteraction = Literal["tap"]
FoodId = Literal["hamburger", "pizza", "chicken_leg"]


class TimerStatus(BaseModel):
    mode: TimerMode
    previous_mode: PreviousMode | None
    remaining_seconds: int
    focus_seconds: int
    break_seconds: int
    is_running: bool
    focus_cycle_id: int | None = None
    last_completed_focus_id: int | None = None
    last_completed_focus_started_at: float | None = None
    last_completed_focus_completed_at: float | None = None
    focus_task_id: str | None = None
    last_completed_focus_task_id: str | None = None
    focus_completed: bool = False


class TimerStartRequest(BaseModel):
    task_id: str | None = None


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


class ShopRedeemRequest(BaseModel):
    food_id: FoodId


class FeedResult(BaseModel):
    food_id: FoodId
    food_name: str
    message: str
    hunger_added: int
    mood_added: int
    status: PetStatus


class PointsStatus(BaseModel):
    points_per_focus: int
    earned_points: int
    spent_points: int
    current_points: int
    focus_points: int = 0
    fishing_bonus_points: int = 0


class ShopRedeemResult(BaseModel):
    success: bool
    food_id: FoodId
    item_name: str
    price: int
    remaining_points: int
    message: str
    feed_result: FeedResult | None = None


class FocusRecord(BaseModel):
    focus_id: int
    started_at: float | None
    completed_at: float
    focus_seconds: int
    completed_date: str
    task_id: str | None = None


class FocusStats(BaseModel):
    today_completed_count: int
    total_completed_count: int
    total_focus_seconds: int
    records: list[FocusRecord]


class FishingSessionStatus(BaseModel):
    sessionId: str
    startedAt: float


class FishingStatus(BaseModel):
    bait: int
    completedPomodorosSinceLastFishingInvite: int
    fishingCount: int
    fishInventory: dict[str, int]
    rareFishCount: int
    pendingInvitation: bool
    activeFishing: FishingSessionStatus | None = None


class FishingInviteResponse(BaseModel):
    invited: bool
    fishing: FishingStatus


class FishingStartResponse(BaseModel):
    success: bool
    message: str
    fishing: FishingStatus


class FishingSettleRequest(BaseModel):
    sessionId: str


class FishingSettleResponse(BaseModel):
    success: bool
    newlySettled: bool
    result: str | None = None
    rewardLabel: str = ""
    bubbleMessage: str = ""
    fishing: FishingStatus


class AppStatus(BaseModel):
    timer: TimerStatus
    pet: PetStatus
    focus_stats: FocusStats
    remaining_seconds: int
    hunger: int
    today_completed_count: int
    total_completed_count: int
    points: int
    points_status: PointsStatus
    fishing: FishingStatus
