export type Severity = "critical" | "warning" | "info";

export type BugCategory =
  | "lookahead-bias"
  | "survivorship-bias"
  | "data-leakage"
  | "slippage"
  | "unrealistic-fills"
  | "overfitting"
  | "pandas-mistake"
  | "risk-logic";

export interface LintIssue {
  id: string;
  category: BugCategory;
  severity: Severity;
  line: number | null;
  title: string;
  description: string;
  why_it_matters: string;
  suggested_fix: string;
  codeSnippet?: string;
}

export interface AnalysisResult {
  issues: LintIssue[];
  summary: string;
  score: number;
  analysedAt: string;
}

export type ReviewDepth      = "quick" | "standard" | "deep";
export type ReviewStrictness = "conservative" | "balanced" | "aggressive";

export interface ReviewSettings {
  language:    string;
  depth:       ReviewDepth;
  strictness:  ReviewStrictness;
}

export interface ReviewRequest {
  code:      string;
  language:  string;
  depth?:    ReviewDepth;
  strictness?: ReviewStrictness;
}

export interface ReviewResponse {
  result?: AnalysisResult;
  error?:  string;
}
