import { z } from "zod";

/**
 * Zod schemas for validating SSE event payloads from the backend.
 * Ensures malformed or compromised responses don't reach the UI unverified.
 */

export const SafetyWarningSchema = z.object({
  cell_index: z.number(),
  pattern: z.string(),
  message: z.string(),
});

export const NotebookCellSchema = z.object({
  cell_type: z.enum(["markdown", "code"]),
  source: z.string(),
});

export const NotebookCompleteSchema = z.object({
  cells: z.array(NotebookCellSchema).min(1),
  ipynb_base64: z.string().optional(),
  safety_warnings: z.array(SafetyWarningSchema).optional(),
});

export const SSEErrorSchema = z.object({
  message: z.string(),
});

export type NotebookComplete = z.infer<typeof NotebookCompleteSchema>;
export type SSEError = z.infer<typeof SSEErrorSchema>;
export type SafetyWarning = z.infer<typeof SafetyWarningSchema>;
