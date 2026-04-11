import { describe, it, expect } from "vitest";

describe("Project configuration", () => {
  it("has the correct backend API URL configured", () => {
    const backendUrl =
      process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    expect(backendUrl).toBe("http://localhost:8000");
  });

  it("exports API_URL constant with correct value", async () => {
    const { API_URL } = await import("@/lib/config");
    expect(API_URL).toBe("http://localhost:8000");
  });
});
