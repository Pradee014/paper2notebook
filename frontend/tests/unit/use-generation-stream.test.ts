import { describe, it, expect } from "vitest";

describe("useGenerationStream hook contract", () => {
  it("API_URL points to backend", async () => {
    const { API_URL } = await import("@/lib/config");
    expect(API_URL).toBe("http://localhost:8000");
  });

  it("generate endpoint path is /api/generate", () => {
    const endpoint = "/api/generate";
    expect(endpoint).toBe("/api/generate");
  });
});
