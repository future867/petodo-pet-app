from datetime import datetime

from fastapi.testclient import TestClient

import main
import storage
from focus_records import FocusRecordBook
from pet_logic import PetStateMachine
from shop_logic import ShopLedger
from timer_logic import PomodoroTimer


class FakeClock:
    def __init__(self, value=1_700_000_000):
        self.value = value

    def now(self):
        return self.value

    def advance(self, seconds):
        self.value += seconds

    def datetime_now(self):
        return datetime.fromtimestamp(self.value)


def test_timer_start_pause_resume_and_reset():
    clock = FakeClock()
    timer = PomodoroTimer(focus_seconds=10, break_seconds=5, time_provider=clock.now)

    started = timer.start()
    assert started.mode == "focus"
    assert started.remaining_seconds == 10
    assert started.focus_cycle_id == 1

    clock.advance(3)
    paused = timer.pause()
    assert paused.mode == "paused"
    assert paused.previous_mode == "focus"
    assert 6 <= paused.remaining_seconds <= 7

    clock.advance(20)
    resumed = timer.start()
    assert resumed.mode == "focus"
    assert resumed.focus_cycle_id == 1

    reset = timer.reset()
    assert reset.mode == "idle"
    assert reset.remaining_seconds == 0


def test_focus_completion_moves_to_break_and_records_once():
    clock = FakeClock()
    timer = PomodoroTimer(focus_seconds=10, break_seconds=5, time_provider=clock.now)
    records = FocusRecordBook(datetime_provider=clock.datetime_now, storage_enabled=False)

    timer.start()
    clock.advance(11)
    status = timer.status()
    first_stats = records.sync_timer_status(status)
    second_stats = records.sync_timer_status(status)

    assert status.mode == "break"
    assert status.last_completed_focus_id == 1
    assert first_stats.total_completed_count == 1
    assert second_stats.total_completed_count == 1
    assert first_stats.today_completed_count == 1
    assert first_stats.records[0].focus_seconds == 10


def test_timer_remaining_seconds_uses_display_ceiling():
    clock = FakeClock()
    timer = PomodoroTimer(focus_seconds=10, break_seconds=5, time_provider=clock.now)

    timer.start()
    clock.advance(2.6)
    assert timer.status().remaining_seconds == 8

    clock.advance(0.4)
    assert timer.status().remaining_seconds == 7


def test_break_countdown_is_anchored_to_focus_end_time():
    clock = FakeClock()
    timer = PomodoroTimer(focus_seconds=10, break_seconds=5, time_provider=clock.now)

    timer.start()
    clock.advance(10.2)
    break_status = timer.status()

    assert break_status.mode == "break"
    assert break_status.remaining_seconds == 5

    clock.advance(4.7)
    almost_done = timer.status()
    assert almost_done.mode == "break"
    assert almost_done.remaining_seconds == 1

    clock.advance(0.2)
    finished = timer.status()
    assert finished.mode == "idle"
    assert finished.remaining_seconds == 0


def test_focus_records_do_not_skip_after_restart_with_same_focus_id():
    first_clock = FakeClock()
    first_timer = PomodoroTimer(focus_seconds=10, break_seconds=5, time_provider=first_clock.now)
    records = FocusRecordBook(datetime_provider=first_clock.datetime_now, storage_enabled=False)

    first_timer.start()
    first_clock.advance(11)
    records.sync_timer_status(first_timer.status())

    second_clock = FakeClock(value=1_700_001_000)
    second_timer = PomodoroTimer(focus_seconds=10, break_seconds=5, time_provider=second_clock.now)
    second_timer.start()
    second_clock.advance(11)
    stats = records.sync_timer_status(second_timer.status())

    assert stats.total_completed_count == 2


def test_focus_records_stats_keep_dates_and_total_seconds():
    clock = FakeClock()
    records = FocusRecordBook(datetime_provider=clock.datetime_now, storage_enabled=False)

    first_timer = PomodoroTimer(focus_seconds=25 * 60, break_seconds=5, time_provider=clock.now)
    first_timer.start()
    clock.advance(25 * 60 + 1)
    first_stats = records.sync_timer_status(first_timer.status())

    clock.advance(24 * 60 * 60)
    second_timer = PomodoroTimer(focus_seconds=50 * 60, break_seconds=5, time_provider=clock.now)
    second_timer.start()
    clock.advance(50 * 60 + 1)
    second_stats = records.sync_timer_status(second_timer.status())

    assert first_stats.today_completed_count == 1
    assert second_stats.today_completed_count == 1
    assert second_stats.total_completed_count == 2
    assert second_stats.total_focus_seconds == 75 * 60
    assert len({record.completed_date for record in second_stats.records}) == 2


def test_pet_states_follow_timer_hunger_sleep_and_feed():
    clock = FakeClock()
    timer = PomodoroTimer(focus_seconds=10, break_seconds=5, time_provider=clock.now)
    pet = PetStateMachine(
        time_provider=clock.now,
        datetime_provider=clock.datetime_now,
        storage_enabled=False,
        happy_seconds=3,
        eating_seconds=2,
        finished_eating_seconds=3,
        idle_sleep_seconds=30,
    )

    pet.set_attributes(hunger=100)
    focus_status = timer.start()
    assert pet.get_pet_state(focus_status).state == "focus"

    clock.advance(11)
    break_status = timer.status()
    assert pet.get_pet_state(break_status).state == "happy"

    clock.advance(3.1)
    assert pet.get_pet_state(timer.status()).state == "rest"

    clock.advance(2)

    timer.reset()
    pet.set_attributes(hunger=55)
    assert pet.get_pet_state(timer.status()).state == "hungry"

    pet.set_attributes(hunger=20)
    assert pet.get_pet_state(timer.status()).state == "hungry_heavy"

    pet.set_attributes(hunger=5)
    assert pet.get_pet_state(timer.status()).state == "angry"

    pet.set_attributes(hunger=100)
    clock.advance(31)
    assert pet.get_pet_state(timer.status()).state == "sleep"

    result = pet.feed(timer.status(), "fish")
    assert result.status.state == "eating"

    clock.advance(3)
    assert pet.get_pet_state(timer.status()).state == "finished_eating"

    clock.advance(4)
    shrimp_result = pet.feed(timer.status(), "shrimp")
    assert shrimp_result.food_name == "虾仁"
    assert shrimp_result.hunger_added == 0

    pet.set_attributes(hunger=40, mood=50)
    platter_result = pet.feed(timer.status(), "seafood_platter")
    assert platter_result.food_name == "海鲜拼盘"
    assert platter_result.hunger_added == 40
    assert platter_result.mood_added == 10


def test_hunger_decay_is_slow_enough_for_overnight_use():
    clock = FakeClock()
    timer = PomodoroTimer(focus_seconds=10, break_seconds=5, time_provider=clock.now)
    pet = PetStateMachine(
        time_provider=clock.now,
        datetime_provider=clock.datetime_now,
        storage_enabled=False,
        idle_sleep_seconds=24 * 60 * 60,
    )

    pet.set_attributes(hunger=100)
    clock.advance(8 * 60 * 60)
    overnight_status = pet.get_pet_state(timer.status())

    assert overnight_status.hunger == 76
    assert overnight_status.state == "idle"

    clock.advance(5 * 60 * 60)
    before_light_hungry = pet.get_pet_state(timer.status())

    assert before_light_hungry.hunger == 61
    assert before_light_hungry.state == "idle"

    clock.advance(20 * 60)
    light_hungry = pet.get_pet_state(timer.status())

    assert light_hungry.hunger == 60
    assert light_hungry.state == "idle"

    clock.advance(20 * 60)
    hungry_status = pet.get_pet_state(timer.status())

    assert hungry_status.hunger == 59
    assert hungry_status.state == "hungry"
    assert hungry_status.reason == "饱食度低于 60%，进入轻度饥饿"


def test_heavy_hunger_only_turns_angry_after_long_wait():
    clock = FakeClock()
    timer = PomodoroTimer(focus_seconds=10, break_seconds=5, time_provider=clock.now)
    pet = PetStateMachine(
        time_provider=clock.now,
        datetime_provider=clock.datetime_now,
        storage_enabled=False,
        idle_sleep_seconds=24 * 60 * 60,
        hunger_decay_seconds=24 * 60 * 60,
    )

    pet.set_attributes(hunger=25)
    heavy_status = pet.get_pet_state(timer.status())

    assert heavy_status.state == "hungry_heavy"
    assert heavy_status.reason == "饱食度低于 30%，进入重度饥饿"

    clock.advance(11 * 60 * 60 + 59 * 60)
    still_heavy = pet.get_pet_state(timer.status())

    assert still_heavy.state == "hungry_heavy"

    clock.advance(60)
    angry_status = pet.get_pet_state(timer.status())

    assert angry_status.state == "angry"
    assert angry_status.reason == "重度饥饿持续太久，建议尽快投喂"

    pet.set_attributes(hunger=5)
    very_low_status = pet.get_pet_state(timer.status())

    assert very_low_status.state == "angry"
    assert very_low_status.reason == "饱食度低于 10%，小动物已经非常饿"


def test_storage_recovers_from_broken_files(tmp_path, monkeypatch):
    pet_file = tmp_path / "pet_data.json"
    focus_file = tmp_path / "focus_records.json"
    shop_file = tmp_path / "shop_data.json"
    pet_file.write_text("{broken", encoding="utf-8")
    focus_file.write_text("{broken", encoding="utf-8")
    shop_file.write_text("{broken", encoding="utf-8")

    monkeypatch.setattr(storage, "DATA_DIR", tmp_path)
    monkeypatch.setattr(storage, "PET_DATA_FILE", pet_file)
    monkeypatch.setattr(storage, "FOCUS_DATA_FILE", focus_file)
    monkeypatch.setattr(storage, "SHOP_DATA_FILE", shop_file)

    pet_data = storage.load_pet_data(now=123)
    focus_data = storage.load_focus_data()
    shop_data = storage.load_shop_data()

    assert pet_data["hunger"] == 100
    assert focus_data["records"] == []
    assert shop_data["spent_points"] == 0
    assert shop_data["purchases"] == []

    storage.save_pet_data({"hunger": 60, "mood": 70, "energy": 80})
    assert storage.load_pet_data(now=123)["hunger"] == 60


def test_app_status_returns_main_backend_shape(monkeypatch):
    clock = FakeClock()
    test_timer = PomodoroTimer(focus_seconds=10, break_seconds=5, time_provider=clock.now)
    test_pet = PetStateMachine(
        time_provider=clock.now,
        datetime_provider=clock.datetime_now,
        storage_enabled=False,
    )
    test_records = FocusRecordBook(datetime_provider=clock.datetime_now, storage_enabled=False)
    test_shop = ShopLedger(time_provider=clock.now, storage_enabled=False)

    monkeypatch.setattr(main, "timer", test_timer)
    monkeypatch.setattr(main, "pet", test_pet)
    monkeypatch.setattr(main, "focus_records", test_records)
    monkeypatch.setattr(main, "shop", test_shop)

    client = TestClient(main.app)
    assert client.get("/health").json() == {"status": "ok"}

    start_response = client.post("/timer/start")
    assert start_response.status_code == 200
    assert start_response.json()["mode"] == "focus"

    clock.advance(11)
    status = client.get("/app/status").json()

    assert status["timer"]["mode"] == "break"
    assert status["pet"]["state"] == "happy"
    assert status["remaining_seconds"] <= 5
    assert status["today_completed_count"] == 1
    assert status["total_completed_count"] == 1
    assert status["points"] == 20


def test_points_and_shop_redeem_follow_completed_focus(monkeypatch):
    clock = FakeClock()
    test_timer = PomodoroTimer(focus_seconds=10, break_seconds=5, time_provider=clock.now)
    test_pet = PetStateMachine(
        time_provider=clock.now,
        datetime_provider=clock.datetime_now,
        storage_enabled=False,
    )
    test_records = FocusRecordBook(datetime_provider=clock.datetime_now, storage_enabled=False)
    test_shop = ShopLedger(time_provider=clock.now, storage_enabled=False)

    monkeypatch.setattr(main, "timer", test_timer)
    monkeypatch.setattr(main, "pet", test_pet)
    monkeypatch.setattr(main, "focus_records", test_records)
    monkeypatch.setattr(main, "shop", test_shop)

    client = TestClient(main.app)
    client.post("/timer/start")
    clock.advance(11)

    first_status = client.get("/app/status").json()
    second_status = client.get("/app/status").json()

    assert first_status["points"] == 20
    assert second_status["points"] == 20
    assert second_status["points_status"]["earned_points"] == 20
    assert second_status["points_status"]["spent_points"] == 0

    test_pet.set_attributes(hunger=50)
    redeemed = client.post("/shop/redeem", json={"food_id": "fish"}).json()
    after_redeem = client.get("/app/status").json()
    rejected = client.post("/shop/redeem", json={"food_id": "fish"}).json()

    assert redeemed["success"] is True
    assert redeemed["price"] == 20
    assert redeemed["remaining_points"] == 0
    assert redeemed["feed_result"]["hunger_added"] == 10
    assert after_redeem["points"] == 0
    assert after_redeem["points_status"]["spent_points"] == 20
    assert rejected["success"] is False
    assert rejected["remaining_points"] == 0
    assert rejected["feed_result"] is None
