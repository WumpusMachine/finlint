"use client";

import dynamic from "next/dynamic";
import type { OnMount } from "@monaco-editor/react";

// SSR-safe: Monaco touches window/document at import time
const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => <EditorSkeleton />,
});

function EditorSkeleton() {
  return (
    <div className="w-full h-full bg-zinc-900 flex items-center justify-center">
      <span className="text-zinc-600 text-sm font-mono">Loading editor…</span>
    </div>
  );
}

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
}

const MONACO_OPTIONS = {
  fontSize: 13,
  fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
  fontLigatures: true,
  lineHeight: 22,
  minimap: { enabled: false },
  scrollBeyondLastLine: false,
  wordWrap: "on" as const,
  padding: { top: 20, bottom: 20 },
  lineNumbers: "on" as const,
  glyphMargin: false,
  folding: true,
  renderLineHighlight: "line" as const,
  scrollbar: {
    verticalScrollbarSize: 6,
    horizontalScrollbarSize: 6,
  },
  // Lets Monaco self-resize when the container resizes — critical for flex layouts
  automaticLayout: true,
  tabSize: 4,
  insertSpaces: true,
  suggestOnTriggerCharacters: true,
  quickSuggestions: false,
  parameterHints: { enabled: false },
} as const;

const handleEditorMount: OnMount = (editor) => {
  // Remove the default focus outline Monaco adds on mount
  editor.focus();
};

export function CodeEditor({ value, onChange }: CodeEditorProps) {
  return (
    <div className="w-full h-full">
      <MonacoEditor
        height="100%"
        language="python"
        theme="vs-dark"
        value={value}
        onChange={(v) => onChange(v ?? "")}
        onMount={handleEditorMount}
        options={MONACO_OPTIONS}
      />
    </div>
  );
}
