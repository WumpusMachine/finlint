import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";
import path from "path";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const EXAMPLES_DIR = path.join(__dirname, "../examples");
const RESULTS_DIR = path.join(__dirname, "../results");
const RESULTS_FILE = path.join(RESULTS_DIR, "baseline_results.json");

const BASELINE_PROMPT =
  "You are a code reviewer. Find bugs in the following code and return JSON with issues.";

interface ExampleIssue {
  title: string;
  severity: string;
  category: string;
}

interface Example {
  id: string;
  buggy_code: string;
  expected: {
    issues: ExampleIssue[];
  };
  [key: string]: unknown;
}

interface BaselineIssue {
  title: string;
  severity: string;
  category: string;
}

interface BaselineResponse {
  issues: BaselineIssue[];
}

interface EvalResult {
  id: string;
  expected: Example["expected"];
  actual: BaselineResponse | null;
  raw: string;
}

function loadExamples(): Example[] {
  const files = fs
    .readdirSync(EXAMPLES_DIR)
    .filter((f) => f.endsWith(".json"));

  const examples: Example[] = [];
  for (const file of files) {
    const raw = fs.readFileSync(path.join(EXAMPLES_DIR, file), "utf-8");
    try {
      examples.push(JSON.parse(raw) as Example);
    } catch {
      console.warn(`Skipping malformed JSON: ${file}`);
    }
  }
  return examples;
}

async function callBaseline(code: string): Promise<{ parsed: BaselineResponse | null; raw: string }> {
  const response = await client.messages.create({
    model: "claude-3-haiku-20240307",
    max_tokens: 1024,
    temperature: 0,
    system: BASELINE_PROMPT,
    messages: [{ role: "user", content: code }],
  });

  const raw =
    response.content[0].type === "text" ? response.content[0].text : "";

  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON object found in response");
    const parsed = JSON.parse(jsonMatch[0]) as BaselineResponse;
    return { parsed, raw };
  } catch {
    return { parsed: null, raw };
  }
}

async function main() {
  const examples = loadExamples();
  console.log(`Loaded ${examples.length} examples`);

  if (!fs.existsSync(RESULTS_DIR)) {
    fs.mkdirSync(RESULTS_DIR, { recursive: true });
  }

  const results: EvalResult[] = [];

  for (let i = 0; i < examples.length; i++) {
    const example = examples[i];
    console.log(`[${i + 1}/${examples.length}] Running: ${example.id}`);

    try {
      const { parsed, raw } = await callBaseline(example.buggy_code);
      results.push({
        id: example.id,
        expected: example.expected,
        actual: parsed,
        raw,
      });
      console.log(
        `  -> ${parsed ? `${parsed.issues?.length ?? 0} issues found` : "parse failed"}`
      );
    } catch (err) {
      console.error(`  -> Error on ${example.id}:`, err);
      results.push({
        id: example.id,
        expected: example.expected,
        actual: null,
        raw: String(err),
      });
    }
  }

  fs.writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2), "utf-8");
  console.log(`\nResults saved to ${RESULTS_FILE}`);
  console.log(`Total: ${results.length} | Failed to parse: ${results.filter((r) => r.actual === null).length}`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
