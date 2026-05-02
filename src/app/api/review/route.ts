import { NextRequest, NextResponse } from "next/server";
import { analyzeCode } from "@/lib/analyzer";
import { LintIssue, ReviewSettings } from "@/types";

const SEVERITY_ORDER = { critical: 0, warning: 1, info: 2 } as const;
const MAX_CODE_CHARS  = 50_000;

function sortBySeverity(issues: LintIssue[]): LintIssue[] {
  return [...issues].sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
  );
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Request body must be an object" }, { status: 400 });
  }

  const { code, language, depth, strictness } = body as Record<string, unknown>;

  if (!code || typeof code !== "string" || code.trim().length === 0) {
    return NextResponse.json({ error: "code must be a non-empty string" }, { status: 400 });
  }

  if (code.length > MAX_CODE_CHARS) {
    return NextResponse.json(
      { error: `code must be under ${MAX_CODE_CHARS.toLocaleString()} characters` },
      { status: 400 }
    );
  }

  if (!language || typeof language !== "string") {
    return NextResponse.json({ error: "language is required" }, { status: 400 });
  }

  const settings: ReviewSettings = {
    language:   language,
    depth:      depth === "quick" || depth === "deep" ? depth : "standard",
    strictness: strictness === "conservative" || strictness === "aggressive" ? strictness : "balanced",
  };

  try {
    const result  = await analyzeCode(code, settings);
    result.issues = sortBySeverity(result.issues);
    return NextResponse.json({ result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    const status  = message.includes("timed out") ? 504 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
