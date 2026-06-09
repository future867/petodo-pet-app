from dataclasses import dataclass
from threading import Lock

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from account_auth import AccountBook, AccountError, AccountExistsError, InvalidCredentialsError
from fishing_logic import FishingLedger
from focus_records import FocusRecordBook
from models import (
    AccountProfile,
    AppStatus,
    AuthRequest,
    FeedRequest,
    FeedResult,
    FishingInviteResponse,
    FishingRewardUseRequest,
    FishingRewardUseResponse,
    FishingSettleRequest,
    FishingSettleResponse,
    FishingStartResponse,
    FishingStatus,
    PetInteractionRequest,
    PetStatus,
    ProfileUpdateRequest,
    ShopRedeemRequest,
    ShopRedeemResult,
    TimerStartRequest,
    TimerStatus,
)
from pet_logic import PetStateMachine
from shop_logic import ShopLedger
from timer_logic import PomodoroTimer


app = FastAPI(title="Petodo API")
account_book = AccountBook()


@dataclass
class AccountRuntime:
    timer: PomodoroTimer
    pet: PetStateMachine
    focus_records: FocusRecordBook
    shop: ShopLedger
    fishing: FishingLedger


runtime_lock = Lock()
account_runtimes = {}


def create_account_runtime(account_id=None):
    focus_records = FocusRecordBook(account_id=account_id)
    return AccountRuntime(
        timer=PomodoroTimer(),
        pet=PetStateMachine(account_id=account_id),
        focus_records=focus_records,
        shop=ShopLedger(account_id=account_id),
        fishing=FishingLedger(existing_focus_records=focus_records.stats().records, account_id=account_id),
    )


legacy_runtime = create_account_runtime()
timer = legacy_runtime.timer
pet = legacy_runtime.pet
focus_records = legacy_runtime.focus_records
shop = legacy_runtime.shop
fishing = legacy_runtime.fishing


def get_runtime(account_id=None):
    if not account_id:
        return AccountRuntime(timer=timer, pet=pet, focus_records=focus_records, shop=shop, fishing=fishing)

    with runtime_lock:
        if account_id not in account_runtimes:
            account_runtimes[account_id] = create_account_runtime(account_id)
        return account_runtimes[account_id]


def resolve_account_id(x_petodo_account: str | None = Header(default=None)):
    if not x_petodo_account:
        return None

    account = account_book.account_by_id(x_petodo_account)
    if not account:
        raise HTTPException(status_code=401, detail="账号无效，请重新登录")
    return account["account_id"]

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


@app.post("/auth/register", response_model=AccountProfile)
def register_account(request: AuthRequest):
    try:
        return account_book.create_account(request.account, request.password, request.display_name)
    except AccountExistsError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error
    except AccountError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@app.post("/auth/login", response_model=AccountProfile)
def login_account(request: AuthRequest):
    try:
        return account_book.login(request.account, request.password)
    except InvalidCredentialsError as error:
        raise HTTPException(status_code=401, detail=str(error)) from error
    except AccountError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@app.post("/auth/profile", response_model=AccountProfile)
def update_account_profile(request: ProfileUpdateRequest, account_id=Depends(resolve_account_id)):
    if not account_id:
        raise HTTPException(status_code=401, detail="请先登录")
    try:
        return account_book.update_display_name(account_id, request.display_name)
    except AccountError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@app.post("/timer/start", response_model=TimerStatus)
def start_timer(request: TimerStartRequest | None = None, account_id=Depends(resolve_account_id)):
    runtime = get_runtime(account_id)
    task_id = request.task_id if request else None
    return sync_focus_records(runtime, runtime.timer.start(task_id=task_id))


@app.post("/timer/pause", response_model=TimerStatus)
def pause_timer(account_id=Depends(resolve_account_id)):
    runtime = get_runtime(account_id)
    return sync_focus_records(runtime, runtime.timer.pause())


@app.post("/timer/reset", response_model=TimerStatus)
def reset_timer(account_id=Depends(resolve_account_id)):
    runtime = get_runtime(account_id)
    return sync_focus_records(runtime, runtime.timer.reset())


@app.get("/timer/status", response_model=TimerStatus)
def get_timer_status(account_id=Depends(resolve_account_id)):
    runtime = get_runtime(account_id)
    return sync_focus_records(runtime, runtime.timer.status())


@app.get("/pet/status", response_model=PetStatus)
def get_pet_status(account_id=Depends(resolve_account_id)):
    runtime = get_runtime(account_id)
    timer_status = sync_focus_records(runtime, runtime.timer.status())
    return runtime.pet.get_pet_state(timer_status)


@app.post("/pet/interact", response_model=PetStatus)
def interact_with_pet(request: PetInteractionRequest, account_id=Depends(resolve_account_id)):
    runtime = get_runtime(account_id)
    timer_status = sync_focus_records(runtime, runtime.timer.status())
    return runtime.pet.update_pet_state(timer_status, request.interaction)


@app.post("/pet/feed", response_model=FeedResult)
def feed_pet(request: FeedRequest, account_id=Depends(resolve_account_id)):
    runtime = get_runtime(account_id)
    timer_status = sync_focus_records(runtime, runtime.timer.status())
    return runtime.pet.feed(timer_status, request.food_id)


@app.post("/shop/redeem", response_model=ShopRedeemResult)
def redeem_shop_item(request: ShopRedeemRequest, account_id=Depends(resolve_account_id)):
    runtime = get_runtime(account_id)
    timer_status = sync_focus_records(runtime, runtime.timer.status())
    stats = runtime.focus_records.stats()
    return runtime.shop.redeem_food(request.food_id, stats, runtime.pet, timer_status, runtime.fishing.points_bonus())


@app.post("/fishing/invite/check", response_model=FishingInviteResponse)
def check_fishing_invite(account_id=Depends(resolve_account_id)):
    runtime = get_runtime(account_id)
    timer_status = sync_focus_records(runtime, runtime.timer.status())
    return runtime.fishing.check_invite(timer_status)


@app.post("/fishing/invite/decline", response_model=FishingStatus)
def decline_fishing_invite(account_id=Depends(resolve_account_id)):
    runtime = get_runtime(account_id)
    timer_status = sync_focus_records(runtime, runtime.timer.status())
    return runtime.fishing.decline_invite(timer_status)


@app.post("/fishing/start", response_model=FishingStartResponse)
def start_fishing(account_id=Depends(resolve_account_id)):
    runtime = get_runtime(account_id)
    timer_status = sync_focus_records(runtime, runtime.timer.status())
    return runtime.fishing.start(timer_status)


@app.post("/fishing/settle", response_model=FishingSettleResponse)
def settle_fishing(request: FishingSettleRequest, account_id=Depends(resolve_account_id)):
    runtime = get_runtime(account_id)
    return runtime.fishing.settle(request.sessionId)


@app.post("/fishing/reward/use", response_model=FishingRewardUseResponse)
def use_fishing_reward(request: FishingRewardUseRequest, account_id=Depends(resolve_account_id)):
    runtime = get_runtime(account_id)
    timer_status = sync_focus_records(runtime, runtime.timer.status())
    result = runtime.fishing.use_inventory_reward(request.item)
    feed_result = None
    if result.success and request.item == "dried_fish":
        feed_result = runtime.pet.feed(timer_status, "hamburger")

    stats = runtime.focus_records.stats()
    points_status = runtime.shop.points_status(stats, runtime.fishing.points_bonus())
    return result.model_copy(update={
        "feedResult": feed_result,
        "points": points_status.current_points,
    })


@app.post("/pet/decay", response_model=PetStatus)
def decay_pet(account_id=Depends(resolve_account_id)):
    runtime = get_runtime(account_id)
    timer_status = sync_focus_records(runtime, runtime.timer.status())
    return runtime.pet.decay_now(timer_status)


@app.get("/app/status", response_model=AppStatus)
def get_app_status(account_id=Depends(resolve_account_id)):
    runtime = get_runtime(account_id)
    timer_status = sync_focus_records(runtime, runtime.timer.status())
    pet_status = runtime.pet.get_pet_state(timer_status)
    stats = runtime.focus_records.stats()
    points_status = runtime.shop.points_status(stats, runtime.fishing.points_bonus())
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
        fishing=runtime.fishing.status(),
    )


def sync_focus_records(runtime, timer_status):
    stats = runtime.focus_records.sync_timer_status(timer_status)
    runtime.fishing.sync_focus_records(stats.records)
    return timer_status
