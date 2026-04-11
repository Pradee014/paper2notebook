"use client";

import { useCallback } from "react";
import { type HistoryEntry, clearHistory } from "@/lib/history";

interface HistoryPanelProps {
  entries: HistoryEntry[];
  onClear: () => void;
}

function downloadEntry(entry: HistoryEntry) {
  if (!entry.ipynbBase64) return;
  const bytes = atob(entry.ipynbBase64);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) {
    arr[i] = bytes.charCodeAt(i);
  }
  const blob = new Blob([arr], { type: "application/x-ipynb+json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${entry.title.replace(/[^a-zA-Z0-9]/g, "_")}.ipynb`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function HistoryPanel({ entries, onClear }: HistoryPanelProps) {
  const handleClear = useCallback(() => {
    clearHistory();
    onClear();
  }, [onClear]);

  return (
    <div data-testid="history-panel" className="w-full animate-fade-in">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs uppercase tracking-wider text-accent-yellow">
          History
        </span>
        <button
          data-testid="clear-history"
          type="button"
          onClick={handleClear}
          className="text-xs text-foreground/40 hover:text-accent-magenta transition-colors"
        >
          Clear all
        </button>
      </div>

      <div className="space-y-2">
        {entries.map((entry) => (
          <div
            key={entry.id}
            data-testid="history-entry"
            className="bg-surface border border-border rounded px-4 py-3 flex items-center justify-between gap-3"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm text-foreground truncate">{entry.title}</p>
              <p className="text-xs text-foreground/40">
                {formatDate(entry.timestamp)} &middot; {entry.cellCount} cells
              </p>
            </div>
            {entry.ipynbBase64 && (
              <button
                data-testid="history-download"
                type="button"
                onClick={() => downloadEntry(entry)}
                className="text-xs text-accent-magenta hover:underline whitespace-nowrap"
              >
                Download
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
