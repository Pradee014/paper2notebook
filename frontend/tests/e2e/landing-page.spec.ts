import { test, expect } from "@playwright/test";
import path from "path";

test.describe("Landing page — API key input and PDF upload", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  // --- API Key Input ---

  test("API key input is visible with placeholder", async ({ page }) => {
    const input = page.locator('[data-testid="api-key-input"]');
    await expect(input).toBeVisible();
    await expect(input).toHaveAttribute("type", "password");
    await expect(input).toHaveAttribute(
      "placeholder",
      /openai|api.key|sk-/i
    );
  });

  test("API key input accepts text and masks it", async ({ page }) => {
    const input = page.locator('[data-testid="api-key-input"]');
    await input.fill("sk-test-1234567890");
    await expect(input).toHaveValue("sk-test-1234567890");
    // type=password means it's masked visually
    await expect(input).toHaveAttribute("type", "password");
  });

  test("API key visibility toggle works", async ({ page }) => {
    const input = page.locator('[data-testid="api-key-input"]');
    const toggle = page.locator('[data-testid="api-key-toggle"]');
    await input.fill("sk-test-key");

    // Click toggle to show
    await toggle.click();
    await expect(input).toHaveAttribute("type", "text");

    // Click again to hide
    await toggle.click();
    await expect(input).toHaveAttribute("type", "password");
  });

  // --- PDF Upload Zone ---

  test("PDF upload zone is visible with instructions", async ({ page }) => {
    const zone = page.locator('[data-testid="pdf-upload-zone"]');
    await expect(zone).toBeVisible();
    const text = await zone.textContent();
    expect(text!.toLowerCase()).toContain("pdf");
  });

  test("file input accepts only PDF files", async ({ page }) => {
    const fileInput = page.locator('[data-testid="pdf-file-input"]');
    await expect(fileInput).toHaveAttribute("accept", ".pdf,application/pdf");
  });

  test("selecting a valid PDF shows file name", async ({ page }) => {
    const fileInput = page.locator('[data-testid="pdf-file-input"]');

    // Create a minimal test PDF file
    const testPdfPath = path.resolve(__dirname, "../fixtures/test-paper.pdf");
    await fileInput.setInputFiles(testPdfPath);

    const fileName = page.locator('[data-testid="selected-file-name"]');
    await expect(fileName).toBeVisible();
    await expect(fileName).toContainText("test-paper.pdf");
  });

  test("generate button is disabled without API key and file", async ({
    page,
  }) => {
    const button = page.locator('[data-testid="generate-button"]');
    await expect(button).toBeVisible();
    await expect(button).toBeDisabled();
  });

  test("generate button enables when both API key and PDF are provided", async ({
    page,
  }) => {
    const apiKeyInput = page.locator('[data-testid="api-key-input"]');
    await apiKeyInput.fill("sk-test-1234567890");

    const fileInput = page.locator('[data-testid="pdf-file-input"]');
    const testPdfPath = path.resolve(__dirname, "../fixtures/test-paper.pdf");
    await fileInput.setInputFiles(testPdfPath);

    const button = page.locator('[data-testid="generate-button"]');
    await expect(button).toBeEnabled();
  });

  test("clear file button removes selected file", async ({ page }) => {
    const fileInput = page.locator('[data-testid="pdf-file-input"]');
    const testPdfPath = path.resolve(__dirname, "../fixtures/test-paper.pdf");
    await fileInput.setInputFiles(testPdfPath);

    const clearButton = page.locator('[data-testid="clear-file-button"]');
    await expect(clearButton).toBeVisible();
    await clearButton.click();

    const fileName = page.locator('[data-testid="selected-file-name"]');
    await expect(fileName).not.toBeVisible();
  });

  // --- Screenshots ---

  test("screenshot: initial state", async ({ page }) => {
    await page.screenshot({
      path: "tests/screenshots/task3-01-initial-state.png",
      fullPage: true,
    });
  });

  test("screenshot: filled state", async ({ page }) => {
    const apiKeyInput = page.locator('[data-testid="api-key-input"]');
    await apiKeyInput.fill("sk-test-1234567890");

    const fileInput = page.locator('[data-testid="pdf-file-input"]');
    const testPdfPath = path.resolve(__dirname, "../fixtures/test-paper.pdf");
    await fileInput.setInputFiles(testPdfPath);

    await page.screenshot({
      path: "tests/screenshots/task3-02-filled-state.png",
      fullPage: true,
    });
  });
});
