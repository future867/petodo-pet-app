import time
from datetime import datetime
from threading import Lock

from models import FeedResult, PetAttributes, PetStatus, TimerStatus
from storage import clamp_attribute, default_pet_data, load_pet_data, save_pet_data


FOODS = {
    "hamburger": {
        "name": "汉堡",
        "hunger": 10,
        "mood": 0,
    },
    "pizza": {
        "name": "披萨",
        "hunger": 25,
        "mood": 0,
    },
    "chicken_leg": {
        "name": "鸡腿",
        "hunger": 40,
        "mood": 0,
    },
}


class PetStateMachine:
    def __init__(
        self,
        hunger_threshold=30,
        angry_after_seconds=12 * 60 * 60,
        idle_sleep_seconds=30 * 60,
        interaction_seconds=2,
        eating_seconds=2.2,
        finished_eating_seconds=3,
        happy_seconds=3,
        hunger_decay_seconds=20 * 60,
        time_provider=None,
        datetime_provider=None,
        storage_enabled=True,
    ):
        self.time_provider = time_provider or time.time
        self.datetime_provider = datetime_provider or datetime.now
        self.hunger_threshold = hunger_threshold
        self.angry_after_seconds = angry_after_seconds
        self.idle_sleep_seconds = idle_sleep_seconds
        self.interaction_seconds = interaction_seconds
        self.eating_seconds = eating_seconds
        self.finished_eating_seconds = finished_eating_seconds
        self.happy_seconds = happy_seconds
        self.hunger_decay_seconds = hunger_decay_seconds
        self.storage_enabled = storage_enabled
        self.temporary_state = None
        self.lock = Lock()

        now = self._now()
        self.data = load_pet_data(now) if storage_enabled else default_pet_data(now)
        self._update_hungry_since(now)
        self._save()

    def get_pet_state(self, timer_status):
        return self.update_pet_state(timer_status)

    def update_pet_state(self, timer_status, interaction=None):
        with self.lock:
            now = self._now()
            self._decay_hunger(now)

            if interaction == "tap":
                self.temporary_state = {
                    "state": interaction,
                    "until": now + self.interaction_seconds,
                    "reason": "用户正在和桌宠互动",
                }
                self.data["last_active_at"] = now
                self._save()

            state, reason, temporary_active = self._choose_state(timer_status, now)
            return self._build_status(state, reason, temporary_active, timer_status.mode)

    def feed(self, timer_status, food_id):
        with self.lock:
            now = self._now()
            self._decay_hunger(now)

            food = FOODS[food_id]
            old_hunger = self.data["hunger"]
            old_mood = self.data["mood"]
            self.data["hunger"] = clamp_attribute(old_hunger + food["hunger"])
            self.data["mood"] = clamp_attribute(old_mood + food["mood"])
            self.data["last_active_at"] = now
            self._update_hungry_since(now)
            self.temporary_state = {
                "state": f"eating_{food_id}",
                "until": now + self.eating_seconds,
                "next_state": "finished_eating",
                "next_until": now + self.eating_seconds + self.finished_eating_seconds,
                "reason": f"正在吃{food['name']}",
                "next_reason": "吃完后很开心",
            }
            self._save()

            state, reason, temporary_active = self._choose_state(timer_status, now)
            return FeedResult(
                food_id=food_id,
                food_name=food["name"],
                message=f"已喂食{food['name']}",
                hunger_added=self.data["hunger"] - old_hunger,
                mood_added=self.data["mood"] - old_mood,
                status=self._build_status(state, reason, temporary_active, timer_status.mode),
            )

    def decay_now(self, timer_status):
        with self.lock:
            now = self._now()
            self._decay_hunger(now)
            state, reason, temporary_active = self._choose_state(timer_status, now)
            return self._build_status(state, reason, temporary_active, timer_status.mode)

    def set_attributes(self, hunger=None, mood=None, energy=None):
        with self.lock:
            now = self._now()
            if hunger is not None:
                self.data["hunger"] = clamp_attribute(hunger)
            if mood is not None:
                self.data["mood"] = clamp_attribute(mood)
            if energy is not None:
                self.data["energy"] = clamp_attribute(energy)
            self._update_hungry_since(now)
            self._save()

    def _decay_hunger(self, now):
        last_decay_at = self.data.get("last_decay_at", now)
        elapsed_seconds = max(0, now - last_decay_at)
        decay_points = int(elapsed_seconds // self.hunger_decay_seconds)
        if decay_points <= 0:
            return

        self.data["hunger"] = clamp_attribute(self.data["hunger"] - decay_points)
        self.data["last_decay_at"] = last_decay_at + decay_points * self.hunger_decay_seconds
        self._update_hungry_since(now)
        self._save()

    def _choose_state(self, timer_status, now):
        temporary = self._get_temporary_state(now)
        if temporary:
            return temporary["state"], temporary["reason"], True

        if timer_status.mode == "focus":
            self.data["last_active_at"] = now
            self._save()
            return "focus", "番茄钟正在专注", False

        if self._should_show_happy(timer_status, now):
            self.data["last_active_at"] = now
            self._save()
            return "happy", "刚完成一次专注", True

        if timer_status.mode == "break":
            self.data["last_active_at"] = now
            self._save()
            return "rest", "番茄钟正在休息", False

        if self.data["hunger"] < 10:
            return "angry", "饱食度低于 10%，小动物已经非常饿", False

        if self._is_angry(now):
            return "angry", "重度饥饿持续太久，建议尽快投喂", False

        if self.data["hunger"] < 30:
            return "hungry_heavy", "饱食度低于 30%，进入重度饥饿", False

        if self.data["hunger"] < 60:
            return "hungry", "饱食度低于 60%，进入轻度饥饿", False

        if self._should_sleep(now):
            return "sleep", "长时间闲置或处于休息时间段", False

        return "idle", "默认空闲状态", False

    def _update_hungry_since(self, now):
        if self.data["hunger"] < self.hunger_threshold:
            if self.data.get("hungry_since") is None:
                self.data["hungry_since"] = now
        else:
            self.data["hungry_since"] = None

    def _get_temporary_state(self, now):
        if not self.temporary_state:
            return None

        if now <= self.temporary_state["until"]:
            return {
                "state": self.temporary_state["state"],
                "reason": self.temporary_state["reason"],
            }

        next_state = self.temporary_state.get("next_state")
        next_until = self.temporary_state.get("next_until")
        if next_state and next_until and now <= next_until:
            return {
                "state": next_state,
                "reason": self.temporary_state.get("next_reason", "临时状态"),
            }

        self.temporary_state = None
        return None

    def _should_show_happy(self, timer_status, now):
        completed_at = timer_status.last_completed_focus_completed_at
        if completed_at is None:
            return False

        return 0 <= now - completed_at <= self.happy_seconds

    def _is_angry(self, now):
        hungry_since = self.data.get("hungry_since")
        if hungry_since is None:
            return False

        return now - hungry_since >= self.angry_after_seconds

    def _should_sleep(self, now):
        current_hour = self.datetime_provider().hour
        is_sleep_time = current_hour >= 23 or current_hour < 7
        is_idle_too_long = now - self.data.get("last_active_at", now) >= self.idle_sleep_seconds
        return is_sleep_time or is_idle_too_long

    def _build_status(self, state, reason, temporary_active, timer_mode):
        attributes = PetAttributes(
            hunger=self.data["hunger"],
            mood=self.data["mood"],
            energy=self.data["energy"],
        )
        return PetStatus(
            state=state,
            attributes=attributes,
            hunger=attributes.hunger,
            mood=attributes.mood,
            energy=attributes.energy,
            reason=reason,
            temporary_active=temporary_active,
            timer_mode=timer_mode,
        )

    def _save(self):
        if self.storage_enabled:
            save_pet_data(self.data)

    def _now(self):
        return self.time_provider()
