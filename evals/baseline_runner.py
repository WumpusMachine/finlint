"""
finlint/evals/baseline_runner.py

Runs every example through a minimal prompt on Claude Haiku.
Used as a baseline to compare against the engineered Finlint prompt.

Usage:
    pip install anthropic
    export ANTHROPIC_API_KEY=sk-ant-...
    python evals/baseline_runner.py
"""

import json
import os
import time
from pathlib import Path
import anthropic

# ── CONFIG ────────────────────────────────────────────────────────────────────

EXAMPLES_DIR = Path(__file__).parent / "examples"
MODEL = "claude-haiku-4-5-20251001"
MAX_TOKENS = 1024
SLEEP_BETWEEN_CALLS = 1.0

# ── PROMPT ────────────────────────────────────────────────────────────────────

BASELINE_SYSTEM = "You are a code reviewer. Find bugs in the following code and return JSON with issues."

# ── HELPERS ───────────────────────────────────────────────────────────────────

def load_examples():
    examples = []
    for path in sorted(EXAMPLES_DIR.glob("*.json")):
        with open(path) as f:
            examples.append(json.load(f))
    return examples


def call_baseline(client, code):
    try:
        response = client.messages.create(
            model=MODEL,
            max_tokens=MAX_TOKENS,
            temperature=0,
            system=BASELINE_SYSTEM,
            messages=[{"role": "user", "content": code}],
        )
        raw = response.content[0].text.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1].strip()
            if raw.startswith("json"):
                raw = raw[4:].strip()
        # Extract first JSON object if prose surrounds it
        start = raw.find("{")
        end = raw.rfind("}") + 1
        if start != -1 and end > start:
            raw = raw[start:end]
        return json.loads(raw)
    except json.JSONDecodeError as e:
        print(f"    JSON parse error: {e}")
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


def print_report(results):
    total = len(results)
    passed = sum(1 for r in results if r["passed"])
    failed = total - passed
    false_positives = sum(r.get("false_positives", 0) for r in results)

    print("\n" + "=" * 70)
    print("BASELINE EVALUATION REPORT  (Haiku + minimal prompt)")
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

    print("\n" + "=" * 70)


# ── MAIN ──────────────────────────────────────────────────────────────────────

def main():
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

    print(f"Running {len(examples)} examples against {MODEL} (baseline)...\n")

    eval_results = []
    for i, example in enumerate(examples):
        example_id = example["id"]
        code = example.get("buggy_code", example.get("code", ""))
        print(f"  [{i+1}/{len(examples)}] {example_id}...", end=" ", flush=True)

        result = call_baseline(client, code)
        eval_result = evaluate_result(example, result)
        eval_results.append(eval_result)

        icon = "✓" if eval_result["passed"] else "✗"
        print(icon)

        time.sleep(SLEEP_BETWEEN_CALLS)

    print_report(eval_results)

    output_path = Path(__file__).parent / "results" / "baseline_latest.json"
    output_path.parent.mkdir(exist_ok=True)
    with open(output_path, "w") as f:
        json.dump(eval_results, f, indent=2)
    print(f"\nResults saved to {output_path}")


if __name__ == "__main__":
    main()
