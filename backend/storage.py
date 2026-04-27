import json
import time
from pathlib import Path


DATA_DIR = Path(__file__).parent / "data"
PET_DATA_FILE = DATA_DIR / "pet_data.json"


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
    if not PET_DATA_FILE.exists():
        return default_pet_data(now)

    try:
        with PET_DATA_FILE.open("r", encoding="utf-8-sig") as file:
            data = json.load(file)
    except (OSError, json.JSONDecodeError):
        return default_pet_data(now)

    defaults = default_pet_data(now)
    for key, value in defaults.items():
        data.setdefault(key, value)

    data["hunger"] = clamp_attribute(data["hunger"])
    data["mood"] = clamp_attribute(data["mood"])
    data["energy"] = clamp_attribute(data["energy"])
    return data


def save_pet_data(data):
    ensure_data_dir()
    with PET_DATA_FILE.open("w", encoding="utf-8") as file:
        json.dump(data, file, ensure_ascii=False, indent=2)


def clamp_attribute(value):
    return max(0, min(100, int(value)))
