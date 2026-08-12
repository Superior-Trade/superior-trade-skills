# Aerodrome Troubleshooting

Diagnosing failed swaps, gas problems, and zero-trade deployments.

Reference for the `aerodrome` skill. See SKILL.md for the workflow and safety rules.

---

## Troubleshooting

- Validation says Aerodrome only supports spot: remove `trading_mode: "futures"`, `trading_mode: "margin"`, and `margin_mode`.
- Validation says stake currency is not present in markets: align `stake_currency` with the quote or base token in `exchange.ccxt_config.options.markets`.
- Orderbook errors: remove `use_order_book`, `order_book_top`, depth checks, and strategy calls to `self.dp.orderbook()`.
- Zero trades: check wallet token balance, ETH gas, numeric `stake_amount`, data availability, and overly restrictive entry conditions.
- Market buy requires price: keep Freqtrade market order config and avoid hand-calling CCXT without price; Aerodrome market buys need price context for cost calculation.
- Aerodrome swaps are atomic, so stopping the bot does not need a position-close cleanup routine.
