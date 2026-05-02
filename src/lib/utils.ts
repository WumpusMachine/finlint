import { Severity } from "@/types";

export function severityColor(severity: Severity): string {
  switch (severity) {
    case "critical": return "text-red-400";
    case "warning":  return "text-amber-400";
    case "info":     return "text-sky-400";
  }
}

export function severityBorderColor(severity: Severity): string {
  switch (severity) {
    case "critical": return "border-red-500/50";
    case "warning":  return "border-amber-500/50";
    case "info":     return "border-sky-500/50";
  }
}

export function severityBg(severity: Severity): string {
  switch (severity) {
    case "critical": return "bg-red-500/8";
    case "warning":  return "bg-amber-500/8";
    case "info":     return "bg-sky-500/8";
  }
}

export function severityDot(severity: Severity): string {
  switch (severity) {
    case "critical": return "bg-red-400";
    case "warning":  return "bg-amber-400";
    case "info":     return "bg-sky-400";
  }
}

export function severityAccent(severity: Severity): string {
  switch (severity) {
    case "critical": return "border-l-red-500";
    case "warning":  return "border-l-amber-500";
    case "info":     return "border-l-sky-500";
  }
}

export function scoreColor(score: number): string {
  if (score >= 80) return "text-emerald-400";
  if (score >= 50) return "text-amber-400";
  return "text-red-400";
}

export function scoreBarColor(score: number): string {
  if (score >= 80) return "bg-emerald-500";
  if (score >= 50) return "bg-amber-500";
  return "bg-red-500";
}
