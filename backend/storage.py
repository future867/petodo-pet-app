import json
import time
from pathlib import Path


DATA_DIR = Path(__file__).parent / "data"
PET_DATA_FILE = DATA_DIR / "pet_data.json"
FOCUS_DATA_FILE = DATA_DIR / "focus_records.json"
SHOP_DATA_FILE = DATA_DIR / "shop_data.json"
FISHING_DATA_FILE = DATA_DIR / "fishing_data.json"


def ensure_data_dir():
    DATA_DIR.mkdir(exist_ok=True)
    return DATA_DIR


def default_pet_data(now=None):
    current_time = now or time.time()
    return {
        "hunger": 100,
        "mood": 80,
        "energy": 80,
        "last_decay_at": current_time,
        "hungry_since": None,
        "last_active_at": current_time,
    }


def load_pet_data(now=None):
    ensure_data_dir()
    data = load_json_file(PET_DATA_FILE)
    if data is None:
        return default_pet_data(now)

    defaults = default_pet_data(now)
    for key, value in defaults.items():
        data.setdefault(key, value)

    data["hunger"] = clamp_attribute(data["hunger"])
    data["mood"] = clamp_attribute(data["mood"])
    data["energy"] = clamp_attribute(data["energy"])
    return data


def save_pet_data(data):
    save_json_file(PET_DATA_FILE, data)


def default_focus_data():
    return {
        "records": [],
        "last_recorded_focus_id": None,
        "last_recorded_focus_completed_at": None,
    }


def load_focus_data():
    ensure_data_dir()
    data = load_json_file(FOCUS_DATA_FILE)
    if data is None:
        return default_focus_data()

    records = data.get("records")
    if not isinstance(records, list):
        records = []

    valid_records = []
    for record in records:
        if not isinstance(record, dict):
            continue
        required_keys = {"focus_id", "completed_at", "focus_seconds", "completed_date"}
        if required_keys.issubset(record):
            valid_records.append(record)

    return {
        "records": valid_records,
        "last_recorded_focus_id": data.get("last_recorded_focus_id"),
        "last_recorded_focus_completed_at": data.get("last_recorded_focus_completed_at"),
    }


def save_focus_data(data):
    save_json_file(FOCUS_DATA_FILE, data)


def default_shop_data():
    return {
        "spent_points": 0,
        "purchases": [],
    }


def load_shop_data():
    ensure_data_dir()
    data = load_json_file(SHOP_DATA_FILE)
    if data is None:
        return default_shop_data()

    spent_points = data.get("spent_points", 0)
    try:
        spent_points = max(0, int(spent_points))
    except (TypeError, ValueError):
        spent_points = 0

    purchases = data.get("purchases")
    if not isinstance(purchases, list):
        purchases = []

    valid_purchases = []
    for purchase in purchases:
        if isinstance(purchase, dict) and {"food_id", "item_name", "price", "redeemed_at"}.issubset(purchase):
            valid_purchases.append(purchase)

    return {
        "spent_points": spent_points,
        "purchases": valid_purchases,
    }


def save_shop_data(data):
    save_json_file(SHOP_DATA_FILE, data)


def default_fishing_data(rewarded_focus_keys=None):
    return {
        "bait": 0,
        "completedPomodorosSinceLastFishingInvite": 0,
        "fishingCount": 0,
        "fishInventory": {
            "driedFish": 0,
            "fish": 0,
        },
        "rareFishCount": 0,
        "bonusPoints": 0,
        "rewardedFocusKeys": list(rewarded_focus_keys or []),
        "lastInviteEvaluationKey": None,
        "pendingInvitationFocusKey": None,
        "activeFishing": None,
        "lastSettlement": None,
    }


def load_fishing_data():
    ensure_data_dir()
    data = load_json_file(FISHING_DATA_FILE)
    if data is None:
        return None

    defaults = default_fishing_data()
    normalized = {**defaults, **data}
    for key in ("bait", "completedPomodorosSinceLastFishingInvite", "fishingCount", "rareFishCount", "bonusPoints"):
        try:
            normalized[key] = max(0, int(normalized.get(key, 0)))
        except (TypeError, ValueError):
            normalized[key] = 0

    inventory = data.get("fishInventory") if isinstance(data.get("fishInventory"), dict) else {}
    normalized["fishInventory"] = {}
    for key in ("driedFish", "fish"):
        try:
            normalized["fishInventory"][key] = max(0, int(inventory.get(key, 0)))
        except (TypeError, ValueError):
            normalized["fishInventory"][key] = 0

    keys = data.get("rewardedFocusKeys")
    normalized["rewardedFocusKeys"] = [str(key) for key in keys] if isinstance(keys, list) else []
    return normalized


def save_fishing_data(data):
    save_json_file(FISHING_DATA_FILE, data)


def load_json_file(file_path):
    if not file_path.exists():
        return None

    try:
        with file_path.open("r", encoding="utf-8-sig") as file:
            return json.load(file)
    except (OSError, json.JSONDecodeError):
        return None


def save_json_file(file_path, data):
    ensure_data_dir()
    with file_path.open("w", encoding="utf-8") as file:
        json.dump(data, file, ensure_ascii=False, indent=2)


def clamp_attribute(value):
    return max(0, min(100, int(value)))
