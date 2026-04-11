import { describe, it, expect } from "vitest";
import {
  NotebookCompleteSchema,
  SSEErrorSchema,
  SafetyWarningSchema,
} from "@/lib/schemas";

describe("NotebookCompleteSchema", () => {
  it("accepts valid notebook data", () => {
    const valid = {
      cells: [
        { cell_type: "markdown", source: "# Title" },
        { cell_type: "code", source: "x = 1" },
      ],
      ipynb_base64: "eyJjZWxscyI6W119",
    };
    const result = NotebookCompleteSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it("accepts notebook with safety_warnings", () => {
    const valid = {
      cells: [{ cell_type: "code", source: "os.system('ls')" }],
      ipynb_base64: "abc123",
      safety_warnings: [
        { cell_index: 0, pattern: "os.system", message: "Executes shell" },
      ],
    };
    const result = NotebookCompleteSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it("rejects missing cells", () => {
    const invalid = { ipynb_base64: "abc" };
    const result = NotebookCompleteSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("rejects empty cells array", () => {
    const invalid = { cells: [], ipynb_base64: "abc" };
    const result = NotebookCompleteSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("rejects cell with invalid cell_type", () => {
    const invalid = {
      cells: [{ cell_type: "html", source: "test" }],
      ipynb_base64: "abc",
    };
    const result = NotebookCompleteSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("rejects cell missing source", () => {
    const invalid = {
      cells: [{ cell_type: "code" }],
      ipynb_base64: "abc",
    };
    const result = NotebookCompleteSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("rejects non-object data", () => {
    expect(NotebookCompleteSchema.safeParse("string").success).toBe(false);
    expect(NotebookCompleteSchema.safeParse(42).success).toBe(false);
    expect(NotebookCompleteSchema.safeParse(null).success).toBe(false);
  });
});

describe("SSEErrorSchema", () => {
  it("accepts valid error with message", () => {
    const result = SSEErrorSchema.safeParse({ message: "Something failed" });
    expect(result.success).toBe(true);
  });

  it("rejects missing message", () => {
    const result = SSEErrorSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejects non-string message", () => {
    const result = SSEErrorSchema.safeParse({ message: 123 });
    expect(result.success).toBe(false);
  });
});

describe("SafetyWarningSchema", () => {
  it("accepts valid warning", () => {
    const result = SafetyWarningSchema.safeParse({
      cell_index: 0,
      pattern: "os.system",
      message: "Dangerous",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing fields", () => {
    expect(SafetyWarningSchema.safeParse({ cell_index: 0 }).success).toBe(false);
    expect(SafetyWarningSchema.safeParse({ pattern: "x" }).success).toBe(false);
  });
});
