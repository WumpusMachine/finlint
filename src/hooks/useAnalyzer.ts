"use client";

import { useState, useCallback } from "react";
import { AnalysisResult } from "@/types";

interface UseAnalyzerReturn {
  result: AnalysisResult | null;
  loading: boolean;
  error: string | null;
  analyze: (code: string) => Promise<void>;
  reset: () => void;
}

export function useAnalyzer(): UseAnalyzerReturn {
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analyze = useCallback(async (code: string) => {
    if (!code.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, language: "python" }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? `Request failed (${res.status})`);
      }

      if (!data.result) {
        throw new Error("Malformed response from server");
      }

      setResult(data.result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  return { result, loading, error, analyze, reset };
}
