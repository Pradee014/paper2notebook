"use client";

import { useCallback } from "react";

interface NotebookData {
  cells: Array<{ cell_type: string; source: string }>;
  ipynb_base64?: string;
}

interface ResultViewProps {
  notebook: NotebookData;
  onNewNotebook: () => void;
}

export function ResultView({ notebook, onNewNotebook }: ResultViewProps) {
  const markdownCount = notebook.cells.filter(
    (c) => c.cell_type === "markdown"
  ).length;
  const codeCount = notebook.cells.filter(
    (c) => c.cell_type === "code"
  ).length;

  const handleDownload = useCallback(() => {
    if (!notebook.ipynb_base64) return;

    const bytes = atob(notebook.ipynb_base64);
    const arr = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) {
      arr[i] = bytes.charCodeAt(i);
    }
    const blob = new Blob([arr], { type: "application/x-ipynb+json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "paper2notebook_output.ipynb";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [notebook.ipynb_base64]);

  return (
    <div data-testid="result-view" className="w-full animate-fade-in">
      <div className="bg-surface border border-border rounded-lg p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-accent-yellow text-lg">&#x2713;</span>
          <span className="text-xs uppercase tracking-wider text-accent-yellow">
            Notebook Ready
          </span>
        </div>

        <p
          data-testid="notebook-summary"
          className="text-sm text-foreground/70 mb-6"
        >
          Generated {notebook.cells.length} cells — {markdownCount} markdown,{" "}
          {codeCount} code
        </p>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            data-testid="download-button"
            type="button"
            onClick={handleDownload}
            disabled={!notebook.ipynb_base64}
            className="flex-1 py-3 rounded font-bold uppercase tracking-wider text-sm bg-accent-magenta text-foreground hover:brightness-110 transition-colors disabled:opacity-30"
          >
            Download .ipynb
          </button>
        </div>

        <button
          data-testid="new-notebook-button"
          type="button"
          onClick={onNewNotebook}
          className="w-full mt-3 py-3 rounded font-bold uppercase tracking-wider text-sm border border-border text-foreground/70 hover:border-accent-yellow hover:text-foreground transition-colors"
        >
          New Notebook
        </button>
      </div>
    </div>
  );
}
