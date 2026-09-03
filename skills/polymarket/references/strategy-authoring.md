# Polymarket Strategy Authoring (NautilusTrader)

Strategy structure, order submission, share sizing, multi-instrument setups, and available data.

Reference for the `polymarket` skill. See SKILL.md for the workflow and safety rules.

---

## Strategy Authoring (NautilusTrader)

Write a NautilusTrader `Strategy` subclass in Python. The strategy receives real-time market data and submits orders. Keep the code self-contained and avoid filesystem, network, private-key, or environment access.

### Strategy Structure

```python
from nautilus_trader.config import StrategyConfig
from nautilus_trader.model.data import QuoteTick, TradeTick, Bar, BarType
from nautilus_trader.model.enums import OrderSide, TimeInForce
from nautilus_trader.model.events import OrderFilled, PositionOpened, PositionClosed
from nautilus_trader.model.identifiers import InstrumentId
from nautilus_trader.trading import Strategy


class MyStrategyConfig(StrategyConfig, frozen=True):
    instrument_id: str          # Polymarket instrument ID
    # Add strategy-specific parameters here
    trade_size: float = 10.0    # pUSD per trade


class MyStrategy(Strategy):

    def __init__(self, config: MyStrategyConfig):
        super().__init__(config)
        self.instrument_id = InstrumentId.from_str(config.instrument_id)

    def on_start(self):
        """Called when strategy starts. Subscribe to data here."""
        self.subscribe_trade_ticks(self.instrument_id)
        # also available: self.subscribe_quote_ticks(...) — live only, see note below
        # or: self.subscribe_bars(BarType.from_str("..."))

    def on_quote_tick(self, tick: QuoteTick):
        """Called on every bid/ask update (live trading)."""
        bid = float(tick.bid_price)
        ask = float(tick.ask_price)

    def on_trade_tick(self, tick: TradeTick):
        """Called on every trade execution in the market."""
        price = float(tick.price)
        size = float(tick.size)

    def on_bar(self, bar: Bar):
        """Called on every bar close (if subscribed to bars)."""
        close = float(bar.close)

    def on_order_filled(self, event: OrderFilled):
        """Called when your order is filled."""
        pass

    def on_position_opened(self, event: PositionOpened):
        pass

    def on_position_closed(self, event: PositionClosed):
        pass

    def on_order_rejected(self, event):
        """Called when an order is rejected by venue or risk engine."""
        self.log.warning(f"Order rejected: {event.reason}")

    def on_stop(self):
        """Called when strategy stops. Clean up here."""
        self.cancel_all_orders(self.instrument_id)
```

> **Backtest compatibility:** backtests replay historical **trade ticks**. A strategy whose logic lives entirely in `on_quote_tick` will do nothing in a backtest. Drive backtestable logic from `on_trade_tick`, or subscribe to both.

### Submitting Orders

**Market order (BUY — quote quantity in pUSD):**

```python
instrument = self.cache.instrument(self.instrument_id)
order = self.order_factory.market(
    instrument_id=self.instrument_id,
    order_side=OrderSide.BUY,
    quantity=instrument.make_qty(10.0),   # 10 pUSD
    time_in_force=TimeInForce.IOC,
    quote_quantity=True,                  # BUY uses pUSD amount
)
self.submit_order(order)
```

**Market order (SELL — base quantity in shares):**

```python
order = self.order_factory.market(
    instrument_id=self.instrument_id,
    order_side=OrderSide.SELL,
    quantity=instrument.make_qty(25.0),   # 25 shares
    time_in_force=TimeInForce.IOC,
)
self.submit_order(order)
```

**Limit order (GTC):**

```python
order = self.order_factory.limit(
    instrument_id=self.instrument_id,
    order_side=OrderSide.BUY,
    quantity=instrument.make_qty(10.0),
    price=instrument.make_price(0.45),
    time_in_force=TimeInForce.GTC,
    post_only=True,                       # maker only
)
self.submit_order(order)
```

### Key Rules

- **Market BUY**: use `quote_quantity=True` — quantity is the pUSD amount to spend
- **Market SELL**: use base quantity — quantity is the number of shares to sell
- **Limit orders (both sides)**: always base quantity (shares), never `quote_quantity`
- Market orders require `TimeInForce.IOC` (maps to Polymarket FAK)
- Limit orders support `GTC`, `GTD`, `FOK`, `IOC`
- Prices are 0.001 to 0.999 (probability, in pUSD)
- Use `self.cache.instrument(id)` to get the instrument for `make_qty()` and `make_price()`
- `Position.quantity` is always positive (unsigned size)
- Handle `on_order_rejected(self, event)` — orders can be rejected by the venue or risk engine
- Minimum order size: 5 pUSD (market BUY) or 5 shares (limit/sell)
- Polymarket rate limits: 30 order submissions/minute, 100 data requests/minute per user

### Converting Dollars to Shares for Limit Orders

Limit orders use share quantities, not pUSD:

```python
shares = dollar_amount / price
# e.g., $50 at price 0.25 = 200 shares
```

### Multi-Instrument Strategies

A single strategy can subscribe to and trade multiple instruments:

```python
class MultiOutcomeConfig(StrategyConfig, frozen=True):
    instrument_ids: list[str]
    trade_size: float = 10.0

class MultiOutcome(Strategy):
    def __init__(self, config: MultiOutcomeConfig):
        super().__init__(config)
        self.ids = [InstrumentId.from_str(i) for i in config.instrument_ids]

    def on_start(self):
        for iid in self.ids:
            self.subscribe_trade_ticks(iid)

    def on_trade_tick(self, tick: TradeTick):
        # tick.instrument_id tells you which instrument this tick is for
        if tick.instrument_id == self.ids[0]:
            pass  # handle first outcome
        elif tick.instrument_id == self.ids[1]:
            pass  # handle second outcome
```

For multi-outcome markets (e.g. Fed rate: hold / 25bp cut / 50bp cut), pass all outcome instrument_ids and trade across them in one strategy. Each deployment runs one strategy instance — no need for separate deployments per outcome.

### Available Data

- `self.cache.quote_tick(instrument_id)` — latest bid/ask
- `self.cache.instrument(instrument_id)` — instrument details
- `self.cache.positions(instrument_id=id)` — open positions for an instrument
- `self.clock.utc_now()` — current UTC timestamp
- `self.portfolio` — account balances and positions
