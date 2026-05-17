import time
from threading import Lock

from models import FeedResult, FocusStats, PointsStatus, ShopRedeemResult, TimerStatus
from pet_logic import FOODS, PetStateMachine
from storage import default_shop_data, load_shop_data, save_shop_data


POINTS_PER_FOCUS = 20

SHOP_ITEMS = {
    "fish": {
        "name": FOODS["fish"]["name"],
        "price": 20,
    },
    "shrimp": {
        "name": FOODS["shrimp"]["name"],
        "price": 50,
    },
    "seafood_platter": {
        "name": FOODS["seafood_platter"]["name"],
        "price": 100,
    },
}


class ShopLedger:
    def __init__(self, time_provider=None, storage_enabled=True):
        self.time_provider = time_provider or time.time
        self.storage_enabled = storage_enabled
        self.lock = Lock()
        self.data = load_shop_data() if storage_enabled else default_shop_data()

    def points_status(self, focus_stats: FocusStats):
        spent_points = self._spent_points()
        earned_points = focus_stats.total_completed_count * POINTS_PER_FOCUS
        return PointsStatus(
            points_per_focus=POINTS_PER_FOCUS,
            earned_points=earned_points,
            spent_points=spent_points,
            current_points=max(0, earned_points - spent_points),
        )

    def redeem_food(self, food_id: str, focus_stats: FocusStats, pet: PetStateMachine, timer_status: TimerStatus):
        item = SHOP_ITEMS[food_id]
        status = self.points_status(focus_stats)
        price = int(item["price"])

        with self.lock:
            status = self.points_status(focus_stats)
            if status.current_points < price:
                return ShopRedeemResult(
                    success=False,
                    food_id=food_id,
                    item_name=item["name"],
                    price=price,
                    remaining_points=status.current_points,
                    message=f"积分不足，还差 {price - status.current_points} 积分",
                    feed_result=None,
                )

            feed_result = pet.feed(timer_status, food_id)
            self.data["spent_points"] = self._spent_points() + price
            self.data.setdefault("purchases", []).append(
                {
                    "food_id": food_id,
                    "item_name": item["name"],
                    "price": price,
                    "redeemed_at": self.time_provider(),
                }
            )
            self._save()
            remaining_points = max(0, status.current_points - price)

        return ShopRedeemResult(
            success=True,
            food_id=food_id,
            item_name=item["name"],
            price=price,
            remaining_points=remaining_points,
            message=f"已兑换{item['name']}，扣除 {price} 积分",
            feed_result=feed_result,
        )

    def _spent_points(self):
        try:
            return max(0, int(self.data.get("spent_points", 0)))
        except (TypeError, ValueError):
            return 0

    def _save(self):
        if self.storage_enabled:
            save_shop_data(self.data)
