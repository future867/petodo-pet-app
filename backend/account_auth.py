import hashlib
import hmac
import secrets
import time
from threading import Lock

from storage import ACCOUNTS_DATA_FILE, load_json_file, save_json_file


PASSWORD_ITERATIONS = 120_000


class AccountError(ValueError):
    pass


class AccountExistsError(AccountError):
    pass


class InvalidCredentialsError(AccountError):
    pass


class AccountBook:
    def __init__(self, time_provider=None):
        self.time_provider = time_provider or time.time
        self.lock = Lock()
        self.data = self._load()

    def create_account(self, account_name, password, display_name=None):
        normalized = normalize_account_name(account_name)
        validate_password(password)

        with self.lock:
            if normalized in self.data["accounts"]:
                raise AccountExistsError("账号已存在")

            account_id = create_account_id(normalized)
            now = self.time_provider()
            account = {
                "account_id": account_id,
                "account_name": account_name.strip(),
                "display_name": (display_name or account_name).strip(),
                "normalized_name": normalized,
                "password": hash_password(password),
                "created_at": now,
                "updated_at": now,
            }
            self.data["accounts"][normalized] = account
            self._save()
            return public_account(account)

    def login(self, account_name, password):
        normalized = normalize_account_name(account_name)

        with self.lock:
            account = self.data["accounts"].get(normalized)
            if not account or not verify_password(password, account.get("password", {})):
                raise InvalidCredentialsError("账号或密码不正确")
            return public_account(account)

    def account_by_id(self, account_id):
        if not account_id:
            return None

        with self.lock:
            for account in self.data["accounts"].values():
                if account.get("account_id") == account_id:
                    return public_account(account)
        return None

    def update_display_name(self, account_id, display_name):
        name = str(display_name or "").strip()
        if not name:
            raise AccountError("昵称不能为空")

        with self.lock:
            for account in self.data["accounts"].values():
                if account.get("account_id") == account_id:
                    account["display_name"] = name
                    account["updated_at"] = self.time_provider()
                    self._save()
                    return public_account(account)
        raise AccountError("账号不存在")

    def _load(self):
        data = load_json_file(ACCOUNTS_DATA_FILE) or {}
        accounts = data.get("accounts")
        if not isinstance(accounts, dict):
            accounts = {}
        return {"accounts": accounts}

    def _save(self):
        save_json_file(ACCOUNTS_DATA_FILE, self.data)


def normalize_account_name(account_name):
    normalized = str(account_name or "").strip().casefold()
    if not normalized:
        raise AccountError("请输入账号")
    return normalized


def validate_password(password):
    if len(str(password or "")) < 4:
        raise AccountError("密码至少需要 4 位")


def create_account_id(normalized_name):
    return hashlib.sha256(normalized_name.encode("utf-8")).hexdigest()[:24]


def hash_password(password):
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256",
        str(password).encode("utf-8"),
        salt.encode("utf-8"),
        PASSWORD_ITERATIONS,
    ).hex()
    return {
        "algorithm": "pbkdf2_sha256",
        "iterations": PASSWORD_ITERATIONS,
        "salt": salt,
        "digest": digest,
    }


def verify_password(password, saved):
    if not isinstance(saved, dict):
        return False

    try:
        iterations = int(saved.get("iterations", PASSWORD_ITERATIONS))
        salt = str(saved["salt"])
        expected = str(saved["digest"])
    except (KeyError, TypeError, ValueError):
        return False

    actual = hashlib.pbkdf2_hmac(
        "sha256",
        str(password).encode("utf-8"),
        salt.encode("utf-8"),
        iterations,
    ).hex()
    return hmac.compare_digest(actual, expected)


def public_account(account):
    return {
        "account_id": account["account_id"],
        "account_name": account["account_name"],
        "display_name": account.get("display_name") or account["account_name"],
    }
