# Finlint

AI-powered code reviewer for quantitative finance and backtesting systems.

![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)
![Python](https://img.shields.io/badge/python-3.8+-blue.svg)
![Node](https://img.shields.io/badge/node-18+-green.svg)
![Model](https://img.shields.io/badge/model-Claude%20Haiku%204.5-blueviolet.svg)

Finlint finds bugs that make backtests look profitable while the live strategy fails — lookahead bias, survivorship bias, ML data leakage, unrealistic execution assumptions, and more. It uses Claude as the analysis engine and ships with an evaluated prompt, a labeled example dataset, and a one-command demo.

---

## Quick Install

```powershell
# Windows — one command
irm https://raw.githubusercontent.com/your-username/finlint/main/get-finlint.ps1 | iex
```

Or clone and run manually — see [Quick start](#quick-start) below.

---

## What it catches

| Category | Description |
|----------|-------------|
| `TEMPORAL` | Lookahead bias — using future data at decision time |
| `DATA` | Survivorship bias, bad data preparation, unadjusted prices |
| `PANDAS` | DataFrame alignment bugs, chained indexing, index corruption |
| `EXECUTION` | Zero slippage, unrealistic fills, order management bugs |
| `LOGIC` | Control flow errors, stale models, unbounded state |
| `STATISTICAL` | Data leakage, overfitting, multiple testing violations |

See [`docs/PATTERNS.md`](docs/PATTERNS.md) for the full list of detected patterns.

---

## Demo

No API key required.

```bash
npm install
npm run demo
```

---

## Accuracy

Finlint's engineered prompt is evaluated against a minimal baseline (Claude Haiku with no special instructions) across 110 labeled examples.

| System | Accuracy |
|--------|----------|
| Baseline (raw Haiku) | ~50% |
| Finlint prompt | **90.8%** |
| Improvement | **+40 percentage points** |

Run the eval suite yourself — see [Running evals](#running-evals).

---

## Quick start

**Web interface**

```bash
# macOS / Linux
git clone <repo-url>
cd finlint
export ANTHROPIC_API_KEY="sk-ant-..."
pip install anthropic flask
python web/server.py
```

```powershell
# Windows
git clone <repo-url>
cd finlint
$env:ANTHROPIC_API_KEY = "sk-ant-..."
.\get-finlint.ps1
.\finlint.ps1
```

Then open **http://localhost:3000**.

---

## How it works

1. **Prompt** — a structured system prompt defines the 6 bug categories, severity rules, and output format. Defined once in `evals/runner.py` and imported by the web server — single source of truth.
2. **Analysis** — Claude returns a JSON object with `issues[]`, each containing a title, severity, category, explanation, and suggested fix.
3. **Evaluation** — `evals/runner.py` runs every labeled example through the prompt and measures detection rate, false positive rate, and category accuracy against a baseline.

The core design rule: **false positives are worse than missed bugs.** The prompt is tuned to be conservative.

---

## Project structure

```
finlint/
├── web/
│   ├── server.py           # Flask API + static file server
│   └── index.html          # Single-page web UI
├── evals/
│   ├── runner.py           # Eval harness (Finlint prompt)
│   ├── baseline_runner.py  # Baseline comparison (simple prompt)
│   ├── examples/           # ~110 labeled bug + clean examples
│   └── results/            # Eval output JSON files
├── scripts/
│   ├── runDemo.ts          # Terminal demo runner
│   └── demoExamples.ts     # Hardcoded demo examples
├── lib/
│   └── evaluate.ts         # Baseline vs Finlint comparison report
├── docs/
│   └── PATTERNS.md         # Full pattern reference
├── get-finlint.ps1         # Windows dependency installer
└── finlint.ps1             # Windows web interface launcher
```

---

## Running evals

```bash
pip install anthropic

# Finlint prompt — strict category match
python evals/runner.py

# Fair detection mode — checks if any bug was found (not category accuracy)
python evals/runner.py --baseline

# Comparison report (requires both result files)
npx ts-node lib/evaluate.ts
```

Results are saved to `evals/results/`.

---

## Requirements

| Requirement | Version | Used for |
|-------------|---------|----------|
| Python | 3.8+ | Web interface, eval harness |
| Node.js | 18+ | Terminal demo, TypeScript eval scripts |
| Anthropic API key | — | Web interface *(demo works without one)* |

---

## Model

The web interface and eval harness use **Claude Haiku 4.5** (`claude-haiku-4-5-20251001`) — fast and low-cost. The model can be changed in `web/server.py` and `evals/runner.py`.

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for how to add new bug examples to the eval dataset.

## License

MIT — see [LICENSE](LICENSE).
