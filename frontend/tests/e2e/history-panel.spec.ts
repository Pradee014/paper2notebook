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
        { cell_type: "code", metadata: {}, source: "import numpy as np", execution_count: null, outputs: [] },
      ],
    })
  ),
};

async function generateNotebook(page: import("@playwright/test").Page) {
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

  await expect(page.locator('[data-testid="result-view"]')).toBeVisible({ timeout: 5000 });
}

test.describe("Generation history panel", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    // Clear localStorage before each test
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test("history panel is not visible when empty", async ({ page }) => {
    const historyPanel = page.locator('[data-testid="history-panel"]');
    await expect(historyPanel).not.toBeVisible();

    await page.screenshot({
      path: "tests/screenshots/task11-01-no-history.png",
      fullPage: true,
    });
  });

  test("history panel appears after successful generation", async ({ page }) => {
    await generateNotebook(page);

    // Click "New Notebook" to go back to input — history should be visible
    await page.locator('[data-testid="new-notebook-button"]').click();

    const historyPanel = page.locator('[data-testid="history-panel"]');
    await expect(historyPanel).toBeVisible({ timeout: 5000 });

    // Should show at least one entry
    const entries = page.locator('[data-testid="history-entry"]');
    await expect(entries).toHaveCount(1);

    await page.screenshot({
      path: "tests/screenshots/task11-02-history-visible.png",
      fullPage: true,
    });
  });

  test("history entry shows title and cell count", async ({ page }) => {
    await generateNotebook(page);
    await page.locator('[data-testid="new-notebook-button"]').click();

    const entry = page.locator('[data-testid="history-entry"]').first();
    const text = await entry.textContent();
    expect(text).toContain("Test Notebook");
    expect(text).toContain("2");
  });

  test("history entry has download button", async ({ page }) => {
    await generateNotebook(page);
    await page.locator('[data-testid="new-notebook-button"]').click();

    const downloadBtn = page.locator('[data-testid="history-download"]').first();
    await expect(downloadBtn).toBeVisible();
  });

  test("clear history button removes all entries", async ({ page }) => {
    await generateNotebook(page);
    await page.locator('[data-testid="new-notebook-button"]').click();

    await expect(page.locator('[data-testid="history-panel"]')).toBeVisible({ timeout: 5000 });

    await page.locator('[data-testid="clear-history"]').click();

    await expect(page.locator('[data-testid="history-panel"]')).not.toBeVisible();

    await page.screenshot({
      path: "tests/screenshots/task11-03-history-cleared.png",
      fullPage: true,
    });
  });
});
