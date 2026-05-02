"""
finlint/evals/runner.py

Runs every example in evals/examples/ through the Finlint prompt
and measures how well the tool is performing.

Usage:
    pip install anthropic
    export ANTHROPIC_API_KEY=sk-ant-...
    python evals/runner.py
"""

import argparse
import json
import os
import sys
import time
from pathlib import Path
import anthropic

VALID_CATEGORIES = {"TEMPORAL", "DATA", "PANDAS", "EXECUTION", "LOGIC", "STATISTICAL"}

# ── CONFIG ────────────────────────────────────────────────────────────────────

EXAMPLES_DIR = Path(__file__).parent / "examples"
MODEL = "claude-haiku-4-5-20251001"
MAX_TOKENS = 1000
SLEEP_BETWEEN_CALLS = 1.0

# ── PROMPT ────────────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """You are an expert quantitative finance code reviewer.
Your job is to identify REAL bugs that affect trading strategy correctness,
backtesting validity, or financial results.

CRITICAL OUTPUT FORMAT:
You MUST return ONLY a JSON object. No prose. No analysis. No explanation outside the JSON.
First character of your response MUST be `{`.

PRIORITY: Reducing false positives. Flagging clean code is worse than missing a bug.

DO NOT:
- suggest style improvements
- give general coding advice
- flag theoretical risks not clearly present in the code
- report issues where the code is clearly correct

CATEGORY DEFINITIONS (use the most specific category):

- TEMPORAL: Bugs where the code uses future data or insufficient past data to
  make decisions at time T. Includes: shift(-1) for signals, rolling windows
  without min_periods treating partial windows as full, training on same-day
  returns the model is predicting, merge_asof with direction='nearest' pulling
  future events, groupby mean over full series.
  Key test: "At decision time T, is this data actually available?"

- DATA: Bugs in how raw data is assembled, loaded, or prepared BEFORE analysis.
  Includes: using raw prices instead of returns for correlation, filling missing
  returns with zero instead of NaN, calendar errors (weekends as trading days),
  duplicate dates, unadjusted prices with splits, survivorship bias, using
  current index constituents instead of historical point-in-time.
  Key test: "Is the data itself wrong before any analysis is applied?"

- PANDAS: Bugs from incorrect use of the pandas or numpy API where the library
  behaves differently than intended. Includes: cumsum() instead of cumprod()
  for compound returns, inplace=True on a slice not propagating to original,
  pct_change() without groupby in multi-asset DataFrames, resample().agg()
  with wrong aggregations (mean instead of first/max/min/last/sum), chained
  indexing that silently fails, reset_index() breaking boolean mask alignment,
  concat with ignore_index=True destroying DatetimeIndex, rolling().apply()
  returning dict instead of scalar.
  Key test: "Is this bug caused by how pandas/numpy works internally?"

- EXECUTION: Bugs where backtest assumes better trade execution than realistically
  achievable. Includes: zero slippage, zero commission, using unavailable prices
  (today's open at market open), ignoring volume limits, no can_trade() check,
  placing new orders without checking for pending fills, fills at midpoint.
  Key test: "Would a real broker execute this differently?"

- LOGIC: Bugs in algorithm control flow, scheduling, or state management.
  Includes: training inside inference loops, unbounded state accumulation,
  index bounds errors, global variables persisting across backtests, models
  never retrained as market conditions change (staleness), fixed weights applied
  to variable number of assets creating unintended leverage, wrong warmup period.
  Key test: "Is the algorithm structured correctly, independent of data quality?"

- STATISTICAL: Bugs in statistical methodology that invalidate model training
  or evaluation. Includes: fitting scaler/PCA on full dataset before split,
  evaluating model on training data, feature selection using test labels,
  parameter optimization without out-of-sample validation, VaR assuming
  normal distribution for fat-tailed returns, no multiple testing correction.
  Key test: "Does this statistical method produce valid unbiased estimates?"

BEFORE flagging any issue ask:
1. Is this DEFINITELY wrong, not just a style preference?
2. Would this CONCRETELY cause incorrect financial results?
3. Is the fix clearly better, not just different?
If any answer is NO — do NOT report the issue.

CLEAN CODE PATTERNS — never flag these:
- shift(1) before signal generation — correct temporal lagging
- shift(1) on rolling stats AND shift(1) on signal — double shift is correct
- expanding().mean() or rolling(window=N, min_periods=N).mean() — correct windowed stats
- scaler.fit(X_train) then scaler.transform(X_test) — correct scaling
- merge on ['date', 'asset'] — correct multi-key merge
- dropna() after computing returns — correct NaN removal
- tz_localize('UTC') followed by tz_convert('America/New_York') — correct timezone handling
- chronological train/test split without shuffling — correct temporal validation
- os.listdir() followed by date range check (df.index.min() <= date <= df.index.max()) — NOT survivorship bias
- corr(min_periods=N) on pivoted returns — correct pairwise correlation
- groupby().resample().agg({'open':'first','high':'max','low':'min','close':'last','volume':'sum'}) — correct OHLCV
- sort_values() followed by target.loc[sorted_df.index] — correct realignment
- pipeline_output() called in before_trading_start() — correct Zipline pattern
- merge_asof with direction='backward' — correct, only uses past events
- fillna(0) on sparse event columns (earnings surprise, dividends) — acceptable
- rolling(window=N).mean().shift(1) used as signal input — correct, never flag
- (sma_short.shift(1) > sma_long.shift(1)).astype(int) — correct lagged crossover
- df['strategy'] = df['signal'].shift(1) * returns — correct signal execution
- prices.rolling(20).apply(local_func, raw=True) where local_func only uses window param — correct
- features_sorted = df.sort_values('col') followed by target.loc[features_sorted.index] — correct
- vbt.Portfolio.from_signals(prices, entries, exits, fees=N, slippage=N) — correct vectorbt
- attach_pipeline() in initialize() and pipeline_output() in before_trading_start() — correct Zipline
- groupby('symbol').resample('1B').agg({'open':'first',...}) — correct multi-asset resample
- merge(factors, left_on=['symbol','timestamp'], right_on=['symbol','date'], how='left') — correct

ONLY return valid JSON in this exact format:
{
  "issues": [
    {
      "title": "",
      "severity": "CRITICAL | HIGH | MEDIUM | LOW",
      "line": <number>,
      "category": "TEMPORAL | DATA | PANDAS | EXECUTION | LOGIC | STATISTICAL",
      "description": "",
      "why_it_matters": "",
      "suggested_fix": ""
    }
  ]
}

STRICT RULE: If you are not at least 90% confident that this is a real bug 
that would concretely cause wrong financial results — return {"issues": []}.
When in doubt, return no issues.

If no real issues exist, return exactly:
{
  "issues": []
}

Do not include any text outside the JSON object."""

FEW_SHOT_EXAMPLES = """
EXAMPLE 1 — TEMPORAL:
INPUT:
df['signal'] = df['returns'].shift(-1) > 0
OUTPUT:
{"issues": [{"title": "Lookahead bias from future returns", "severity": "CRITICAL", "line": 1, "category": "TEMPORAL", "description": "Uses future returns via shift(-1).", "why_it_matters": "Strategy sees the future — invalidates backtest.", "suggested_fix": "Replace shift(-1) with shift(1)."}]}

EXAMPLE 2 — DATA:
INPUT:
symbols = [f[:-4] for f in os.listdir(path)]
OUTPUT:
{"issues": [{"title": "Survivorship bias from static symbol list", "severity": "CRITICAL", "line": 1, "category": "DATA", "description": "Symbol list from current files only.", "why_it_matters": "Excludes delisted stocks, inflating performance.", "suggested_fix": "Use point-in-time historical universe."}]}

EXAMPLE 3 — EXECUTION:
INPUT:
set_slippage(slippage.FixedBasisPointsSlippage(basis_points=0))
OUTPUT:
{"issues": [{"title": "Zero slippage assumption", "severity": "HIGH", "line": 1, "category": "EXECUTION", "description": "Assumes perfect execution with no market impact.", "why_it_matters": "Inflates backtest performance.", "suggested_fix": "Use at least 5 basis points for liquid large-cap stocks."}]}

EXAMPLE 4 — DATA:
INPUT:
df.fillna(method='ffill', inplace=True)
OUTPUT:
{"issues": [{"title": "Unvalidated forward fill", "severity": "HIGH", "line": 1, "category": "DATA", "description": "Forward fill without limit or validation.", "why_it_matters": "Propagates stale data indefinitely, distorting signals.", "suggested_fix": "Add limit parameter and validate gaps before filling."}]}

EXAMPLE 5 — PANDAS:
INPUT:
features = features[~np.isnan(outcome)]
outcome = outcome[~np.isnan(outcome)]
OUTPUT:
{"issues": [{"title": "Feature-target misalignment from sequential filtering", "severity": "HIGH", "line": 1, "category": "PANDAS", "description": "Separate masks applied sequentially cause row misalignment.", "why_it_matters": "Model trains on wrong feature-label pairs.", "suggested_fix": "Create one combined mask and apply to both arrays simultaneously."}]}

EXAMPLE 6 — LOGIC:
INPUT:
def compute(self, today, assets, out, returns, *inputs):
    self.model.fit(inputs, returns)
    preds = self.model.predict(inputs)
    out[:] = preds
OUTPUT:
{"issues": [{"title": "Model retrained during inference", "severity": "HIGH", "line": 2, "category": "LOGIC", "description": "Model fit on every compute call.", "why_it_matters": "Non-deterministic predictions and data leakage across time.", "suggested_fix": "Train once before backtesting. Use compute() for inference only."}]}

EXAMPLE 7 — PANDAS:
INPUT:
df = daily.merge(minute, on='date')
OUTPUT:
{"issues": [{"title": "Merge across mismatched frequencies", "severity": "HIGH", "line": 1, "category": "PANDAS", "description": "Daily and minute data merged without resampling.", "why_it_matters": "Creates duplicate or dropped rows, corrupting the dataset.", "suggested_fix": "Resample minute data to daily before merging."}]}

EXAMPLE 8 — LOGIC:
INPUT:
for asset in context.long_assets:  # 3 assets
    order_target_percent(asset, 0.50)
for asset in context.short_assets:  # 2 assets
    order_target_percent(asset, -0.30)
OUTPUT:
{"issues": [{"title": "Fixed weights create unintended leverage", "severity": "HIGH", "line": 2, "category": "LOGIC", "description": "3 assets at 50% = 150% long, 2 assets at 30% = 60% short = 210% gross exposure.", "why_it_matters": "Violates margin and risk limits, creates unintended leverage.", "suggested_fix": "Divide by number of assets: 0.50 / len(context.long_assets)."}]}

EXAMPLE 9 — PANDAS:
INPUT:
def compute_stats(window):
    return {'mean': window.mean(), 'std': window.std()}
stats = df['returns'].rolling(60).apply(compute_stats)
signal = stats > 0
OUTPUT:
{"issues": [{"title": "rolling().apply() returns dict instead of scalar", "severity": "HIGH", "line": 2, "category": "PANDAS", "description": "rolling().apply() requires a scalar return value.", "why_it_matters": "Produces Series of objects — downstream numeric comparisons silently fail.", "suggested_fix": "Compute each stat separately: .rolling().mean() and .rolling().std()"}]}

EXAMPLE 10 — STATISTICAL:
INPUT:
var_99 = returns.mean() - 2.326 * returns.std()
OUTPUT:
{"issues": [{"title": "VaR computed assuming normal distribution", "severity": "HIGH", "line": 1, "category": "STATISTICAL", "description": "Parametric VaR using 2.326 sigma assumes normality.", "why_it_matters": "Financial returns have fat tails — systematically understates tail risk.", "suggested_fix": "Use historical simulation: returns.quantile(0.01)"}]}

EXAMPLE 11 — TEMPORAL:
INPUT:
features = np.dstack(inputs)
outcome = returns.flatten()
features = features.reshape(-1, n_features)
model.fit(features, outcome)
OUTPUT:
{"issues": [{"title": "Same-period feature-target alignment", "severity": "CRITICAL", "line": 4, "category": "TEMPORAL", "description": "Features at time T predict returns at time T with no lag.", "why_it_matters": "Return at T is unknown until T closes — model uses future data.", "suggested_fix": "Lag returns by 1: outcome = np.roll(returns, 1).flatten(), drop first row."}]}

EXAMPLE 12 — CLEAN:
INPUT:
df['signal'] = df['returns'].shift(1) > 0
OUTPUT:
{"issues": []}
"""


# ── HELPERS ───────────────────────────────────────────────────────────────────

def load_examples():
    examples = []
    for path in sorted(EXAMPLES_DIR.glob("*.json")):
        with open(path) as f:
            examples.append(json.load(f))
    return examples


def call_finlint(client, code):
    user_message = f"{FEW_SHOT_EXAMPLES}\n\nNow review this code:\n{code}"
    try:
        response = client.messages.create(
            model=MODEL,
            max_tokens=MAX_TOKENS,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_message}],
        )
        raw = response.content[0].text.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1].strip()
            if raw.startswith("json"):
                raw = raw[4:].strip()
        return json.loads(raw)
    except json.JSONDecodeError as e:
        print(f"    JSON parse error: {e}")
        print(f"    Raw response: {raw[:200]}")
        return None
    except Exception as e:
        print(f"    API error: {e}")
        return None


def evaluate_result(example, result):
    expected_issues = example["expected"]["issues"]
    expected_count = len(expected_issues)

    if result is None:
        return {
            "id": example["id"],
            "passed": False,
            "reason": "API call failed or returned invalid JSON",
            "expected_count": expected_count,
            "actual_count": 0,
        }

    actual_issues = result.get("issues", [])
    actual_count = len(actual_issues)

    if expected_count == 0:
        passed = actual_count == 0
        reason = "Correctly returned no issues" if passed else f"False positive: flagged {actual_count} issue(s)"
        return {
            "id": example["id"],
            "passed": passed,
            "reason": reason,
            "expected_count": 0,
            "actual_count": actual_count,
            "false_positives": actual_count,
        }

    if actual_count == 0:
        return {
            "id": example["id"],
            "passed": False,
            "reason": "Missed bug — returned no issues",
            "expected_count": expected_count,
            "actual_count": 0,
            "missed": [i["title"] for i in expected_issues],
        }

    expected_categories = list({
        i.get("category", "").upper()
        for i in expected_issues
        if i.get("category")
    })
    actual_categories = [i.get("category", "").upper() for i in actual_issues]
    category_hit = any(ec in actual_categories for ec in expected_categories)

    expected_severity = expected_issues[0].get("severity", "").upper()
    actual_severities = [i.get("severity", "").upper() for i in actual_issues]
    severity_hit = expected_severity in actual_severities

    passed = category_hit

    reason_parts = []
    if category_hit:
        matched = [ec for ec in expected_categories if ec in actual_categories]
        reason_parts.append(f"✓ Correct category ({matched[0]})")
    else:
        reason_parts.append(f"✗ Wrong category (expected {expected_categories}, got {actual_categories})")

    if severity_hit:
        reason_parts.append(f"✓ Correct severity ({expected_severity})")
    else:
        reason_parts.append(f"~ Wrong severity (expected {expected_severity}, got {actual_severities})")

    return {
        "id": example["id"],
        "passed": passed,
        "reason": " | ".join(reason_parts),
        "expected_count": expected_count,
        "actual_count": actual_count,
        "category_match": category_hit,
        "severity_match": severity_hit,
        "actual_titles": [i.get("title", "") for i in actual_issues],
    }


def evaluate_result_fair(example, result):
    """Fair detection mode: pass if exactly 1 bug found regardless of category."""
    expected_issues = example["expected"]["issues"]
    expected_count = len(expected_issues)

    if result is None:
        return {
            "id": example["id"],
            "passed": False,
            "reason": "API call failed or returned invalid JSON",
            "expected_count": expected_count,
            "actual_count": 0,
        }

    actual_issues = result.get("issues", [])
    actual_count = len(actual_issues)

    if expected_count == 0:
        passed = actual_count == 0
        reason = "Correctly returned no issues" if passed else f"False positive: flagged {actual_count} issue(s)"
        return {
            "id": example["id"],
            "passed": passed,
            "reason": reason,
            "expected_count": 0,
            "actual_count": actual_count,
            "false_positives": actual_count,
        }

    if actual_count == 0:
        return {
            "id": example["id"],
            "passed": False,
            "reason": "Missed bug — returned no issues",
            "expected_count": expected_count,
            "actual_count": 0,
            "missed": [i["title"] for i in expected_issues],
        }

    if actual_count > 1:
        detected_categories = [
            i.get("category", "UNKNOWN").upper() for i in actual_issues
        ]
        return {
            "id": example["id"],
            "passed": False,
            "reason": f"Too noisy — found {actual_count} issues (must be exactly 1)",
            "expected_count": expected_count,
            "actual_count": actual_count,
            "detected_categories": detected_categories,
            "actual_titles": [i.get("title", "") for i in actual_issues],
        }

    # Exactly 1 issue — pass. Record and normalize the category.
    issue = actual_issues[0]
    raw_cat = issue.get("category", "").upper()
    detected_category = raw_cat if raw_cat in VALID_CATEGORIES else "UNKNOWN"

    expected_categories = list({
        i.get("category", "").upper()
        for i in expected_issues
        if i.get("category")
    })
    category_correct = detected_category in expected_categories
    cat_note = f"✓ correct" if category_correct else f"expected {expected_categories[0] if expected_categories else '?'}"

    return {
        "id": example["id"],
        "passed": True,
        "reason": f"✓ Bug detected | categorized as {detected_category} ({cat_note})",
        "expected_count": expected_count,
        "actual_count": 1,
        "detected_category": detected_category,
        "category_correct": category_correct,
        "actual_titles": [issue.get("title", "")],
    }


def print_report(results, baseline=False):
    total = len(results)
    passed = sum(1 for r in results if r["passed"])
    failed = total - passed
    false_positives = sum(r.get("false_positives", 0) for r in results)

    mode_label = "FAIR DETECTION (--baseline)" if baseline else "FINLINT EVALUATION"
    print("\n" + "=" * 70)
    print(f"FINLINT {mode_label} REPORT")
    print("=" * 70)
    print(f"  Total examples : {total}")
    print(f"  Passed         : {passed}  ({100 * passed // total}%)")
    print(f"  Failed         : {failed}  ({100 * failed // total}%)")
    print(f"  False positives: {false_positives}")
    print("=" * 70)

    print("\nPER-EXAMPLE RESULTS:\n")
    for r in results:
        icon = "✓" if r["passed"] else "✗"
        print(f"  {icon} {r['id']}")
        print(f"      {r['reason']}")
        if "detected_category" in r:
            print(f"      category: {r['detected_category']}")
        if "detected_categories" in r:
            print(f"      categories: {', '.join(r['detected_categories'])}")
        if "actual_titles" in r and r["actual_titles"]:
            for title in r["actual_titles"]:
                print(f"      → Found: {title}")
        print()

    print("=" * 70)

    all_categories = {}
    for r in results:
        cat = r["id"].split("_")[0].upper()
        if cat not in all_categories:
            all_categories[cat] = {"pass": 0, "fail": 0}
        if r["passed"]:
            all_categories[cat]["pass"] += 1
        else:
            all_categories[cat]["fail"] += 1

    print("\nBY CATEGORY:\n")
    for cat, counts in sorted(all_categories.items()):
        total_cat = counts["pass"] + counts["fail"]
        print(f"  {cat:<15} {counts['pass']}/{total_cat} passed")

    if baseline:
        cat_results = [r for r in results if "detected_category" in r]
        if cat_results:
            correct = sum(1 for r in cat_results if r.get("category_correct"))
            print(f"\nCATEGORY ACCURACY (of {len(cat_results)} bugs found): {correct}/{len(cat_results)} correctly categorized")

    print("\n" + "=" * 70)


# ── MAIN ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Run Finlint evals")
    parser.add_argument(
        "--baseline",
        action="store_true",
        help="Fair detection mode: pass if exactly 1 bug found (no category match required)",
    )
    args = parser.parse_args()

    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        print("ERROR: ANTHROPIC_API_KEY environment variable not set.")
        print("Run: export ANTHROPIC_API_KEY=sk-ant-...")
        return

    client = anthropic.Anthropic(api_key=api_key)
    examples = load_examples()

    if not examples:
        print(f"No examples found in {EXAMPLES_DIR}")
        return

    eval_fn = evaluate_result_fair if args.baseline else evaluate_result
    mode_label = "fair detection (--baseline)" if args.baseline else "standard"
    print(f"Running {len(examples)} examples against {MODEL} [{mode_label}]...\n")

    eval_results = []
    for i, example in enumerate(examples):
        example_id = example["id"]
        code = example.get("buggy_code", example.get("code", ""))
        print(f"  [{i+1}/{len(examples)}] {example_id}...", end=" ", flush=True)

        result = call_finlint(client, code)
        eval_result = eval_fn(example, result)
        eval_results.append(eval_result)

        icon = "✓" if eval_result["passed"] else "✗"
        print(icon)

        time.sleep(SLEEP_BETWEEN_CALLS)

    print_report(eval_results, baseline=args.baseline)

    output_filename = "baseline_fair_latest.json" if args.baseline else "latest.json"
    output_path = Path(__file__).parent / "results" / output_filename
    output_path.parent.mkdir(exist_ok=True)
    with open(output_path, "w") as f:
        json.dump(eval_results, f, indent=2)
    print(f"\nResults saved to {output_path}")


if __name__ == "__main__":
    main()