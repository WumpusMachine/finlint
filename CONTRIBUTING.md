# Contributing to Finlint

## Adding a new bug example

1. Create a new JSON file in `evals/examples/`
2. Follow this format exactly:

```json
{
  "id": "category_description_001",
  "category": "TEMPORAL | DATA | PANDAS | EXECUTION | LOGIC | STATISTICAL",
  "severity": "CRITICAL | HIGH | MEDIUM | LOW",
  "language": "python",
  "buggy_code": "...",
  "description": "one sentence description of the bug",
  "explanation": "why this causes incorrect financial results",
  "suggested_fix": "what the correct code looks like",
  "expected": {
    "issues": [
      {
        "title": "short title",
        "severity": "CRITICAL | HIGH | MEDIUM | LOW",
        "category": "TEMPORAL | DATA | PANDAS | EXECUTION | LOGIC | STATISTICAL"
      }
    ]
  }
}
```

3. Run the eval suite to verify it works:
   ```
   python evals/runner.py
   ```
4. Open a pull request with your new example

## Adding a clean (no-bug) example

Clean examples help Finlint avoid false positives. Name the file `clean_description_001.json`
and set `"expected": { "issues": [] }`.

## Running the eval suite

```bash
# Standard eval (strict category match)
python evals/runner.py

# Baseline comparison (fair detection mode)
python evals/runner.py --baseline

# TypeScript comparison report (requires both result files)
npx ts-node lib/evaluate.ts
```

## Categories

| Category | Description |
|----------|-------------|
| `TEMPORAL` | Lookahead bias, future data leakage, insufficient history |
| `DATA` | Survivorship bias, bad data preparation, unadjusted prices |
| `PANDAS` | Pandas API misuse, alignment bugs, index corruption |
| `EXECUTION` | Unrealistic fills, zero slippage, order management bugs |
| `LOGIC` | Control flow errors, state bugs, stale models |
| `STATISTICAL` | Data leakage, overfitting, multiple testing |

## Code style

- Python files follow PEP 8
- TypeScript files use the existing tsconfig.json settings
- No external dependencies beyond `anthropic` and `flask` for Python code
