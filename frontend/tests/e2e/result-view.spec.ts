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
      metadata: { kernelspec: { display_name: "Python 3", language: "python", name: "python3" } },
      cells: [
        { cell_type: "markdown", metadata: {}, source: "# Test Notebook" },
        { cell_type: "code", metadata: {}, source: "import numpy as np", execution_count: null, outputs: [] },
      ],
    })
  ),
};

test.describe("Result view — notebook download", () => {
  test("shows result view after successful generation", async ({ page }) => {
    await page.goto("/");

    await page.route("**/api/generate", async (route) => {
      const sseBody = [
        "event: progress\ndata: Extracting text...\n\n",
        "event: progress\ndata: Building notebook...\n\n",
        `event: complete\ndata: ${JSON.stringify(MOCK_NOTEBOOK)}\n\n`,
      ].join("");

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

    // Result view should appear
    const resultView = page.locator('[data-testid="result-view"]');
    await expect(resultView).toBeVisible({ timeout: 5000 });

    await page.screenshot({
      path: "tests/screenshots/task8-01-result-view.png",
      fullPage: true,
    });
  });

  test("download button is visible and clickable", async ({ page }) => {
    await page.goto("/");

    await page.route("**/api/generate", async (route) => {
      const sseBody = [
        "event: progress\ndata: Working...\n\n",
        `event: complete\ndata: ${JSON.stringify(MOCK_NOTEBOOK)}\n\n`,
      ].join("");

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

    const downloadBtn = page.locator('[data-testid="download-button"]');
    await expect(downloadBtn).toBeVisible({ timeout: 5000 });
    await expect(downloadBtn).toBeEnabled();
  });

  test("shows cell count summary", async ({ page }) => {
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

    const summary = page.locator('[data-testid="notebook-summary"]');
    await expect(summary).toBeVisible({ timeout: 5000 });
    const text = await summary.textContent();
    expect(text).toContain("2");
  });

  test("new notebook button resets to input form", async ({ page }) => {
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

    const newBtn = page.locator('[data-testid="new-notebook-button"]');
    await expect(newBtn).toBeVisible({ timeout: 5000 });
    await newBtn.click();

    // Should be back to input form
    await expect(page.locator('[data-testid="input-form"]')).toBeVisible();
    await expect(page.locator('[data-testid="result-view"]')).not.toBeVisible();
  });
});
