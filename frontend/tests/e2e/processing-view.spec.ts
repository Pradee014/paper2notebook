import { test, expect } from "@playwright/test";
import path from "path";

test.describe("Processing status UI", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("clicking Generate transitions to processing view", async ({
    page,
  }) => {
    // Mock the backend SSE endpoint
    await page.route("**/api/generate", async (route) => {
      const sseBody = [
        "event: progress\ndata: Extracting text from PDF...\n\n",
        "event: progress\ndata: Analyzing paper structure...\n\n",
        "event: progress\ndata: Sending to GPT-5.4 for notebook generation...\n\n",
      ].join("");

      await route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: sseBody,
      });
    });

    // Fill in API key and upload file
    const apiKeyInput = page.locator('[data-testid="api-key-input"]');
    await apiKeyInput.fill("sk-test-key-12345");

    const fileInput = page.locator('[data-testid="pdf-file-input"]');
    const testPdfPath = path.resolve(__dirname, "../fixtures/test-paper.pdf");
    await fileInput.setInputFiles(testPdfPath);

    // Click generate
    const generateBtn = page.locator('[data-testid="generate-button"]');
    await generateBtn.click();

    // Processing view should appear
    const processingView = page.locator('[data-testid="processing-view"]');
    await expect(processingView).toBeVisible({ timeout: 5000 });

    await page.screenshot({
      path: "tests/screenshots/task7-01-processing-view.png",
      fullPage: true,
    });
  });

  test("processing view shows progress messages", async ({ page }) => {
    await page.route("**/api/generate", async (route) => {
      const sseBody = [
        "event: progress\ndata: Extracting text from PDF...\n\n",
        "event: progress\ndata: Extracted 5,200 characters from 12 page(s).\n\n",
        "event: progress\ndata: Analyzing paper structure...\n\n",
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

    // Wait for messages to appear
    const messageList = page.locator('[data-testid="progress-messages"]');
    await expect(messageList).toBeVisible({ timeout: 5000 });

    // Should contain at least one progress message
    const messages = page.locator('[data-testid="progress-message"]');
    await expect(messages.first()).toBeVisible({ timeout: 5000 });

    await page.screenshot({
      path: "tests/screenshots/task7-02-progress-messages.png",
      fullPage: true,
    });
  });

  test("processing view shows elapsed time counter", async ({ page }) => {
    await page.route("**/api/generate", async (route) => {
      // Delay response to allow timer to tick
      await new Promise((r) => setTimeout(r, 1500));
      await route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: "event: progress\ndata: Working...\n\n",
      });
    });

    const apiKeyInput = page.locator('[data-testid="api-key-input"]');
    await apiKeyInput.fill("sk-test-key");

    const fileInput = page.locator('[data-testid="pdf-file-input"]');
    const testPdfPath = path.resolve(__dirname, "../fixtures/test-paper.pdf");
    await fileInput.setInputFiles(testPdfPath);

    await page.locator('[data-testid="generate-button"]').click();

    const timer = page.locator('[data-testid="elapsed-timer"]');
    await expect(timer).toBeVisible({ timeout: 5000 });
  });

  test("processing view has blinking cursor", async ({ page }) => {
    await page.route("**/api/generate", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: "event: progress\ndata: Working...\n\n",
      });
    });

    const apiKeyInput = page.locator('[data-testid="api-key-input"]');
    await apiKeyInput.fill("sk-test-key");

    const fileInput = page.locator('[data-testid="pdf-file-input"]');
    const testPdfPath = path.resolve(__dirname, "../fixtures/test-paper.pdf");
    await fileInput.setInputFiles(testPdfPath);

    await page.locator('[data-testid="generate-button"]').click();

    const cursor = page.locator('[data-testid="blinking-cursor"]');
    await expect(cursor).toBeVisible({ timeout: 5000 });
  });

  test("error state shows error message with retry", async ({ page }) => {
    await page.route("**/api/generate", async (route) => {
      const sseBody =
        'event: error\ndata: {"message":"OpenAI API error: rate limit exceeded"}\n\n';
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

    // Error view should appear
    const errorMessage = page.locator('[data-testid="error-message"]');
    await expect(errorMessage).toBeVisible({ timeout: 5000 });

    // Should have a try-again button
    const retryBtn = page.locator('[data-testid="retry-button"]');
    await expect(retryBtn).toBeVisible();

    await page.screenshot({
      path: "tests/screenshots/task7-03-error-state.png",
      fullPage: true,
    });
  });

  test("input form is hidden during processing", async ({ page }) => {
    await page.route("**/api/generate", async (route) => {
      await new Promise((r) => setTimeout(r, 2000));
      await route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: "event: progress\ndata: Working...\n\n",
      });
    });

    const apiKeyInput = page.locator('[data-testid="api-key-input"]');
    await apiKeyInput.fill("sk-test-key");

    const fileInput = page.locator('[data-testid="pdf-file-input"]');
    const testPdfPath = path.resolve(__dirname, "../fixtures/test-paper.pdf");
    await fileInput.setInputFiles(testPdfPath);

    await page.locator('[data-testid="generate-button"]').click();

    // Processing view visible, input form hidden
    await expect(
      page.locator('[data-testid="processing-view"]')
    ).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="input-form"]')).not.toBeVisible();
  });
});
