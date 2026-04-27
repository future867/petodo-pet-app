from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from models import FeedRequest, FeedResult, PetInteractionRequest, PetStatus, TimerStatus
from pet_logic import PetStateMachine
from timer_logic import PomodoroTimer


app = FastAPI(title="Petodo API")
timer = PomodoroTimer()
pet = PetStateMachine()

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
    return timer.start()


@app.post("/timer/pause", response_model=TimerStatus)
def pause_timer():
    return timer.pause()


@app.post("/timer/reset", response_model=TimerStatus)
def reset_timer():
    return timer.reset()


@app.get("/timer/status", response_model=TimerStatus)
def get_timer_status():
    return timer.status()


@app.get("/pet/status", response_model=PetStatus)
def get_pet_status():
    return pet.get_pet_state(timer.status())


@app.post("/pet/interact", response_model=PetStatus)
def interact_with_pet(request: PetInteractionRequest):
    return pet.update_pet_state(timer.status(), request.interaction)


@app.post("/pet/feed", response_model=FeedResult)
def feed_pet(request: FeedRequest):
    return pet.feed(timer.status(), request.food_id)


@app.post("/pet/decay", response_model=PetStatus)
def decay_pet():
    return pet.decay_now(timer.status())
