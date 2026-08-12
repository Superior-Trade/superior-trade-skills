# Worked Polymarket Strategies

Three complete starting points: carry/yield harvesting, momentum/news fade, and spread capture.

Reference for the `polymarket` skill. See SKILL.md for the workflow and safety rules.

---

## Example Strategies

### Carry / Yield Harvesting

Buy high-probability outcomes near resolution. The "T-Bill" of prediction markets. Resolution risk applies: a 0.95 outcome that resolves NO loses everything staked.

```python
from nautilus_trader.config import StrategyConfig
from nautilus_trader.model.data import TradeTick
from nautilus_trader.model.enums import OrderSide, TimeInForce
from nautilus_trader.model.identifiers import InstrumentId
from nautilus_trader.trading import Strategy


class CarryConfig(StrategyConfig, frozen=True):
    instrument_id: str
    min_probability: float = 0.90
    max_probability: float = 0.99
    trade_size_pusd: float = 50.0


class Carry(Strategy):
    def __init__(self, config: CarryConfig):
        super().__init__(config)
        self.instrument_id = InstrumentId.from_str(config.instrument_id)
        self._has_position = False

    def on_start(self):
        self.subscribe_trade_ticks(self.instrument_id)

    def on_trade_tick(self, tick: TradeTick):
        if self._has_position:
            return
        price = float(tick.price)
        if self.config.min_probability <= price <= self.config.max_probability:
            instrument = self.cache.instrument(self.instrument_id)
            order = self.order_factory.market(
                instrument_id=self.instrument_id,
                order_side=OrderSide.BUY,
                quantity=instrument.make_qty(self.config.trade_size_pusd),
                time_in_force=TimeInForce.IOC,
                quote_quantity=True,
            )
            self.submit_order(order)

    def on_position_opened(self, event):
        self._has_position = True

    def on_position_closed(self, event):
        self._has_position = False

    def on_stop(self):
        self.cancel_all_orders(self.instrument_id)
```

### Momentum / News Fade

Buy when probability drops sharply (overreaction), sell when it recovers.

```python
from nautilus_trader.config import StrategyConfig
from nautilus_trader.model.data import TradeTick
from nautilus_trader.model.enums import OrderSide, TimeInForce
from nautilus_trader.model.identifiers import InstrumentId
from nautilus_trader.trading import Strategy


class MomentumFadeConfig(StrategyConfig, frozen=True):
    instrument_id: str
    lookback_ticks: int = 20
    drop_threshold: float = -0.05
    recovery_threshold: float = 0.02
    trade_size_pusd: float = 25.0


class MomentumFade(Strategy):
    def __init__(self, config: MomentumFadeConfig):
        super().__init__(config)
        self.instrument_id = InstrumentId.from_str(config.instrument_id)
        self._prices = []
        self._has_position = False

    def on_start(self):
        self.subscribe_trade_ticks(self.instrument_id)

    def on_trade_tick(self, tick: TradeTick):
        price = float(tick.price)
        self._prices.append(price)
        if len(self._prices) > self.config.lookback_ticks:
            self._prices.pop(0)
        if len(self._prices) < self.config.lookback_ticks:
            return

        recent_return = (price - self._prices[0]) / self._prices[0]
        instrument = self.cache.instrument(self.instrument_id)

        if not self._has_position and recent_return < self.config.drop_threshold:
            order = self.order_factory.market(
                instrument_id=self.instrument_id,
                order_side=OrderSide.BUY,
                quantity=instrument.make_qty(self.config.trade_size_pusd),
                time_in_force=TimeInForce.IOC,
                quote_quantity=True,
            )
            self.submit_order(order)

        elif self._has_position and recent_return > self.config.recovery_threshold:
            positions = self.cache.positions(instrument_id=self.instrument_id)
            for pos in positions:
                if pos.is_open:
                    order = self.order_factory.market(
                        instrument_id=self.instrument_id,
                        order_side=OrderSide.SELL,
                        quantity=instrument.make_qty(float(pos.quantity)),
                        time_in_force=TimeInForce.IOC,
                    )
                    self.submit_order(order)

    def on_position_opened(self, event):
        self._has_position = True

    def on_position_closed(self, event):
        self._has_position = False

    def on_stop(self):
        self.cancel_all_orders(self.instrument_id)
```

### Spread Capture / Market Making

Live-only reference. Do **not** use this as a filled-data backtest template: it needs quote/order-book state, queue assumptions, and spread realism that current Polymarket backtests do not replay. Watch the rate limit: cancelling and re-quoting on every tick can exceed 30 orders/minute on active markets.

```python
from nautilus_trader.config import StrategyConfig
from nautilus_trader.model.data import QuoteTick
from nautilus_trader.model.enums import OrderSide, TimeInForce
from nautilus_trader.model.events import OrderFilled
from nautilus_trader.model.identifiers import InstrumentId
from nautilus_trader.trading import Strategy


class SpreadCaptureConfig(StrategyConfig, frozen=True):
    instrument_id: str
    spread_width: float = 0.02
    order_size: float = 10.0
    max_inventory: float = 100.0


class SpreadCapture(Strategy):
    def __init__(self, config: SpreadCaptureConfig):
        super().__init__(config)
        self.instrument_id = InstrumentId.from_str(config.instrument_id)
        self._net_qty = 0.0

    def on_start(self):
        self.subscribe_quote_ticks(self.instrument_id)

    def on_quote_tick(self, tick: QuoteTick):
        self.cancel_all_orders(self.instrument_id)
        if abs(self._net_qty) >= self.config.max_inventory:
            return

        bid = float(tick.bid_price)
        ask = float(tick.ask_price)
        mid = (bid + ask) / 2
        half = self.config.spread_width / 2
        our_bid = mid - half
        our_ask = mid + half

        if our_bid <= 0 or our_ask >= 1:
            return

        instrument = self.cache.instrument(self.instrument_id)

        bid_order = self.order_factory.limit(
            instrument_id=self.instrument_id,
            order_side=OrderSide.BUY,
            quantity=instrument.make_qty(self.config.order_size),
            price=instrument.make_price(our_bid),
            time_in_force=TimeInForce.GTC,
            post_only=True,
        )
        self.submit_order(bid_order)

        ask_order = self.order_factory.limit(
            instrument_id=self.instrument_id,
            order_side=OrderSide.SELL,
            quantity=instrument.make_qty(self.config.order_size),
            price=instrument.make_price(our_ask),
            time_in_force=TimeInForce.GTC,
            post_only=True,
        )
        self.submit_order(ask_order)

    def on_order_filled(self, event: OrderFilled):
        qty = float(event.last_qty)
        if event.order_side == OrderSide.BUY:
            self._net_qty += qty
        else:
            self._net_qty -= qty

    def on_stop(self):
        self.cancel_all_orders(self.instrument_id)
```

