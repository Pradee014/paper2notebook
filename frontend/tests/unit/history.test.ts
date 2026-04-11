import { describe, it, expect, beforeEach } from "vitest";
import {
  saveToHistory,
  loadHistory,
  clearHistory,
  deleteFromHistory,
  MAX_HISTORY_ENTRIES,
  type HistoryEntry,
} from "@/lib/history";

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();

Object.defineProperty(globalThis, "localStorage", { value: localStorageMock });

beforeEach(() => {
  localStorageMock.clear();
});

describe("saveToHistory", () => {
  it("saves an entry to localStorage", () => {
    const notebook = {
      cells: [{ cell_type: "markdown" as const, source: "# Title" }],
      ipynb_base64: "abc123",
    };
    saveToHistory(notebook);
    const history = loadHistory();
    expect(history).toHaveLength(1);
    expect(history[0].cellCount).toBe(1);
    expect(history[0].ipynbBase64).toBe("abc123");
  });

  it("extracts title from first markdown cell", () => {
    const notebook = {
      cells: [
        { cell_type: "markdown" as const, source: "# Attention Is All You Need" },
        { cell_type: "code" as const, source: "import torch" },
      ],
      ipynb_base64: "abc",
    };
    saveToHistory(notebook);
    const history = loadHistory();
    expect(history[0].title).toContain("Attention Is All You Need");
  });

  it("uses fallback title when no markdown cells", () => {
    const notebook = {
      cells: [{ cell_type: "code" as const, source: "x = 1" }],
      ipynb_base64: "abc",
    };
    saveToHistory(notebook);
    const history = loadHistory();
    expect(history[0].title).toBe("Untitled Notebook");
  });

  it("adds timestamp as ISO string", () => {
    const before = new Date().toISOString();
    saveToHistory({
      cells: [{ cell_type: "markdown" as const, source: "# Test" }],
      ipynb_base64: "abc",
    });
    const after = new Date().toISOString();
    const history = loadHistory();
    expect(history[0].timestamp >= before).toBe(true);
    expect(history[0].timestamp <= after).toBe(true);
  });

  it("generates unique IDs", () => {
    const notebook = {
      cells: [{ cell_type: "markdown" as const, source: "# Test" }],
      ipynb_base64: "abc",
    };
    saveToHistory(notebook);
    saveToHistory(notebook);
    const history = loadHistory();
    expect(history[0].id).not.toBe(history[1].id);
  });
});

describe("loadHistory", () => {
  it("returns empty array when no history", () => {
    expect(loadHistory()).toEqual([]);
  });

  it("returns entries sorted newest first", () => {
    saveToHistory({
      cells: [{ cell_type: "markdown" as const, source: "# First" }],
      ipynb_base64: "a",
    });
    saveToHistory({
      cells: [{ cell_type: "markdown" as const, source: "# Second" }],
      ipynb_base64: "b",
    });
    const history = loadHistory();
    expect(history[0].title).toContain("Second");
    expect(history[1].title).toContain("First");
  });

  it("handles corrupted localStorage gracefully", () => {
    localStorage.setItem("paper2notebook_history", "not-valid-json");
    expect(loadHistory()).toEqual([]);
  });
});

describe("MAX_HISTORY_ENTRIES", () => {
  it("is set to 20", () => {
    expect(MAX_HISTORY_ENTRIES).toBe(20);
  });

  it("evicts oldest entry when limit exceeded", () => {
    for (let i = 0; i < MAX_HISTORY_ENTRIES + 3; i++) {
      saveToHistory({
        cells: [{ cell_type: "markdown" as const, source: `# Paper ${i}` }],
        ipynb_base64: `data-${i}`,
      });
    }
    const history = loadHistory();
    expect(history).toHaveLength(MAX_HISTORY_ENTRIES);
    // Newest should be the last one saved
    expect(history[0].ipynbBase64).toBe(`data-${MAX_HISTORY_ENTRIES + 2}`);
  });
});

describe("deleteFromHistory", () => {
  it("removes a specific entry by ID", () => {
    saveToHistory({
      cells: [{ cell_type: "markdown" as const, source: "# Keep" }],
      ipynb_base64: "keep",
    });
    saveToHistory({
      cells: [{ cell_type: "markdown" as const, source: "# Delete" }],
      ipynb_base64: "delete",
    });
    const history = loadHistory();
    const deleteId = history.find((e) => e.ipynbBase64 === "delete")!.id;
    deleteFromHistory(deleteId);
    const after = loadHistory();
    expect(after).toHaveLength(1);
    expect(after[0].ipynbBase64).toBe("keep");
  });
});

describe("clearHistory", () => {
  it("removes all entries", () => {
    saveToHistory({
      cells: [{ cell_type: "markdown" as const, source: "# Test" }],
      ipynb_base64: "abc",
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});
