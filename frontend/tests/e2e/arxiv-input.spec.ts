import { test, expect } from "@playwright/test";
import path from "path";

test.describe("arXiv URL input — tab toggle and URL entry", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  // --- Input mode tabs ---

  test("input mode tabs are visible with 'Upload PDF' and 'arXiv URL'", async ({
    page,
  }) => {
    const pdfTab = page.locator('[data-testid="input-tab-pdf"]');
    const arxivTab = page.locator('[data-testid="input-tab-arxiv"]');
    await expect(pdfTab).toBeVisible();
    await expect(arxivTab).toBeVisible();
    await expect(pdfTab).toContainText(/upload|pdf/i);
    await expect(arxivTab).toContainText(/arxiv|url/i);
  });

  test("PDF upload tab is selected by default", async ({ page }) => {
    const pdfTab = page.locator('[data-testid="input-tab-pdf"]');
    const uploadZone = page.locator('[data-testid="pdf-upload-zone"]');
    // PDF tab should be active (visually highlighted)
    await expect(pdfTab).toHaveAttribute("data-active", "true");
    await expect(uploadZone).toBeVisible();
  });

  test("clicking arXiv tab shows URL input and hides upload zone", async ({
    page,
  }) => {
    const arxivTab = page.locator('[data-testid="input-tab-arxiv"]');
    await arxivTab.click();

    const arxivInput = page.locator('[data-testid="arxiv-url-input"]');
    const uploadZone = page.locator('[data-testid="pdf-upload-zone"]');
    await expect(arxivInput).toBeVisible();
    await expect(uploadZone).not.toBeVisible();
  });

  test("switching back to PDF tab shows upload zone and hides URL input", async ({
    page,
  }) => {
    // Switch to arXiv
    await page.locator('[data-testid="input-tab-arxiv"]').click();
    // Switch back to PDF
    await page.locator('[data-testid="input-tab-pdf"]').click();

    const uploadZone = page.locator('[data-testid="pdf-upload-zone"]');
    const arxivInput = page.locator('[data-testid="arxiv-url-input"]');
    await expect(uploadZone).toBeVisible();
    await expect(arxivInput).not.toBeVisible();
  });

  // --- arXiv URL input ---

  test("arXiv URL input has placeholder text", async ({ page }) => {
    await page.locator('[data-testid="input-tab-arxiv"]').click();
    const input = page.locator('[data-testid="arxiv-url-input"]');
    await expect(input).toHaveAttribute("placeholder", /arxiv|1706/i);
  });

  test("arXiv URL input accepts a valid arXiv URL", async ({ page }) => {
    await page.locator('[data-testid="input-tab-arxiv"]').click();
    const input = page.locator('[data-testid="arxiv-url-input"]');
    await input.fill("https://arxiv.org/abs/1706.03762");
    await expect(input).toHaveValue("https://arxiv.org/abs/1706.03762");
  });

  test("generate button enables with API key and arXiv URL", async ({
    page,
  }) => {
    // Enter API key
    await page.locator('[data-testid="api-key-input"]').fill("sk-test-key");
    // Switch to arXiv tab
    await page.locator('[data-testid="input-tab-arxiv"]').click();
    // Enter arXiv URL
    await page.locator('[data-testid="arxiv-url-input"]').fill("1706.03762");
    // Generate button should be enabled
    const button = page.locator('[data-testid="generate-button"]');
    await expect(button).toBeEnabled();
  });

  test("generate button is disabled with API key but empty arXiv URL", async ({
    page,
  }) => {
    await page.locator('[data-testid="api-key-input"]').fill("sk-test-key");
    await page.locator('[data-testid="input-tab-arxiv"]').click();
    // Don't fill arXiv URL
    const button = page.locator('[data-testid="generate-button"]');
    await expect(button).toBeDisabled();
  });

  test("switching to arXiv tab clears file selection, vice versa", async ({
    page,
  }) => {
    // Upload a file first
    const fileInput = page.locator('[data-testid="pdf-file-input"]');
    const testPdfPath = path.resolve(__dirname, "../fixtures/test-paper.pdf");
    await fileInput.setInputFiles(testPdfPath);
    await expect(page.locator('[data-testid="selected-file-name"]')).toBeVisible();

    // Switch to arXiv — file should be cleared conceptually (generate disabled without URL)
    await page.locator('[data-testid="input-tab-arxiv"]').click();
    const button = page.locator('[data-testid="generate-button"]');
    await expect(button).toBeDisabled();
  });

  // --- Screenshots ---

  test("screenshot: arXiv URL input state", async ({ page }) => {
    await page.locator('[data-testid="api-key-input"]').fill("sk-test-key");
    await page.locator('[data-testid="input-tab-arxiv"]').click();
    await page
      .locator('[data-testid="arxiv-url-input"]')
      .fill("https://arxiv.org/abs/1706.03762");
    await page.screenshot({
      path: "tests/screenshots/task2-01-arxiv-input.png",
      fullPage: true,
    });
  });

  test("screenshot: PDF upload tab (default)", async ({ page }) => {
    await page.screenshot({
      path: "tests/screenshots/task2-02-pdf-tab-default.png",
      fullPage: true,
    });
  });
});
