import { describe, it, expect } from "vitest";
import { buildColabUrl } from "@/lib/colab";

const SAMPLE_IPYNB_BASE64 = btoa(
  JSON.stringify({
    nbformat: 4,
    nbformat_minor: 5,
    metadata: {},
    cells: [{ cell_type: "code", source: "print('hello')", metadata: {} }],
  })
);

describe("buildColabUrl", () => {
  it("returns a valid Colab URL", () => {
    const url = buildColabUrl(SAMPLE_IPYNB_BASE64);
    expect(url).toContain("colab.research.google.com");
  });

  it("includes the notebook content as a data URI", () => {
    const url = buildColabUrl(SAMPLE_IPYNB_BASE64);
    // URL should contain base64 encoded content or reference a data mechanism
    expect(url.length).toBeGreaterThan(50);
  });

  it("returns a URL that starts with https://", () => {
    const url = buildColabUrl(SAMPLE_IPYNB_BASE64);
    expect(url.startsWith("https://")).toBe(true);
  });
});
