import { test, expect } from "@playwright/test";

const MOCK_NOTEBOOK = {
  cells: [
    { cell_type: "markdown", source: "# Transformer Architecture" },
    { cell_type: "code", source: "import torch" },
    { cell_type: "markdown", source: "## Mathematical Formulation" },
    { cell_type: "code", source: "d_model = 512\nn_heads = 8" },
  ],
  ipynb_base64: btoa(
    JSON.stringify({
      nbformat: 4,
      nbformat_minor: 5,
      metadata: {
        kernelspec: {
          display_name: "Python 3",
          language: "python",
          name: "python3",
        },
      },
      cells: [
        {
          cell_type: "markdown",
          metadata: {},
          source: "# Transformer Architecture",
        },
        {
          cell_type: "code",
          metadata: {},
          source: "import torch",
          execution_count: null,
          outputs: [],
        },
      ],
    })
  ),
};

test.describe("arXiv-specific flow tests", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("arXiv tab shows URL input and hides PDF upload zone", async ({
    page,
  }) => {
    await page.locator('[data-testid="input-tab-arxiv"]').click();

    await expect(
      page.locator('[data-testid="arxiv-url-input"]')
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="pdf-upload-zone"]')
    ).not.toBeVisible();
  });

  test("generate disabled with empty arXiv URL", async ({ page }) => {
    await page.locator('[data-testid="api-key-input"]').fill("sk-key");
    await page.locator('[data-testid="input-tab-arxiv"]').click();
    // Leave URL empty
    await expect(
      page.locator('[data-testid="generate-button"]')
    ).toBeDisabled();
  });

  test("generate enabled with arXiv URL filled", async ({ page }) => {
    await page.locator('[data-testid="api-key-input"]').fill("sk-key");
    await page.locator('[data-testid="input-tab-arxiv"]').click();
    await page.locator('[data-testid="arxiv-url-input"]').fill("1706.03762");
    await expect(
      page.locator('[data-testid="generate-button"]')
    ).toBeEnabled();
  });

  test("arXiv URL accepts various formats", async ({ page }) => {
    await page.locator('[data-testid="api-key-input"]').fill("sk-key");
    await page.locator('[data-testid="input-tab-arxiv"]').click();
    const input = page.locator('[data-testid="arxiv-url-input"]');

    // Bare ID
    await input.fill("1706.03762");
    await expect(
      page.locator('[data-testid="generate-button"]')
    ).toBeEnabled();

    // Full abs URL
    await input.fill("https://arxiv.org/abs/1706.03762");
    await expect(
      page.locator('[data-testid="generate-button"]')
    ).toBeEnabled();

    // Full pdf URL
    await input.fill("https://arxiv.org/pdf/1706.03762");
    await expect(
      page.locator('[data-testid="generate-button"]')
    ).toBeEnabled();
  });

  test("full arXiv generation with progress messages", async ({ page }) => {
    await page.route("**/api/generate", async (route) => {
      const sseBody = [
        "event: progress\ndata: Extracting text from arXiv (1706.03762)...\n\n",
        "event: progress\ndata: Extracted 12,000 characters from 15 page(s).\n\n",
        "event: progress\ndata: Sending to OpenAI (gpt-4o) for notebook generation...\n\n",
        "event: progress\ndata: Generated 4 notebook cells.\n\n",
        `event: complete\ndata: ${JSON.stringify(MOCK_NOTEBOOK)}\n\n`,
      ].join("");
      await route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: sseBody,
      });
    });

    // Fill form
    await page.locator('[data-testid="api-key-input"]').fill("sk-test");
    await page.locator('[data-testid="input-tab-arxiv"]').click();
    await page.locator('[data-testid="arxiv-url-input"]').fill("1706.03762");
    await page.locator('[data-testid="generate-button"]').click();

    // Should see processing or result (mock is instant, processing may flash)
    const processingView = page.locator('[data-testid="processing-view"]');
    const resultView = page.locator('[data-testid="result-view"]');
    await expect(processingView.or(resultView)).toBeVisible({ timeout: 10000 });

    // Then result
    await expect(resultView).toBeVisible({ timeout: 10000 });

    // Verify summary
    await expect(
      page.locator('[data-testid="notebook-summary"]')
    ).toContainText("4 cells");

    await page.screenshot({
      path: "tests/screenshots/task3-arxiv-01-complete.png",
      fullPage: true,
    });
  });

  test("provider toggle works in arXiv mode", async ({ page }) => {
    let capturedFormData: string | null = null;

    await page.route("**/api/generate", async (route) => {
      capturedFormData = route.request().postData();
      const sseBody = `event: complete\ndata: ${JSON.stringify(MOCK_NOTEBOOK)}\n\n`;
      await route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: sseBody,
      });
    });

    // Select Gemini provider
    await page.locator('[data-testid="provider-tab-gemini"]').click();
    await page.locator('[data-testid="api-key-input"]').fill("AIza-test");
    await page.locator('[data-testid="input-tab-arxiv"]').click();
    await page.locator('[data-testid="arxiv-url-input"]').fill("1706.03762");
    await page.locator('[data-testid="generate-button"]').click();

    await expect(
      page.locator('[data-testid="result-view"]')
    ).toBeVisible({ timeout: 10000 });

    // Verify Gemini provider was sent
    expect(capturedFormData).toBeTruthy();
    expect(capturedFormData).toContain("gemini");
  });

  test("screenshot: arXiv with Gemini provider selected", async ({ page }) => {
    await page.locator('[data-testid="provider-tab-gemini"]').click();
    await page.locator('[data-testid="api-key-input"]').fill("AIza-test-key");
    await page.locator('[data-testid="input-tab-arxiv"]').click();
    await page
      .locator('[data-testid="arxiv-url-input"]')
      .fill("https://arxiv.org/abs/2301.00001");

    await page.screenshot({
      path: "tests/screenshots/task3-arxiv-02-gemini.png",
      fullPage: true,
    });
  });
});
