from datetime import datetime
from threading import Lock

from models import FocusRecord, FocusStats, TimerStatus
from storage import load_focus_data, save_focus_data


class FocusRecordBook:
    def __init__(self, datetime_provider=None, storage_enabled=True):
        self.datetime_provider = datetime_provider or datetime.now
        self.storage_enabled = storage_enabled
        self.lock = Lock()
        self.data = load_focus_data() if storage_enabled else self._default_data()

    def sync_timer_status(self, timer_status: TimerStatus):
        focus_id = timer_status.last_completed_focus_id
        completed_at = timer_status.last_completed_focus_completed_at
        if focus_id is None or completed_at is None:
            return self.stats()

        with self.lock:
            if (
                self.data.get("last_recorded_focus_id") == focus_id
                and self.data.get("last_recorded_focus_completed_at") == completed_at
            ):
                return self._build_stats()

            completed_dt = datetime.fromtimestamp(completed_at)
            record = {
                "focus_id": focus_id,
                "started_at": timer_status.last_completed_focus_started_at,
                "completed_at": completed_at,
                "focus_seconds": timer_status.focus_seconds,
                "completed_date": completed_dt.strftime("%Y-%m-%d"),
            }
            self.data.setdefault("records", []).append(record)
            self.data["last_recorded_focus_id"] = focus_id
            self.data["last_recorded_focus_completed_at"] = completed_at
            self._save()
            return self._build_stats()

    def stats(self):
        with self.lock:
            return self._build_stats()

    def _build_stats(self):
        records = [self._normalize_record(record) for record in self.data.get("records", [])]
        today = self.datetime_provider().strftime("%Y-%m-%d")
        return FocusStats(
            today_completed_count=sum(1 for record in records if record.completed_date == today),
            total_completed_count=len(records),
            total_focus_seconds=sum(record.focus_seconds for record in records),
            records=records,
        )

    def _normalize_record(self, record):
        return FocusRecord(
            focus_id=int(record["focus_id"]),
            started_at=record.get("started_at"),
            completed_at=float(record["completed_at"]),
            focus_seconds=int(record["focus_seconds"]),
            completed_date=str(record["completed_date"]),
        )

    def _save(self):
        if self.storage_enabled:
            save_focus_data(self.data)

    def _default_data(self):
        return {"records": [], "last_recorded_focus_id": None, "last_recorded_focus_completed_at": None}
