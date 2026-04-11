import { test, expect } from "@playwright/test";
import path from "path";

const MOCK_NOTEBOOK = {
  cells: [
    { cell_type: "markdown", source: "# Test Notebook" },
    { cell_type: "code", source: "import numpy as np" },
  ],
  ipynb_base64: btoa(
    JSON.stringify({
      nbformat: 4,
      nbformat_minor: 5,
      metadata: {},
      cells: [
        { cell_type: "markdown", metadata: {}, source: "# Test Notebook" },
        {
          cell_type: "code",
          metadata: {},
          source: "import numpy as np",
          execution_count: null,
          outputs: [],
        },
      ],
    })
  ),
};

test.describe("Open in Colab button", () => {
  test("Colab button is visible in result view", async ({ page }) => {
    await page.goto("/");

    await page.route("**/api/generate", async (route) => {
      const sseBody = `event: complete\ndata: ${JSON.stringify(MOCK_NOTEBOOK)}\n\n`;
      await route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: sseBody,
      });
    });

    const apiKeyInput = page.locator('[data-testid="api-key-input"]');
    await apiKeyInput.fill("sk-test-key");

    const fileInput = page.locator('[data-testid="pdf-file-input"]');
    const testPdfPath = path.resolve(__dirname, "../fixtures/test-paper.pdf");
    await fileInput.setInputFiles(testPdfPath);

    await page.locator('[data-testid="generate-button"]').click();

    const colabBtn = page.locator('[data-testid="colab-button"]');
    await expect(colabBtn).toBeVisible({ timeout: 5000 });

    await page.screenshot({
      path: "tests/screenshots/task9-01-colab-button.png",
      fullPage: true,
    });
  });

  test("Colab button opens a new tab with Colab URL", async ({ page }) => {
    await page.goto("/");

    await page.route("**/api/generate", async (route) => {
      const sseBody = `event: complete\ndata: ${JSON.stringify(MOCK_NOTEBOOK)}\n\n`;
      await route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: sseBody,
      });
    });

    const apiKeyInput = page.locator('[data-testid="api-key-input"]');
    await apiKeyInput.fill("sk-test-key");

    const fileInput = page.locator('[data-testid="pdf-file-input"]');
    const testPdfPath = path.resolve(__dirname, "../fixtures/test-paper.pdf");
    await fileInput.setInputFiles(testPdfPath);

    await page.locator('[data-testid="generate-button"]').click();

    const colabBtn = page.locator('[data-testid="colab-button"]');
    await expect(colabBtn).toBeVisible({ timeout: 5000 });

    // Check that the button/link targets _blank and has a colab URL
    const href = await colabBtn.getAttribute("href");
    expect(href).toContain("colab.research.google.com");
  });

  test("Colab button has target=_blank for new tab", async ({ page }) => {
    await page.goto("/");

    await page.route("**/api/generate", async (route) => {
      const sseBody = `event: complete\ndata: ${JSON.stringify(MOCK_NOTEBOOK)}\n\n`;
      await route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: sseBody,
      });
    });

    const apiKeyInput = page.locator('[data-testid="api-key-input"]');
    await apiKeyInput.fill("sk-test-key");

    const fileInput = page.locator('[data-testid="pdf-file-input"]');
    const testPdfPath = path.resolve(__dirname, "../fixtures/test-paper.pdf");
    await fileInput.setInputFiles(testPdfPath);

    await page.locator('[data-testid="generate-button"]').click();

    const colabBtn = page.locator('[data-testid="colab-button"]');
    await expect(colabBtn).toBeVisible({ timeout: 5000 });

    const target = await colabBtn.getAttribute("target");
    expect(target).toBe("_blank");
  });
});
