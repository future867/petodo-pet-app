import math
import time
from threading import Lock

from models import TimerStatus


class PomodoroTimer:
    def __init__(self, focus_seconds=25 * 60, break_seconds=5 * 60, time_provider=None):
        self.focus_seconds = focus_seconds
        self.break_seconds = break_seconds
        self.time_provider = time_provider or time.time
        self.mode = "idle"
        self.previous_mode = None
        self.remaining_seconds = 0
        self.end_time = None
        self.focus_cycle_id = 0
        self.active_focus_id = None
        self.focus_started_at = None
        self.last_completed_focus_id = None
        self.last_completed_focus_started_at = None
        self.last_completed_focus_completed_at = None
        self.lock = Lock()

    def start(self):
        with self.lock:
            now = self._now()
            self._update_status()

            if self.mode == "paused" and self.previous_mode:
                self.mode = self.previous_mode
                self.end_time = now + self.remaining_seconds
            elif self.mode == "idle":
                self.focus_cycle_id += 1
                self.active_focus_id = self.focus_cycle_id
                self.focus_started_at = now
                self.mode = "focus"
                self.previous_mode = None
                self.remaining_seconds = self.focus_seconds
                self.end_time = now + self.focus_seconds

            return self._build_status()

    def pause(self):
        with self.lock:
            self._update_status()

            if self.mode in ["focus", "break"]:
                self.remaining_seconds = self._seconds_left()
                self.previous_mode = self.mode
                self.mode = "paused"
                self.end_time = None

            return self._build_status()

    def reset(self):
        with self.lock:
            self._update_status()
            self.mode = "idle"
            self.previous_mode = None
            self.remaining_seconds = 0
            self.end_time = None
            self.active_focus_id = None
            self.focus_started_at = None
            return self._build_status()

    def status(self):
        with self.lock:
            self._update_status()
            return self._build_status()

    def _update_status(self):
        if self.mode not in ["focus", "break"] or self.end_time is None:
            return

        now = self._now()
        if now < self.end_time:
            self.remaining_seconds = self._seconds_left(now)
            return

        overtime = now - self.end_time
        if self.mode == "focus":
            completed_at = self.end_time
            self._mark_focus_completed(completed_at)
            if overtime >= self.break_seconds:
                self.mode = "idle"
                self.previous_mode = None
                self.remaining_seconds = 0
                self.end_time = None
            else:
                self.mode = "break"
                self.previous_mode = None
                self.end_time = completed_at + self.break_seconds
                self.remaining_seconds = self._seconds_left(now)
        else:
            self.mode = "idle"
            self.previous_mode = None
            self.remaining_seconds = 0
            self.end_time = None

    def _seconds_left(self, now=None):
        if self.end_time is None:
            return self.remaining_seconds

        current_time = self._now() if now is None else now
        return max(0, int(math.ceil(self.end_time - current_time)))

    def _mark_focus_completed(self, completed_at):
        self.last_completed_focus_id = self.active_focus_id
        self.last_completed_focus_started_at = self.focus_started_at
        self.last_completed_focus_completed_at = completed_at
        self.active_focus_id = None
        self.focus_started_at = None

    def _build_status(self):
        if self.mode in ["focus", "break"]:
            self.remaining_seconds = self._seconds_left()

        return TimerStatus(
            mode=self.mode,
            previous_mode=self.previous_mode,
            remaining_seconds=self.remaining_seconds,
            focus_seconds=self.focus_seconds,
            break_seconds=self.break_seconds,
            is_running=self.mode in ["focus", "break"],
            focus_cycle_id=self.active_focus_id,
            last_completed_focus_id=self.last_completed_focus_id,
            last_completed_focus_started_at=self.last_completed_focus_started_at,
            last_completed_focus_completed_at=self.last_completed_focus_completed_at,
            focus_completed=self.last_completed_focus_id is not None,
        )

    def _now(self):
        return self.time_provider()
