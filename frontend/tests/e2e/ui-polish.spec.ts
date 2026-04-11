import { test, expect } from "@playwright/test";
import path from "path";

const MOCK_NOTEBOOK = {
  cells: [
    { cell_type: "markdown", source: "# Test" },
    { cell_type: "code", source: "print('hi')" },
  ],
  ipynb_base64: btoa(JSON.stringify({ nbformat: 4, cells: [] })),
};

test.describe("UI polish — animations, responsive, consistency", () => {
  // --- Fade-in transitions ---

  test("input form has fade-in animation class", async ({ page }) => {
    await page.goto("/");
    const form = page.locator('[data-testid="input-form"]');
    await expect(form).toBeVisible();
    const classes = await form.getAttribute("class");
    expect(classes).toContain("animate-fade-in");
  });

  test("processing view has fade-in animation", async ({ page }) => {
    await page.goto("/");

    await page.route("**/api/generate", async (route) => {
      await new Promise((r) => setTimeout(r, 2000));
      await route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: "event: progress\ndata: Working...\n\n",
      });
    });

    await page.locator('[data-testid="api-key-input"]').fill("sk-test");
    await page
      .locator('[data-testid="pdf-file-input"]')
      .setInputFiles(
        path.resolve(__dirname, "../fixtures/test-paper.pdf")
      );
    await page.locator('[data-testid="generate-button"]').click();

    const view = page.locator('[data-testid="processing-view"]');
    await expect(view).toBeVisible({ timeout: 5000 });
    const classes = await view.getAttribute("class");
    expect(classes).toContain("animate-fade-in");
  });

  test("result view has fade-in animation", async ({ page }) => {
    await page.goto("/");

    await page.route("**/api/generate", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: `event: complete\ndata: ${JSON.stringify(MOCK_NOTEBOOK)}\n\n`,
      });
    });

    await page.locator('[data-testid="api-key-input"]').fill("sk-test");
    await page
      .locator('[data-testid="pdf-file-input"]')
      .setInputFiles(
        path.resolve(__dirname, "../fixtures/test-paper.pdf")
      );
    await page.locator('[data-testid="generate-button"]').click();

    const view = page.locator('[data-testid="result-view"]');
    await expect(view).toBeVisible({ timeout: 5000 });
    const classes = await view.getAttribute("class");
    expect(classes).toContain("animate-fade-in");
  });

  // --- Mobile responsive ---

  test("mobile: full page renders correctly at 375px", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/");

    await expect(page.locator('[data-testid="app-title"]')).toBeVisible();
    await expect(page.locator('[data-testid="api-key-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="pdf-upload-zone"]')).toBeVisible();

    await page.screenshot({
      path: "tests/screenshots/task10-01-mobile-input.png",
      fullPage: true,
    });
  });

  test("mobile: processing view at 375px", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/");

    await page.route("**/api/generate", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: "event: progress\ndata: Extracting text...\n\nevent: progress\ndata: Analyzing...\n\n",
      });
    });

    await page.locator('[data-testid="api-key-input"]').fill("sk-test");
    await page
      .locator('[data-testid="pdf-file-input"]')
      .setInputFiles(
        path.resolve(__dirname, "../fixtures/test-paper.pdf")
      );
    await page.locator('[data-testid="generate-button"]').click();

    await expect(
      page.locator('[data-testid="processing-view"]')
    ).toBeVisible({ timeout: 5000 });

    await page.screenshot({
      path: "tests/screenshots/task10-02-mobile-processing.png",
      fullPage: true,
    });
  });

  test("mobile: result view at 375px", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/");

    await page.route("**/api/generate", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: `event: complete\ndata: ${JSON.stringify(MOCK_NOTEBOOK)}\n\n`,
      });
    });

    await page.locator('[data-testid="api-key-input"]').fill("sk-test");
    await page
      .locator('[data-testid="pdf-file-input"]')
      .setInputFiles(
        path.resolve(__dirname, "../fixtures/test-paper.pdf")
      );
    await page.locator('[data-testid="generate-button"]').click();

    await expect(page.locator('[data-testid="result-view"]')).toBeVisible({
      timeout: 5000,
    });

    await page.screenshot({
      path: "tests/screenshots/task10-03-mobile-result.png",
      fullPage: true,
    });
  });

  // --- Footer ---

  test("footer is visible with credit text", async ({ page }) => {
    await page.goto("/");
    const footer = page.locator('[data-testid="site-footer"]');
    await expect(footer).toBeVisible();
  });

  // --- Final desktop screenshots ---

  test("desktop: full flow screenshots", async ({ page }) => {
    await page.goto("/");

    // Input state
    await page.screenshot({
      path: "tests/screenshots/task10-04-desktop-final-input.png",
      fullPage: true,
    });

    await page.route("**/api/generate", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: `event: progress\ndata: Extracting text from PDF...\n\nevent: progress\ndata: Extracted 15,200 characters from 8 page(s).\n\nevent: progress\ndata: Analyzing paper structure...\n\nevent: progress\ndata: Sending to GPT-5.4 for notebook generation...\n\nevent: complete\ndata: ${JSON.stringify(MOCK_NOTEBOOK)}\n\n`,
      });
    });

    await page.locator('[data-testid="api-key-input"]').fill("sk-test-key");
    await page
      .locator('[data-testid="pdf-file-input"]')
      .setInputFiles(
        path.resolve(__dirname, "../fixtures/test-paper.pdf")
      );
    await page.locator('[data-testid="generate-button"]').click();

    await expect(page.locator('[data-testid="result-view"]')).toBeVisible({
      timeout: 5000,
    });

    await page.screenshot({
      path: "tests/screenshots/task10-05-desktop-final-result.png",
      fullPage: true,
    });
  });
});
