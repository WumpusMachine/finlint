import * as fs   from "fs";
import * as path from "path";
import Anthropic  from "@anthropic-ai/sdk";
import { DEMO_EXAMPLES, DemoExample, DemoIssue } from "./demoExamples";

// ── TYPES ─────────────────────────────────────────────────────────────────────

interface DetectedIssue {
  title:       string;
  severity:    string;
  category:    string;
  description: string;
}

interface AnalysisOutput {
  issues:    DetectedIssue[];
  simulated: boolean;
}

interface RawApiResponse {
  issues?: unknown[];
}

// ── CONFIG ────────────────────────────────────────────────────────────────────

const DATA_DIR   = path.resolve(__dirname, "..", "data", "examples");
const DELAY_MS   = 600;
const MODEL      = "claude-haiku-4-5-20251001";
const MAX_TOKENS = 512;

const SYSTEM_PROMPT = `You are Finlint, an expert quantitative finance code reviewer.
Identify bugs that affect backtest correctness or live-trading validity.
Only report genuine issues — false positives are worse than misses.

Respond ONLY with valid JSON. No markdown. No prose. First character must be {.

{
  "issues": [
    {
      "title":       "<under 60 chars>",
      "severity":    "critical | warning | info",
      "category":    "TEMPORAL | DATA | EXECUTION | LOGIC | STATISTICAL | PANDAS",
      "description": "<1-2 sentences: what is wrong>"
    }
  ]
}

If the code is clean, return { "issues": [] }`;

// ── DISPLAY ───────────────────────────────────────────────────────────────────

function printHeader(): void {
  console.log("");
  console.log("====== FINLINT DEMO ======");
  console.log("");
}

function printFooter(): void {
  console.log("====== END OF DEMO ======");
  console.log("");
}

function printExampleHeader(id: string): void {
  console.log(`------ Example: ${id} ------`);
  console.log("");
}

function printCode(code: string): void {
  console.log("Code:");
  for (const line of code.split("\n")) {
    console.log(`  ${line}`);
  }
  console.log("");
}

function printIssues(issues: DetectedIssue[]): void {
  console.log("Detected Issues:");
  if (issues.length === 0) {
    console.log("  ✔ No issues found");
  } else {
    for (const issue of issues) {
      console.log(
        `  - [${issue.severity.toUpperCase()}] ${issue.title} (${issue.category})`
      );
      console.log(`    → ${issue.description}`);
    }
  }
  console.log("");
}

function printDivider(): void {
  console.log("------");
  console.log("");
}

// ── DATA LOADING ──────────────────────────────────────────────────────────────

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function loadFromDataDir(): DemoExample[] | null {
  if (!fs.existsSync(DATA_DIR)) return null;

  let files: string[];
  try {
    files = fs.readdirSync(DATA_DIR).filter((f) => f.endsWith(".json")).slice(0, 3);
  } catch {
    return null;
  }

  if (files.length < 3) return null;

  const examples: DemoExample[] = [];

  for (const file of files) {
    try {
      const raw      = JSON.parse(
        fs.readFileSync(path.join(DATA_DIR, file), "utf-8")
      ) as Record<string, unknown>;
      const exp      = isObject(raw.expected) ? raw.expected : {};
      const items    = Array.isArray(exp.issues) ? exp.issues : [];

      const expectedIssues: DemoIssue[] = items
        .filter(isObject)
        .map((issue): DemoIssue => {
          const rawSev = String(issue.severity ?? "").toLowerCase();
          const sev    = (rawSev === "critical" || rawSev === "warning" || rawSev === "info")
            ? rawSev
            : "warning";
          return {
            title:       typeof issue.title    === "string" ? issue.title    : "Unknown issue",
            severity:    sev,
            category:    typeof issue.category === "string" ? issue.category : "UNKNOWN",
            description: "",
          };
        });

      examples.push({
        id:             typeof raw.id         === "string" ? raw.id         : file.replace(".json", ""),
        code:           typeof raw.buggy_code === "string" ? raw.buggy_code : "",
        expectedIssues,
      });
    } catch {
      // skip malformed file and try next
    }
  }

  return examples.length === 3 ? examples : null;
}

function loadExamples(): { examples: DemoExample[]; source: string } {
  const fromDir = loadFromDataDir();
  if (fromDir !== null) {
    return { examples: fromDir, source: "data/examples" };
  }
  return { examples: DEMO_EXAMPLES.slice(), source: "built-in" };
}

// ── ANALYSIS ──────────────────────────────────────────────────────────────────

function issueFromRaw(raw: Record<string, unknown>): DetectedIssue {
  return {
    title:       typeof raw.title       === "string" ? raw.title       : "Unknown issue",
    severity:    typeof raw.severity    === "string" ? raw.severity    : "info",
    category:    typeof raw.category    === "string" ? raw.category    : "UNKNOWN",
    description: typeof raw.description === "string" ? raw.description : "",
  };
}

function parseApiResponse(text: string): DetectedIssue[] {
  const cleaned = text
    .replace(/^```(?:json)?\s*/m, "")
    .replace(/\s*```\s*$/m, "")
    .trim();

  const start = cleaned.indexOf("{");
  const end   = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) return [];

  const parsed = JSON.parse(cleaned.slice(start, end + 1)) as RawApiResponse;
  const raw    = Array.isArray(parsed.issues) ? parsed.issues : [];
  return raw.filter(isObject).map(issueFromRaw);
}

async function analyzeWithApi(
  client:  Anthropic,
  example: DemoExample
): Promise<DetectedIssue[]> {
  const response = await client.messages.create({
    model:       MODEL,
    max_tokens:  MAX_TOKENS,
    temperature: 0,
    system:      SYSTEM_PROMPT,
    messages: [
      {
        role:    "user",
        content: `Review this Python quantitative finance code:\n\n${example.code}`,
      },
    ],
  });

  const block = response.content[0];
  if (!block || block.type !== "text") return [];
  return parseApiResponse(block.text);
}

function simulateAnalysis(example: DemoExample): DetectedIssue[] {
  return example.expectedIssues.map((issue): DetectedIssue => ({
    title:       issue.title,
    severity:    issue.severity,
    category:    issue.category,
    description: issue.description,
  }));
}

async function runAnalysis(
  example: DemoExample,
  client:  Anthropic | null
): Promise<AnalysisOutput> {
  if (client !== null) {
    try {
      const issues = await analyzeWithApi(client, example);
      return { issues, simulated: false };
    } catch {
      return { issues: simulateAnalysis(example), simulated: true };
    }
  }
  return { issues: simulateAnalysis(example), simulated: true };
}

// ── MAIN ──────────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  const apiKey = process.env.ANTHROPIC_API_KEY ?? null;
  const client = apiKey !== null ? new Anthropic({ apiKey }) : null;

  const { examples, source } = loadExamples();

  printHeader();
  console.log(`  Mode:     ${client !== null ? "live  (Claude API)" : "simulated  — set ANTHROPIC_API_KEY for live results"}`);
  console.log(`  Source:   ${source}`);
  console.log(`  Examples: ${examples.length}`);
  console.log("");

  for (let i = 0; i < examples.length; i++) {
    const example = examples[i];

    printExampleHeader(example.id);
    printCode(example.code);

    let output: AnalysisOutput;

    if (client !== null) {
      process.stdout.write("  Analyzing");
      const dot = setInterval(() => process.stdout.write("."), 400);
      output = await runAnalysis(example, client);
      clearInterval(dot);
      process.stdout.write(` ${output.simulated ? "(fallback)" : "✓"}\n\n`);
    } else {
      output = await runAnalysis(example, null);
    }

    printIssues(output.issues);
    printDivider();

    if (i < examples.length - 1) {
      await sleep(DELAY_MS);
    }
  }

  printFooter();
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`\n✗ Demo failed: ${message}`);
  process.exit(1);
});
