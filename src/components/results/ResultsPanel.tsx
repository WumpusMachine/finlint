"use client";

import { AnalysisResult } from "@/types";
import { IssueCard } from "./IssueCard";
import { scoreColor, scoreBarColor } from "@/lib/utils";

interface ResultsPanelProps {
  result: AnalysisResult;
}

export function ResultsPanel({ result }: ResultsPanelProps) {
  const critical = result.issues.filter((i) => i.severity === "critical").length;
  const warnings = result.issues.filter((i) => i.severity === "warning").length;
  const info     = result.issues.filter((i) => i.severity === "info").length;

  return (
    <div className="animate-fade-in">
      {/* ── Score card ── */}
      <div className="px-5 py-5 border-b border-zinc-800/60">
        <div className="flex items-end justify-between mb-4">
          <div>
            <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest mb-1">
              Code Health Score
            </p>
            <div className="flex items-baseline gap-1.5">
              <span className={`text-5xl font-bold tabular-nums tracking-tight ${scoreColor(result.score)}`}>
                {result.score}
              </span>
              <span className="text-xl text-zinc-700 font-light">/100</span>
            </div>
          </div>

          {/* Severity chips */}
          <div className="flex flex-col items-end gap-1.5">
            {critical > 0 && (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-red-500/10 text-red-400 ring-1 ring-red-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 flex-none" />
                {critical} critical
              </span>
            )}
            {warnings > 0 && (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-none" />
                {warnings} warning{warnings !== 1 ? "s" : ""}
              </span>
            )}
            {info > 0 && (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-sky-500/10 text-sky-400 ring-1 ring-sky-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-400 flex-none" />
                {info} info
              </span>
            )}
          </div>
        </div>

        {/* Score bar */}
        <div className="h-1 w-full rounded-full bg-zinc-800 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ease-out ${scoreBarColor(result.score)}`}
            style={{ width: `${result.score}%` }}
          />
        </div>
      </div>

      {/* ── Summary ── */}
      <div className="px-5 py-4 border-b border-zinc-800/60">
        <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest mb-2">
          Summary
        </p>
        <p className="text-[13px] text-zinc-400 leading-relaxed">
          {result.summary}
        </p>
      </div>

      {/* ── Issues ── */}
      <div className="px-5 py-4">
        <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest mb-3">
          Issues ({result.issues.length})
        </p>

        {result.issues.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-emerald-400 font-semibold mb-1">All clear</p>
            <p className="text-zinc-600 text-sm">No issues detected in this code.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {result.issues.map((issue, i) => (
              <IssueCard key={issue.id} issue={issue} index={i} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
