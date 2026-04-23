"""
本地存储预留文件。

后续会在这里封装 JSON 或 SQLite 的读写逻辑。
"""

from pathlib import Path


DATA_DIR = Path(__file__).parent / "data"


def ensure_data_dir():
    DATA_DIR.mkdir(exist_ok=True)
    return DATA_DIR
