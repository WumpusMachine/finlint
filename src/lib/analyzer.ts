import { anthropic } from "./anthropic";
import { SYSTEM_PROMPT, buildUserPrompt } from "./prompts";
import { AnalysisResult, LintIssue, Severity, BugCategory, ReviewSettings } from "@/types";

const TIMEOUT_MS = 28_000;

const VALID_SEVERITIES = new Set<Severity>(["critical", "warning", "info"]);

const VALID_CATEGORIES = new Set<BugCategory>([
  "lookahead-bias",
  "survivorship-bias",
  "data-leakage",
  "slippage",
  "unrealistic-fills",
  "overfitting",
  "pandas-mistake",
  "risk-logic",
]);

// Claude uses category names from the prompt — map them to our internal BugCategory type
const CATEGORY_MAP: Record<string, BugCategory> = {
  TEMPORAL:    "lookahead-bias",
  DATA:        "survivorship-bias",
  EXECUTION:   "slippage",
  LOGIC:       "risk-logic",
  RISK:        "risk-logic",
  STATISTICAL: "data-leakage",
  PANDAS:      "pandas-mistake",
};

function coerceSeverity(raw: unknown): Severity {
  const s = String(raw ?? "").toLowerCase();
  if (VALID_SEVERITIES.has(s as Severity)) return s as Severity;
  if (s === "high") return "critical";
  if (s === "medium") return "warning";
  if (s === "low") return "info";
  return "info";
}

function coerceCategory(raw: unknown): BugCategory {
  const s = String(raw ?? "").trim().toUpperCase();
  if (CATEGORY_MAP[s]) return CATEGORY_MAP[s];
  const lower = s.toLowerCase();
  if (VALID_CATEGORIES.has(lower as BugCategory)) return lower as BugCategory;
  return "risk-logic";
}

function validateIssue(raw: unknown, index: number): LintIssue {
  const r = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
  return {
    id:             typeof r.id === "string" && r.id ? r.id : `issue-${index + 1}`,
    category:       coerceCategory(r.category),
    severity:       coerceSeverity(r.severity),
    line:           typeof r.line === "number" && Number.isFinite(r.line) ? Math.round(r.line) : null,
    title:          typeof r.title === "string" ? r.title.slice(0, 120) : "Untitled issue",
    description:    typeof r.description === "string" ? r.description : "",
    why_it_matters: typeof r.why_it_matters === "string" ? r.why_it_matters : "",
    suggested_fix:  typeof r.suggested_fix === "string" ? r.suggested_fix : "",
    codeSnippet:    typeof r.codeSnippet === "string" && r.codeSnippet.trim() ? r.codeSnippet : undefined,
  };
}

function parseResponse(text: string): AnalysisResult {
  // Strip any accidental markdown fences
  const cleaned = text.replace(/^```(?:json)?\s*/m, "").replace(/\s*```\s*$/m, "").trim();

  // Find outermost JSON object
  const start = cleaned.indexOf("{");
  const end   = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON object in Claude response");

  let parsed: Record<string, unknown>;
  try {
    const obj = JSON.parse(cleaned.slice(start, end + 1)) as unknown;
    if (typeof obj !== "object" || obj === null || Array.isArray(obj)) {
      throw new Error("Response root is not a JSON object");
    }
    parsed = obj as Record<string, unknown>;
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    throw new Error(`Claude returned unparseable JSON: ${detail}`);
  }

  const rawIssues = Array.isArray(parsed.issues) ? parsed.issues : [];
  const issues    = rawIssues
    .filter((i): i is object => typeof i === "object" && i !== null)
    .map((item, i) => validateIssue(item, i));

  const rawScore = parsed.score;
  const score =
    typeof rawScore === "number" && Number.isFinite(rawScore)
      ? Math.max(0, Math.min(100, Math.round(rawScore)))
      : Math.max(0, 100 - issues.filter((i) => i.severity === "critical").length * 20 - issues.filter((i) => i.severity === "warning").length * 8);

  const summary =
    typeof parsed.summary === "string" && parsed.summary.trim()
      ? parsed.summary
      : `Found ${issues.length} issue${issues.length !== 1 ? "s" : ""}.`;

  return { issues, summary, score, analysedAt: new Date().toISOString() };
}

export async function analyzeCode(code: string, settings?: ReviewSettings): Promise<AnalysisResult> {
  const controller = new AbortController();
  const timeoutId  = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await anthropic.messages.create(
      {
        model:       "claude-sonnet-4-6",
        max_tokens:  4096,
        temperature: 0,
        system:      SYSTEM_PROMPT,
        messages:    [{ role: "user", content: buildUserPrompt(code, settings) }],
      },
      { signal: controller.signal }
    );

    const block = response.content[0];
    if (!block || block.type !== "text") {
      throw new Error("Unexpected response format from Claude API");
    }

    return parseResponse(block.text);
  } catch (err) {
    const isAbort =
      err instanceof Error &&
      (err.name === "AbortError" || err.message.toLowerCase().includes("aborted"));
    if (isAbort) {
      throw new Error(`Analysis timed out after ${TIMEOUT_MS / 1000}s — try a shorter snippet`);
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}
