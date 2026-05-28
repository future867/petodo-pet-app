import random
import time
from threading import Lock
from uuid import uuid4

from models import (
    FishingInviteResponse,
    FishingSessionStatus,
    FishingSettleResponse,
    FishingStartResponse,
    FishingStatus,
    FocusRecord,
    TimerStatus,
)
from storage import default_fishing_data, load_fishing_data, save_fishing_data


RESULTS = (
    ("dried_fish", 0.35, "🍖 +1", "钓到小鱼干了喵！"),
    ("fish", 0.30, "🐟 +1", "钓到鱼了喵！"),
    ("points", 0.20, "⭐ +20", "发现闪闪的奖励喵！"),
    ("golden_fish", 0.10, "🐠 +1  ⭐ +50", "钓到金色鱼了喵！"),
    ("boot", 0.05, "👞", "怎么是破靴子……"),
)


class FishingLedger:
    def __init__(self, existing_focus_records=None, time_provider=None, random_provider=None, storage_enabled=True):
        self.time_provider = time_provider or time.time
        self.random_provider = random_provider or random.random
        self.storage_enabled = storage_enabled
        self.lock = Lock()
        existing_keys = self._focus_keys(existing_focus_records or [])
        if storage_enabled:
            loaded = load_fishing_data()
            self.data = loaded if loaded is not None else default_fishing_data(existing_keys)
        else:
            self.data = default_fishing_data(existing_keys)
        self._save()

    def sync_focus_records(self, records):
        with self.lock:
            rewarded_keys = set(self.data.get("rewardedFocusKeys", []))
            new_keys = [key for key in self._focus_keys(records) if key not in rewarded_keys]
            if not new_keys:
                return self._status()

            self.data["rewardedFocusKeys"].extend(new_keys)
            self.data["bait"] += len(new_keys)
            self.data["completedPomodorosSinceLastFishingInvite"] += len(new_keys)
            self._save()
            return self._status()

    def points_bonus(self):
        with self.lock:
            return max(0, int(self.data.get("bonusPoints", 0)))

    def status(self):
        with self.lock:
            return self._status()

    def check_invite(self, timer_status: TimerStatus):
        with self.lock:
            focus_key = self._timer_focus_key(timer_status)
            if timer_status.mode != "break" or not focus_key or self.data.get("activeFishing"):
                return FishingInviteResponse(invited=False, fishing=self._status())

            if self.data.get("lastInviteEvaluationKey") == focus_key:
                return FishingInviteResponse(
                    invited=self.data.get("pendingInvitationFocusKey") == focus_key,
                    fishing=self._status(),
                )

            self.data["lastInviteEvaluationKey"] = focus_key
            invite_count = self.data["completedPomodorosSinceLastFishingInvite"]
            probability = self._invite_probability(invite_count)
            invited = self.data["bait"] > 0 and probability > 0 and self.random_provider() < probability
            if invited:
                self.data["pendingInvitationFocusKey"] = focus_key
                self.data["completedPomodorosSinceLastFishingInvite"] = 0
            self._save()
            return FishingInviteResponse(invited=invited, fishing=self._status())

    def decline_invite(self, timer_status: TimerStatus):
        with self.lock:
            focus_key = self._timer_focus_key(timer_status)
            if focus_key and self.data.get("pendingInvitationFocusKey") == focus_key:
                self.data["pendingInvitationFocusKey"] = None
                self._save()
            return self._status()

    def start(self, timer_status: TimerStatus):
        with self.lock:
            focus_key = self._timer_focus_key(timer_status)
            if timer_status.mode != "break" or not focus_key:
                return FishingStartResponse(success=False, message="现在不是休息时间", fishing=self._status())

            if self.data.get("activeFishing"):
                return FishingStartResponse(success=True, message="小黑正在钓鱼……", fishing=self._status())

            if self.data.get("pendingInvitationFocusKey") != focus_key or self.data["bait"] <= 0:
                return FishingStartResponse(success=False, message="现在不能开始钓鱼", fishing=self._status())

            self.data["bait"] -= 1
            self.data["fishingCount"] += 1
            self.data["pendingInvitationFocusKey"] = None
            self.data["activeFishing"] = {
                "sessionId": uuid4().hex,
                "startedAt": self.time_provider(),
                "result": self._pick_result(),
            }
            self._save()
            return FishingStartResponse(success=True, message="小黑正在钓鱼……", fishing=self._status())

    def settle(self, session_id: str):
        with self.lock:
            active = self.data.get("activeFishing")
            if active and active.get("sessionId") == session_id:
                result = active["result"]
                self._apply_reward(result)
                settlement = {
                    "sessionId": session_id,
                    "result": result,
                }
                self.data["lastSettlement"] = settlement
                self.data["activeFishing"] = None
                self._save()
                return self._settle_response(result, newly_settled=True)

            previous = self.data.get("lastSettlement") or {}
            if previous.get("sessionId") == session_id:
                return self._settle_response(previous["result"], newly_settled=False)

            return FishingSettleResponse(
                success=False,
                newlySettled=False,
                fishing=self._status(),
            )

    def _apply_reward(self, result):
        if result == "dried_fish":
            self.data["fishInventory"]["driedFish"] += 1
        elif result == "fish":
            self.data["fishInventory"]["fish"] += 1
        elif result == "points":
            self.data["bonusPoints"] += 20
        elif result == "golden_fish":
            self.data["rareFishCount"] += 1
            self.data["bonusPoints"] += 50

    def _settle_response(self, result, newly_settled):
        labels = {entry[0]: entry[2] for entry in RESULTS}
        messages = {entry[0]: entry[3] for entry in RESULTS}
        return FishingSettleResponse(
            success=True,
            newlySettled=newly_settled,
            result=result,
            rewardLabel=labels[result],
            bubbleMessage=messages[result],
            fishing=self._status(),
        )

    def _status(self):
        active = self.data.get("activeFishing")
        session = None
        if isinstance(active, dict) and active.get("sessionId"):
            session = FishingSessionStatus(
                sessionId=active["sessionId"],
                startedAt=float(active["startedAt"]),
            )
        return FishingStatus(
            bait=self.data["bait"],
            completedPomodorosSinceLastFishingInvite=self.data["completedPomodorosSinceLastFishingInvite"],
            fishingCount=self.data["fishingCount"],
            fishInventory=dict(self.data["fishInventory"]),
            rareFishCount=self.data["rareFishCount"],
            pendingInvitation=bool(self.data.get("pendingInvitationFocusKey")),
            activeFishing=session,
        )

    def _pick_result(self):
        value = self.random_provider()
        cumulative = 0.0
        for result, probability, _label, _message in RESULTS:
            cumulative += probability
            if value < cumulative:
                return result
        return RESULTS[-1][0]

    def _save(self):
        if self.storage_enabled:
            save_fishing_data(self.data)

    @staticmethod
    def _invite_probability(completed_count):
        if completed_count >= 3:
            return 1.0
        if completed_count == 2:
            return 0.70
        if completed_count == 1:
            return 0.35
        return 0.0

    @staticmethod
    def _focus_keys(records):
        keys = []
        for record in records:
            if isinstance(record, FocusRecord):
                keys.append(f"{record.focus_id}:{record.completed_at}")
            elif isinstance(record, dict) and record.get("focus_id") is not None and record.get("completed_at") is not None:
                keys.append(f"{record['focus_id']}:{record['completed_at']}")
        return keys

    @staticmethod
    def _timer_focus_key(timer_status):
        if timer_status.last_completed_focus_id is None or timer_status.last_completed_focus_completed_at is None:
            return ""
        return f"{timer_status.last_completed_focus_id}:{timer_status.last_completed_focus_completed_at}"
