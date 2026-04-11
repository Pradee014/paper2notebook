const STORAGE_KEY = "paper2notebook_history";

export const MAX_HISTORY_ENTRIES = 20;

export interface HistoryEntry {
  id: string;
  timestamp: string;
  title: string;
  cellCount: number;
  ipynbBase64: string;
}

interface NotebookInput {
  cells: Array<{ cell_type: string; source: string }>;
  ipynb_base64?: string;
}

function extractTitle(cells: Array<{ cell_type: string; source: string }>): string {
  const firstMarkdown = cells.find((c) => c.cell_type === "markdown");
  if (!firstMarkdown) return "Untitled Notebook";
  // Extract first line, strip leading # markers
  const firstLine = firstMarkdown.source.split("\n")[0].replace(/^#+\s*/, "").trim();
  return firstLine || "Untitled Notebook";
}

export function saveToHistory(notebook: NotebookInput): void {
  const history = loadHistory();

  const entry: HistoryEntry = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    title: extractTitle(notebook.cells),
    cellCount: notebook.cells.length,
    ipynbBase64: notebook.ipynb_base64 ?? "",
  };

  history.unshift(entry);

  // Evict oldest entries beyond limit
  const trimmed = history.slice(0, MAX_HISTORY_ENTRIES);

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // localStorage full or unavailable — silently fail
  }
}

export function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

export function deleteFromHistory(id: string): void {
  const history = loadHistory().filter((e) => e.id !== id);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  } catch {
    // silently fail
  }
}

export function clearHistory(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // silently fail
  }
}
