"use client";

import { useState } from "react";
import { LintIssue } from "@/types";
import {
  severityColor,
  severityDot,
  severityAccent,
  severityBorderColor,
} from "@/lib/utils";

interface IssueCardProps {
  issue: LintIssue;
  index: number;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <button
      onClick={handleCopy}
      className={[
        "ml-auto flex-none text-[11px] font-medium px-2.5 py-1 rounded-md",
        "ring-1 ring-inset transition-all duration-150",
        copied
          ? "bg-emerald-500/15 text-emerald-400 ring-emerald-500/30"
          : "bg-zinc-800 text-zinc-400 ring-zinc-700 hover:text-white hover:bg-zinc-700",
      ].join(" ")}
    >
      {copied ? "Copied!" : "Copy fix"}
    </button>
  );
}

export function IssueCard({ issue, index }: IssueCardProps) {
  return (
    <div
      className={[
        "rounded-xl border border-l-[3px] p-4 bg-zinc-900/70 backdrop-blur-sm",
        "transition-all duration-200 ease-out",
        "hover:bg-zinc-900 hover:shadow-xl hover:shadow-black/40 hover:-translate-y-px",
        "animate-slide-up",
        severityBorderColor(issue.severity),
        severityAccent(issue.severity),
      ].join(" ")}
      style={{ animationDelay: `${index * 60}ms` }}
    >
      {/* ── Header ── */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span
          className={`inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest ${severityColor(issue.severity)}`}
        >
          <span className={`w-1.5 h-1.5 rounded-full flex-none ${severityDot(issue.severity)}`} />
          {issue.severity}
        </span>

        <span className="text-zinc-700">·</span>

        <span className="font-mono text-[11px] px-2 py-0.5 rounded-md bg-zinc-800/80 text-zinc-400 ring-1 ring-zinc-700/50">
          {issue.category}
        </span>

        {issue.line != null && (
          <>
            <span className="text-zinc-700">·</span>
            <span className="text-[11px] text-zinc-600 font-mono">
              line {issue.line}
            </span>
          </>
        )}
      </div>

      {/* ── Title ── */}
      <h3 className="text-[14px] font-semibold text-white mb-2 leading-snug tracking-tight">
        {issue.title}
      </h3>

      {/* ── Description ── */}
      <p className="text-[13px] text-zinc-400 leading-relaxed mb-3">
        {issue.description}
      </p>

      {/* ── Code snippet ── */}
      {issue.codeSnippet && (
        <pre className="text-[12px] rounded-lg bg-black/60 ring-1 ring-white/5 px-3.5 py-3 mb-3 overflow-x-auto text-zinc-300 font-mono leading-relaxed">
          {issue.codeSnippet}
        </pre>
      )}

      {/* ── Why it matters ── */}
      <div className="mb-3 px-3 py-2.5 rounded-lg bg-zinc-800/50 ring-1 ring-zinc-700/40">
        <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-1">
          Why it matters
        </p>
        <p className="text-[13px] text-zinc-400 leading-relaxed">
          {issue.why_it_matters}
        </p>
      </div>

      {/* ── Fix row ── */}
      <div className="flex items-start gap-2">
        <span className="text-zinc-600 text-[13px] mt-0.5 flex-none">→</span>
        <p className="text-[13px] text-zinc-400 leading-relaxed flex-1">
          <span className="text-zinc-300 font-medium">Fix: </span>
          {issue.suggested_fix}
        </p>
        <CopyButton text={issue.suggested_fix} />
      </div>
    </div>
  );
}
