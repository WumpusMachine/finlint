export const DEFAULT_CODE = `import pandas as pd
import numpy as np

# ── Load price data ──────────────────────────────────────────────
df = pd.read_csv("prices.csv", parse_dates=["date"], index_col="date")

# ── Feature engineering ──────────────────────────────────────────
df["sma_20"]  = df["close"].rolling(20).mean()
df["sma_50"]  = df["close"].rolling(50).mean()
df["returns"] = df["close"].pct_change()

# ── Signal: SMA crossover ────────────────────────────────────────
df["signal"] = np.where(df["sma_20"] > df["sma_50"], 1, -1)

# ── Backtest ─────────────────────────────────────────────────────
df["strat_returns"] = df["signal"] * df["returns"]
total = df["strat_returns"].sum()
sharpe = df["strat_returns"].mean() / df["strat_returns"].std() * np.sqrt(252)

print(f"Total return : {total:.2%}")
print(f"Sharpe ratio : {sharpe:.2f}")
`;

export const EXAMPLE_SNIPPETS: Record<string, { label: string; code: string }> = {
  default: {
    label: "SMA Crossover",
    code: DEFAULT_CODE,
  },
  lookahead: {
    label: "Lookahead Bias",
    code: `import pandas as pd

def backtest(df):
    # BUG: shift(-20) leaks future prices into the signal
    df["signal"] = df["close"].rolling(20).max().shift(-20)
    df["position"] = (df["close"] < df["signal"]).astype(int)
    df["returns"] = df["position"] * df["close"].pct_change()
    return df["returns"].sum()
`,
  },
  leakage: {
    label: "Data Leakage",
    code: `from sklearn.preprocessing import StandardScaler
import pandas as pd

def prepare(df):
    # BUG: fit on full dataset before split — test data contaminates scaler
    scaler = StandardScaler()
    df["scaled"] = scaler.fit_transform(df[["close"]])

    train = df.iloc[: int(len(df) * 0.8)]
    test  = df.iloc[int(len(df) * 0.8) :]
    return train, test
`,
  },
  slippage: {
    label: "Zero Slippage",
    code: `import pandas as pd

def backtest(prices: pd.Series) -> float:
    # BUG: no slippage, no commission — PnL is fantasy at HF
    position = 1
    entry = prices.iloc[0]
    exit_  = prices.iloc[-1]
    return (exit_ - entry) / entry
`,
  },
};
