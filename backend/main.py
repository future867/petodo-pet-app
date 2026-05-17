from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from focus_records import FocusRecordBook
from models import (
    AppStatus,
    FeedRequest,
    FeedResult,
    PetInteractionRequest,
    PetStatus,
    ShopRedeemRequest,
    ShopRedeemResult,
    TimerStatus,
)
from pet_logic import PetStateMachine
from shop_logic import ShopLedger
from timer_logic import PomodoroTimer


app = FastAPI(title="Petodo API")
timer = PomodoroTimer()
pet = PetStateMachine()
focus_records = FocusRecordBook()
shop = ShopLedger()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def read_root():
    return {
        "name": "Petodo",
        "message": "FastAPI 后端运行正常",
        "version": "0.1.0",
    }


@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.post("/timer/start", response_model=TimerStatus)
def start_timer():
    return sync_focus_records(timer.start())


@app.post("/timer/pause", response_model=TimerStatus)
def pause_timer():
    return sync_focus_records(timer.pause())


@app.post("/timer/reset", response_model=TimerStatus)
def reset_timer():
    return sync_focus_records(timer.reset())


@app.get("/timer/status", response_model=TimerStatus)
def get_timer_status():
    return sync_focus_records(timer.status())


@app.get("/pet/status", response_model=PetStatus)
def get_pet_status():
    timer_status = sync_focus_records(timer.status())
    return pet.get_pet_state(timer_status)


@app.post("/pet/interact", response_model=PetStatus)
def interact_with_pet(request: PetInteractionRequest):
    timer_status = sync_focus_records(timer.status())
    return pet.update_pet_state(timer_status, request.interaction)


@app.post("/pet/feed", response_model=FeedResult)
def feed_pet(request: FeedRequest):
    timer_status = sync_focus_records(timer.status())
    return pet.feed(timer_status, request.food_id)


@app.post("/shop/redeem", response_model=ShopRedeemResult)
def redeem_shop_item(request: ShopRedeemRequest):
    timer_status = sync_focus_records(timer.status())
    stats = focus_records.stats()
    return shop.redeem_food(request.food_id, stats, pet, timer_status)


@app.post("/pet/decay", response_model=PetStatus)
def decay_pet():
    timer_status = sync_focus_records(timer.status())
    return pet.decay_now(timer_status)


@app.get("/app/status", response_model=AppStatus)
def get_app_status():
    timer_status = sync_focus_records(timer.status())
    pet_status = pet.get_pet_state(timer_status)
    stats = focus_records.stats()
    points_status = shop.points_status(stats)
    return AppStatus(
        timer=timer_status,
        pet=pet_status,
        focus_stats=stats,
        remaining_seconds=timer_status.remaining_seconds,
        hunger=pet_status.hunger,
        today_completed_count=stats.today_completed_count,
        total_completed_count=stats.total_completed_count,
        points=points_status.current_points,
        points_status=points_status,
    )


def sync_focus_records(timer_status):
    focus_records.sync_timer_status(timer_status)
    return timer_status
