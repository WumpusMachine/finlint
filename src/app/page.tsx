"use client";

import { useState } from "react";
import { CodeEditor } from "@/components/editor/CodeEditor";
import { Button } from "@/components/ui/Button";
import { ResultsPanel } from "@/components/results/ResultsPanel";
import { useAnalyzer } from "@/hooks/useAnalyzer";
import { DEFAULT_CODE, EXAMPLE_SNIPPETS } from "@/data/examples";

function EmptyState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-8 text-center animate-fade-in">
      {/* Icon */}
      <div className="w-12 h-12 rounded-2xl bg-zinc-800/80 ring-1 ring-zinc-700 flex items-center justify-center mb-5">
        <svg
          className="w-6 h-6 text-zinc-500"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9.75 3.104v5.714a2.25 2.25 0 0 1-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 0 1 4.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0 1 12 15a9.065 9.065 0 0 0-6.23-.693L5 14.5m14.8.8 1.402 1.402c1 1 .03 2.798-1.442 2.798H4.24c-1.47 0-2.441-1.798-1.442-2.798L4.8 15.3"
          />
        </svg>
      </div>

      <h2 className="text-[15px] font-semibold text-zinc-300 mb-2 tracking-tight">
        Ready to review
      </h2>
      <p className="text-[13px] text-zinc-500 leading-relaxed max-w-[260px] mb-6">
        Paste your Python quant strategy and click{" "}
        <span className="text-zinc-400 font-medium">Review Code</span> to detect
        hidden bugs.
      </p>

      {/* What it catches */}
      <div className="flex flex-wrap justify-center gap-1.5">
        {[
          "Lookahead bias",
          "Data leakage",
          "Bad slippage",
          "Survivorship bias",
          "Overfitting",
          "Pandas mistakes",
        ].map((tag) => (
          <span
            key={tag}
            className="text-[11px] px-2.5 py-1 rounded-full bg-zinc-800/70 text-zinc-500 ring-1 ring-zinc-700/50"
          >
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-8 text-center animate-fade-in">
      <div className="w-12 h-12 rounded-2xl bg-red-500/10 ring-1 ring-red-500/20 flex items-center justify-center mb-4">
        <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
        </svg>
      </div>
      <p className="text-[14px] font-semibold text-red-400 mb-1">Analysis failed</p>
      <p className="text-[13px] text-zinc-500 mb-4">{message}</p>
      <Button variant="ghost" size="sm" onClick={onRetry}>Try again</Button>
    </div>
  );
}

export default function Home() {
  const [code, setCode] = useState(DEFAULT_CODE);
  const { result, loading, error, analyze, reset } = useAnalyzer();

  return (
    <div className="h-full flex flex-col bg-zinc-950">
      {/* ── Nav ── */}
      <header className="flex-none flex items-center justify-between px-5 h-13 min-h-[52px] border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur-md z-10">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 rounded-[5px] bg-indigo-600 ring-1 ring-indigo-500/50 shadow-lg shadow-indigo-500/30 flex items-center justify-center">
              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="m6.75 7.5 3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0 0 21 18V6a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 6v12a2.25 2.25 0 0 0 2.25 2.25Z" />
              </svg>
            </div>
            <span className="text-[15px] font-semibold tracking-tight text-white">
              fin<span className="text-indigo-400">lint</span>
            </span>
          </div>
          <span className="hidden sm:block w-px h-4 bg-zinc-800" />
          <span className="hidden sm:block text-[12px] text-zinc-600">
            quant code reviewer
          </span>
        </div>

        {/* Example chips */}
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-zinc-600 mr-0.5 hidden md:block">Try:</span>
          {Object.entries(EXAMPLE_SNIPPETS).map(([key, { label, code: snippet }]) => (
            <button
              key={key}
              onClick={() => { setCode(snippet); reset(); }}
              className={[
                "text-[11px] px-2.5 py-1 rounded-md font-medium transition-all duration-150",
                "text-zinc-400 hover:text-white",
                "bg-zinc-800/60 hover:bg-zinc-700",
                "ring-1 ring-zinc-700/60 hover:ring-zinc-600",
              ].join(" ")}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      {/* ── Panels ── */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left — editor */}
        <div className="flex flex-col w-1/2 border-r border-zinc-800/80">
          {/* Editor toolbar */}
          <div className="flex-none flex items-center justify-between px-4 h-10 border-b border-zinc-800/60 bg-zinc-900/40">
            <div className="flex items-center gap-2">
              {/* Window dots */}
              <div className="flex gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-zinc-700" />
                <span className="w-2.5 h-2.5 rounded-full bg-zinc-700" />
                <span className="w-2.5 h-2.5 rounded-full bg-zinc-700" />
              </div>
              <span className="text-[12px] text-zinc-500 font-mono ml-1">
                strategy.py
              </span>
              <span className="text-[11px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-600 ring-1 ring-zinc-700/50 font-mono">
                python
              </span>
            </div>

            <Button
              onClick={() => analyze(code)}
              loading={loading}
              size="sm"
              disabled={loading || !code.trim()}
            >
              {!loading && (
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" />
                </svg>
              )}
              {loading ? "Analyzing…" : "Review Code"}
            </Button>
          </div>

          {/* Monaco editor */}
          <div className="flex-1 overflow-hidden">
            <CodeEditor value={code} onChange={setCode} />
          </div>
        </div>

        {/* Right — results */}
        <div className="w-1/2 flex flex-col overflow-y-auto bg-zinc-950">
          {/* Panel header */}
          <div className="flex-none flex items-center justify-between px-5 h-10 border-b border-zinc-800/60 bg-zinc-900/40 sticky top-0 z-10 backdrop-blur-md">
            <span className="text-[12px] font-medium text-zinc-500">
              {result
                ? `${result.issues.length} issue${result.issues.length !== 1 ? "s" : ""} found`
                : "Analysis Results"}
            </span>
            {result && (
              <button
                onClick={reset}
                className="text-[11px] text-zinc-600 hover:text-zinc-400 transition-colors"
              >
                Clear
              </button>
            )}
          </div>

          {/* Content */}
          {loading && (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 animate-fade-in">
              <div className="w-8 h-8 rounded-full border-2 border-zinc-700 border-t-indigo-500 animate-spin" />
              <p className="text-[13px] text-zinc-500">Reviewing your code…</p>
            </div>
          )}

          {!loading && error && (
            <ErrorState message={error} onRetry={() => analyze(code)} />
          )}

          {!loading && !error && result && (
            <ResultsPanel result={result} />
          )}

          {!loading && !error && !result && (
            <EmptyState />
          )}
        </div>
      </div>
    </div>
  );
}
