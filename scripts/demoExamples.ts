// ── TYPES ─────────────────────────────────────────────────────────────────────

export interface DemoIssue {
  title:       string;
  severity:    "critical" | "warning" | "info";
  category:    string;
  description: string;
}

export interface DemoExample {
  id:             string;
  code:           string;
  expectedIssues: DemoIssue[];
}

// ── EXAMPLES ──────────────────────────────────────────────────────────────────

export const DEMO_EXAMPLES: DemoExample[] = [
  // 1 — Clear bug: lookahead bias
  {
    id: "lookahead_bias",
    code: [
      "# Momentum strategy signal",
      "df['signal'] = df['close'].rolling(20).mean().shift(-1)",
      "df['position'] = df['signal'].gt(df['close']).astype(int)",
      "df['returns'] = df['position'] * df['close'].pct_change()",
    ].join("\n"),
    expectedIssues: [
      {
        title:       "Negative shift introduces lookahead bias",
        severity:    "critical",
        category:    "TEMPORAL",
        description: "shift(-1) moves the signal one row backward, so today's decision uses tomorrow's closing price.",
      },
    ],
  },
  // 2 — Subtle bug: scaler data leakage
  {
    id: "scaler_leakage",
    code: [
      "from sklearn.preprocessing import StandardScaler",
      "from sklearn.model_selection import train_test_split",
      "",
      "scaler = StandardScaler()",
      "X_scaled = scaler.fit_transform(X)          # leaks test stats",
      "X_train, X_test = train_test_split(X_scaled, test_size=0.2)",
      "model.fit(X_train, y_train)",
      "print('OOS score:', model.score(X_test, y_test))",
    ].join("\n"),
    expectedIssues: [
      {
        title:       "Scaler fitted on full dataset before train/test split",
        severity:    "critical",
        category:    "STATISTICAL",
        description: "fit_transform is called on all data before splitting — test-set statistics contaminate the scaler's mean and variance.",
      },
    ],
  },
  // 3 — Clean example: no issues
  {
    id: "clean_signal",
    code: [
      "# Correctly lagged signal with slippage model",
      "df = df.copy()",
      "df['signal'] = df['close'].rolling(20).mean().shift(1)",
      "df['position'] = df['signal'].gt(df['close']).astype(int)",
      "slippage = 0.001",
      "df['ret'] = df['position'].shift(1) * (df['close'].pct_change() - slippage)",
    ].join("\n"),
    expectedIssues: [],
  },
];
