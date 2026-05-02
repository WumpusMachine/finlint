/**
 * lib/evaluate.ts
 *
 * Compares baseline Haiku vs Finlint prompt system.
 * Loads both result files and computes detection metrics.
 *
 * Usage:
 *   npx ts-node lib/evaluate.ts
 */

import * as fs from "fs";
import * as path from "path";

// ── TYPES ─────────────────────────────────────────────────────────────────────

interface Issue {
  title: string;
  severity: string;
  category: string;
}

interface Example {
  id: string;
  expected: { issues: Issue[] };
  actual: { issues: Issue[] };
}

interface ExampleMetrics {
  id: string;
  did_detect_bug: boolean;
  false_positive: boolean;
  missed_bug: boolean;
  category_match: boolean;
  severity_match: boolean;
}

interface AggregateMetrics {
  total_examples: number;
  total_bug_cases: number;
  total_clean_cases: number;
  detection_rate: number;
  false_positive_rate: number;
  miss_rate: number;
  category_accuracy: number;
  severity_accuracy: number;
}

interface EvaluationSummary {
  generated_at: string;
  baseline: AggregateMetrics;
  finlint: AggregateMetrics;
  delta: {
    detection_rate: number;
    false_positive_rate: number;
    miss_rate: number;
    category_accuracy: number;
    severity_accuracy: number;
  };
}

// ── FILE LOADING ──────────────────────────────────────────────────────────────

function loadResults(filePath: string): Example[] {
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`File not found: ${resolved}`);
  }
  const raw = fs.readFileSync(resolved, "utf-8");
  return JSON.parse(raw) as Example[];
}

// ── PER-EXAMPLE METRICS ───────────────────────────────────────────────────────

function computeExampleMetrics(example: Example): ExampleMetrics {
  const expected = example.expected?.issues ?? [];
  const actual = example.actual?.issues ?? [];

  const expectedBug = expected.length > 0;
  const foundBug = actual.length > 0;

  const did_detect_bug = expectedBug && foundBug;
  const false_positive = !expectedBug && foundBug;
  const missed_bug = expectedBug && !foundBug;

  // Category match: at least one actual category appears in expected categories
  const expectedCategories = new Set(
    expected.map((i) => i.category?.toUpperCase()).filter(Boolean)
  );
  const actualCategories = actual
    .map((i) => i.category?.toUpperCase())
    .filter(Boolean);

  const category_match =
    expectedBug &&
    foundBug &&
    actualCategories.some((cat) => expectedCategories.has(cat));

  // Severity match: at least one actual severity appears in expected severities
  const expectedSeverities = new Set(
    expected.map((i) => i.severity?.toUpperCase()).filter(Boolean)
  );
  const actualSeverities = actual
    .map((i) => i.severity?.toUpperCase())
    .filter(Boolean);

  const severity_match =
    expectedBug &&
    foundBug &&
    actualSeverities.some((sev) => expectedSeverities.has(sev));

  return {
    id: example.id,
    did_detect_bug,
    false_positive,
    missed_bug,
    category_match,
    severity_match,
  };
}

// ── AGGREGATE METRICS ─────────────────────────────────────────────────────────

function aggregateMetrics(
  examples: Example[],
  perExample: ExampleMetrics[]
): AggregateMetrics {
  const total_examples = examples.length;

  const bugCases = examples.filter((e) => (e.expected?.issues ?? []).length > 0);
  const cleanCases = examples.filter(
    (e) => (e.expected?.issues ?? []).length === 0
  );

  const total_bug_cases = bugCases.length;
  const total_clean_cases = cleanCases.length;

  const detected = perExample.filter((r) => r.did_detect_bug).length;
  const fp = perExample.filter((r) => r.false_positive).length;
  const missed = perExample.filter((r) => r.missed_bug).length;
  const categoryHits = perExample.filter((r) => r.category_match).length;
  const severityHits = perExample.filter((r) => r.severity_match).length;

  const round = (n: number) => Math.round(n * 1000) / 1000;

  return {
    total_examples,
    total_bug_cases,
    total_clean_cases,
    detection_rate: round(total_bug_cases > 0 ? detected / total_bug_cases : 0),
    false_positive_rate: round(
      total_clean_cases > 0 ? fp / total_clean_cases : 0
    ),
    miss_rate: round(total_bug_cases > 0 ? missed / total_bug_cases : 0),
    category_accuracy: round(
      total_bug_cases > 0 ? categoryHits / total_bug_cases : 0
    ),
    severity_accuracy: round(
      total_bug_cases > 0 ? severityHits / total_bug_cases : 0
    ),
  };
}

// ── CONSOLE TABLE ─────────────────────────────────────────────────────────────

function printComparisonTable(
  baseline: AggregateMetrics,
  finlint: AggregateMetrics
): void {
  const col1 = 22;
  const col2 = 12;
  const col3 = 12;

  const pad = (s: string, n: number) => s.padEnd(n);
  const fmt = (n: number) => n.toFixed(3);
  const delta = (b: number, f: number) => {
    const d = f - b;
    return (d >= 0 ? "+" : "") + d.toFixed(3);
  };

  const divider = "-".repeat(col1 + col2 + col3 + 10);

  console.log("\n" + "=".repeat(divider.length));
  console.log("FINLINT EVALUATION — BASELINE vs FINLINT");
  console.log("=".repeat(divider.length));
  console.log(
    pad("", col1) +
      pad("Baseline", col2) +
      pad("Finlint", col2) +
      "Delta"
  );
  console.log(divider);
  console.log(
    pad("Total Examples", col1) +
      pad(String(baseline.total_examples), col2) +
      pad(String(finlint.total_examples), col2)
  );
  console.log(
    pad("Bug Cases", col1) +
      pad(String(baseline.total_bug_cases), col2) +
      pad(String(finlint.total_bug_cases), col2)
  );
  console.log(
    pad("Clean Cases", col1) +
      pad(String(baseline.total_clean_cases), col2) +
      pad(String(finlint.total_clean_cases), col2)
  );
  console.log(divider);
  console.log(
    pad("Detection Rate", col1) +
      pad(fmt(baseline.detection_rate), col2) +
      pad(fmt(finlint.detection_rate), col2) +
      delta(baseline.detection_rate, finlint.detection_rate)
  );
  console.log(
    pad("False Positive Rate", col1) +
      pad(fmt(baseline.false_positive_rate), col2) +
      pad(fmt(finlint.false_positive_rate), col2) +
      delta(baseline.false_positive_rate, finlint.false_positive_rate)
  );
  console.log(
    pad("Miss Rate", col1) +
      pad(fmt(baseline.miss_rate), col2) +
      pad(fmt(finlint.miss_rate), col2) +
      delta(baseline.miss_rate, finlint.miss_rate)
  );
  console.log(
    pad("Category Accuracy", col1) +
      pad(fmt(baseline.category_accuracy), col2) +
      pad(fmt(finlint.category_accuracy), col2) +
      delta(baseline.category_accuracy, finlint.category_accuracy)
  );
  console.log(
    pad("Severity Accuracy", col1) +
      pad(fmt(baseline.severity_accuracy), col2) +
      pad(fmt(finlint.severity_accuracy), col2) +
      delta(baseline.severity_accuracy, finlint.severity_accuracy)
  );
  console.log("=".repeat(divider.length) + "\n");
}

// ── SAVE SUMMARY ──────────────────────────────────────────────────────────────

function saveSummary(summary: EvaluationSummary, outputPath: string): void {
  const resolved = path.resolve(outputPath);
  const dir = path.dirname(resolved);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(resolved, JSON.stringify(summary, null, 2));
  console.log(`Results saved to ${resolved}`);
}

// ── MAIN ──────────────────────────────────────────────────────────────────────

function main(): void {
  const baselinePath = "results/baseline_results.json";
  const finlintPath = "results/finlint_results.json";
  const outputPath = "results/evaluation_summary.json";

  console.log("Loading results...");
  const baselineExamples = loadResults(baselinePath);
  const finlintExamples = loadResults(finlintPath);

  console.log(
    `Baseline: ${baselineExamples.length} examples | Finlint: ${finlintExamples.length} examples`
  );

  // Per-example metrics
  const baselinePerExample = baselineExamples.map(computeExampleMetrics);
  const finlintPerExample = finlintExamples.map(computeExampleMetrics);

  // Aggregate
  const baselineMetrics = aggregateMetrics(baselineExamples, baselinePerExample);
  const finlintMetrics = aggregateMetrics(finlintExamples, finlintPerExample);

  // Print table
  printComparisonTable(baselineMetrics, finlintMetrics);

  // Build summary
  const round = (n: number) => Math.round(n * 1000) / 1000;

  const summary: EvaluationSummary = {
    generated_at: new Date().toISOString(),
    baseline: baselineMetrics,
    finlint: finlintMetrics,
    delta: {
      detection_rate: round(
        finlintMetrics.detection_rate - baselineMetrics.detection_rate
      ),
      false_positive_rate: round(
        finlintMetrics.false_positive_rate - baselineMetrics.false_positive_rate
      ),
      miss_rate: round(finlintMetrics.miss_rate - baselineMetrics.miss_rate),
      category_accuracy: round(
        finlintMetrics.category_accuracy - baselineMetrics.category_accuracy
      ),
      severity_accuracy: round(
        finlintMetrics.severity_accuracy - baselineMetrics.severity_accuracy
      ),
    },
  };

  saveSummary(summary, outputPath);
}

main();
