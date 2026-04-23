import time
from datetime import datetime
from threading import Lock

from models import PetStatus, TimerStatus


class PetStateMachine:
    def __init__(
        self,
        hunger_threshold=30,
        angry_after_seconds=10 * 60,
        idle_sleep_seconds=30 * 60,
        interaction_seconds=2,
        time_provider=None,
        datetime_provider=None,
    ):
        self.time_provider = time_provider or time.time
        self.datetime_provider = datetime_provider or datetime.now
        self.hunger = 100
        self.hungry_since = None
        self.last_active_at = self._now()
        self.last_interaction = None
        self.hunger_threshold = hunger_threshold
        self.angry_after_seconds = angry_after_seconds
        self.idle_sleep_seconds = idle_sleep_seconds
        self.interaction_seconds = interaction_seconds
        self.lock = Lock()

    def get_pet_state(self, timer_status):
        return self.update_pet_state(timer_status)

    def update_pet_state(self, timer_status, interaction=None):
        with self.lock:
            now = self._now()

            if interaction in ["drag", "tap"]:
                self.last_interaction = {
                    "state": interaction,
                    "until": now + self.interaction_seconds,
                }
                self.last_active_at = now

            self._update_hungry_since(now)

            state, reason, temporary_active = self._choose_state(timer_status, now)
            return PetStatus(
                state=state,
                hunger=self.hunger,
                reason=reason,
                temporary_active=temporary_active,
                timer_mode=timer_status.mode,
            )

    def set_hunger(self, hunger):
        with self.lock:
            self.hunger = max(0, min(100, int(hunger)))
            self._update_hungry_since(self._now())

    def _choose_state(self, timer_status, now):
        if self._has_active_interaction(now):
            return self.last_interaction["state"], "用户正在和桌宠互动", True

        if timer_status.mode == "focus":
            self.last_active_at = now
            return "focus", "番茄钟正在专注", False

        if timer_status.mode == "break":
            self.last_active_at = now
            return "rest", "番茄钟正在休息", False

        if self._is_angry(now):
            return "angry", "饥饿持续太久", False

        if self.hunger < self.hunger_threshold:
            return "hungry", "饥饿值过低", False

        if self._should_sleep(now):
            return "sleep", "长时间闲置或处于休息时间段", False

        return "idle", "默认空闲状态", False

    def _update_hungry_since(self, now):
        if self.hunger < self.hunger_threshold:
            if self.hungry_since is None:
                self.hungry_since = now
        else:
            self.hungry_since = None

    def _has_active_interaction(self, now):
        if not self.last_interaction:
            return False

        if now <= self.last_interaction["until"]:
            return True

        self.last_interaction = None
        return False

    def _is_angry(self, now):
        if self.hungry_since is None:
            return False

        return now - self.hungry_since >= self.angry_after_seconds

    def _should_sleep(self, now):
        current_hour = self.datetime_provider().hour
        is_sleep_time = current_hour >= 23 or current_hour < 7
        is_idle_too_long = now - self.last_active_at >= self.idle_sleep_seconds
        return is_sleep_time or is_idle_too_long

    def _now(self, provider=None):
        current_provider = provider or self.time_provider
        return current_provider()
