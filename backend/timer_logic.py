import time
from threading import Lock

from models import TimerStatus


class PomodoroTimer:
    def __init__(self, focus_seconds=25 * 60, break_seconds=5 * 60):
        self.focus_seconds = focus_seconds
        self.break_seconds = break_seconds
        self.mode = "idle"
        self.previous_mode = None
        self.remaining_seconds = 0
        self.end_time = None
        self.lock = Lock()

    def start(self):
        with self.lock:
            self._update_status()

            if self.mode == "paused" and self.previous_mode:
                self.mode = self.previous_mode
                self.end_time = time.time() + self.remaining_seconds
            elif self.mode == "idle":
                self.mode = "focus"
                self.previous_mode = None
                self.remaining_seconds = self.focus_seconds
                self.end_time = time.time() + self.focus_seconds

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
            self.mode = "idle"
            self.previous_mode = None
            self.remaining_seconds = 0
            self.end_time = None
            return self._build_status()

    def status(self):
        with self.lock:
            self._update_status()
            return self._build_status()

    def _update_status(self):
        if self.mode not in ["focus", "break"] or self.end_time is None:
            return

        now = time.time()
        if now < self.end_time:
            self.remaining_seconds = self._seconds_left(now)
            return

        overtime = now - self.end_time
        if self.mode == "focus":
            if overtime >= self.break_seconds:
                self.mode = "idle"
                self.previous_mode = None
                self.remaining_seconds = 0
                self.end_time = None
            else:
                self.mode = "break"
                self.previous_mode = None
                self.remaining_seconds = max(0, int(round(self.break_seconds - overtime)))
                self.end_time = now + self.remaining_seconds
        else:
            self.mode = "idle"
            self.previous_mode = None
            self.remaining_seconds = 0
            self.end_time = None

    def _seconds_left(self, now=None):
        if self.end_time is None:
            return self.remaining_seconds

        current_time = now or time.time()
        return max(0, int(round(self.end_time - current_time)))

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
        )
