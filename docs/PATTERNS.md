# Finlint Bug Patterns

Every pattern listed here has a corresponding example in `evals/examples/`.

## TEMPORAL
- Signal computed using future returns via `shift(-1)`
- Trading signal generated using future returns via `shift(-1)`
- Features and returns stacked and flattened without any temporal lag between them
- Total cumulative return computed over full series used to normalize individual returns
- `reindex` extends the DataFrame into future dates, then `ffill` propagates values forward
- Rolling window without `min_periods` produces values from fewer observations than the window size
- Model trained and evaluated on identical data — in-sample performance reported as strategy performance

## DATA
- Signal computed from adjusted prices but position value computed from unadjusted prices
- Missing values forward-filled without any limit or validation
- Backtest uses current index constituents instead of historical point-in-time membership (survivorship bias)
- Daily dataset merged with minute-frequency dataset on a shared `date` column
- Daily price data merged directly with intraday news data
- NaN return values filled with 0, treating missing data as zero-return days
- Features and outcome filtered with separate masks applied sequentially, causing index misalignment
- Correlation matrix computed on raw prices instead of returns
- Fundamental data merged using `report_date` instead of `filing_date`
- Returns computed from unadjusted prices containing unhandled stock splits
- Symbol list derived from files currently present on disk (survivorship bias)
- Data reindexed to calendar days including weekends, annualized using 365

## PANDAS
- Features and outcomes filtered using separate NaN masks applied sequentially
- `rolling().apply()` with a function returning a dict does not produce a multi-column DataFrame
- Boolean mask from original DataFrame applied to `reset_index` version with different index
- Chained indexing used to assign values — silently fails to modify the original DataFrame
- `pd.concat` with `ignore_index=True` resets the DatetimeIndex to integers
- Signal transition matrix computed over full dataset used for prediction
- `cumsum()` used instead of `cumprod()` for computing equity curve from returns
- NaN values filled with column mean computed over entire series including future data
- `groupby().transform()` computes mean over entire group including future data
- Code uses `iloc` to access data by date label instead of position
- `inplace=True` on a DataFrame slice may not propagate changes to the original
- After `melt()` and sort by asset/date, `shift()` applied without `groupby` contaminates across asset boundaries
- `merge_asof` with `direction='nearest'` matches each price date to the closest earnings date, which can be in the future
- `merge_asof` without tolerance matches events from arbitrarily far in the past
- Merge uses only the date column without including the asset identifier
- Outer join between prices and signals DataFrames introduces NaN rows
- `pct_change()` on multi-symbol DataFrame without `groupby` computes returns across symbol boundaries
- `dropna()` silently removes entire dates when any single asset has a missing return
- `prices.reindex().ffill()` forward fills all missing values across all assets with no limit
- OHLCV data resampled using `mean` for all columns instead of correct aggregations (open=first, high=max, low=min, close=last, volume=sum)
- Rolling apply function closes over `all_prices` from outer scope instead of using only the rolling window
- `shift(1)` applied to multi-asset DataFrame without `groupby` — last row of one asset bleeds into first row of next
- Features sorted by a column but target extracted from original unsorted order
- 5-day forward return target created with `shift(-5)` but model evaluated on same data

## EXECUTION
- Trade fills simulated at bid-ask midpoint rather than realistic ask (buys) or bid (sells)
- Orders placed without checking `data.can_trade()` — may trade halted or delisted assets
- Volume limit set to 1.0 (100% of daily volume), allowing unrealistic position sizes
- Strategy assumes execution at exact open price with no slippage
- New orders placed every bar without checking for existing open orders
- Slippage explicitly set to zero basis points
- Custom slippage model uses current bar open price for execution at market open
- Strategy uses both zero slippage and zero commission models

## LOGIC
- Monthly reset scheduled at same time as rebalance — execution order is undefined
- Global variable used to track position state instead of context object
- Index `context.i` increments without bounds checking against `context.weights` length
- Fixed weights applied to variable number of assets, creating unintended leverage
- Mutable default argument (list) persists state across function calls
- Warmup period shorter than the required moving average window
- Model fitted inside `compute()`, which is called on every pipeline execution
- Model trained only once at initialization and never updated as market conditions change
- Price history stored indefinitely in `context.prices` without size bounds
- Strategy enters positions but never has exit logic to close them

## STATISTICAL
- Feature selection performed on full dataset before train/test split
- Strategy parameters optimized on entire dataset and reported as out-of-sample performance
- 100+ strategies tested at p<0.05 without multiple testing correction
- Model trained and evaluated on the same data
- Value at Risk computed assuming normal distribution of returns
- PCA dimensionality reduction fitted on entire dataset before train/test split
- `StandardScaler` fitted on entire dataset before train-test split
- Sharpe ratio computed without subtracting the risk-free rate
- Feature includes current-day return correlated with next-day return target
- Target variable uses `shift(-1)` which represents future returns
- Scaler fitted on entire dataset before train-test split is properly applied
- Missing feature values replaced with zero before model inference
