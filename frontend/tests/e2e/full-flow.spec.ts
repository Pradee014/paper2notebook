import { test, expect } from "@playwright/test";
import path from "path";

const MOCK_NOTEBOOK = {
  cells: [
    { cell_type: "markdown", source: "# Attention Is All You Need" },
    { cell_type: "code", source: "import torch\nimport torch.nn as nn" },
    { cell_type: "markdown", source: "## Abstract & Contribution Summary" },
    {
      cell_type: "code",
      source:
        "class MultiHeadAttention(nn.Module):\n    def __init__(self, d_model, n_heads):\n        super().__init__()",
    },
    { cell_type: "markdown", source: "## Experiments & Visualization" },
    {
      cell_type: "code",
      source: "import matplotlib.pyplot as plt\nplt.plot([1,2,3])",
    },
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
          source: "# Attention Is All You Need",
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

function mockGenerateSSE(page: import("@playwright/test").Page) {
  return page.route("**/api/generate", async (route) => {
    const sseBody = [
      "event: progress\ndata: Extracting text from PDF...\n\n",
      "event: progress\ndata: Extracted 15,200 characters from 8 page(s).\n\n",
      "event: progress\ndata: Analyzing paper structure...\n\n",
      "event: progress\ndata: Sending to OpenAI (gpt-4o) for notebook generation...\n\n",
      "event: progress\ndata: Generating mathematical formulations...\n\n",
      "event: progress\ndata: Generated 6 notebook cells.\n\n",
      "event: progress\ndata: Building notebook...\n\n",
      `event: complete\ndata: ${JSON.stringify(MOCK_NOTEBOOK)}\n\n`,
    ].join("");

    await route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      body: sseBody,
    });
  });
}

test.describe("Full flow — PDF upload (mocked backend)", () => {
  test("complete PDF upload flow: key → upload → progress → result → download", async ({
    page,
  }) => {
    await page.goto("/");
    await mockGenerateSSE(page);

    // Step 1: Screenshot of initial state
    await page.screenshot({
      path: "tests/screenshots/task3-flow-01-initial.png",
      fullPage: true,
    });

    // Step 2: Enter API key
    const apiKeyInput = page.locator('[data-testid="api-key-input"]');
    await apiKeyInput.fill("sk-test-key-12345");

    // Step 3: Upload PDF
    const fileInput = page.locator('[data-testid="pdf-file-input"]');
    const testPdfPath = path.resolve(__dirname, "../fixtures/test-paper.pdf");
    await fileInput.setInputFiles(testPdfPath);

    await page.screenshot({
      path: "tests/screenshots/task3-flow-02-pdf-ready.png",
      fullPage: true,
    });

    // Step 4: Click generate
    const generateBtn = page.locator('[data-testid="generate-button"]');
    await expect(generateBtn).toBeEnabled();
    await generateBtn.click();

    // Step 5: Wait for either processing or result (mock is instant, so
    // the processing view may flash too fast to catch)
    const processingView = page.locator('[data-testid="processing-view"]');
    const resultView = page.locator('[data-testid="result-view"]');
    await expect(processingView.or(resultView)).toBeVisible({ timeout: 10000 });

    // Step 6: Wait for result view specifically
    await expect(resultView).toBeVisible({ timeout: 10000 });

    await page.screenshot({
      path: "tests/screenshots/task3-flow-03-pdf-result.png",
      fullPage: true,
    });

    // Step 7: Verify cell count
    const summary = page.locator('[data-testid="notebook-summary"]');
    await expect(summary).toContainText("6 cells");

    // Step 8: Download button is available
    const downloadBtn = page.locator('[data-testid="download-button"]');
    await expect(downloadBtn).toBeVisible();
    await expect(downloadBtn).toBeEnabled();
  });

  test("PDF upload flow: error → retry returns to input", async ({ page }) => {
    await page.goto("/");

    // First call: return error
    let callCount = 0;
    await page.route("**/api/generate", async (route) => {
      callCount++;
      if (callCount === 1) {
        const sseBody =
          'event: error\ndata: {"message":"API key is invalid. Please check and try again."}\n\n';
        await route.fulfill({
          status: 200,
          contentType: "text/event-stream",
          body: sseBody,
        });
      } else {
        const sseBody = `event: complete\ndata: ${JSON.stringify(MOCK_NOTEBOOK)}\n\n`;
        await route.fulfill({
          status: 200,
          contentType: "text/event-stream",
          body: sseBody,
        });
      }
    });

    // Enter key + upload
    await page.locator('[data-testid="api-key-input"]').fill("sk-bad-key");
    const fileInput = page.locator('[data-testid="pdf-file-input"]');
    await fileInput.setInputFiles(
      path.resolve(__dirname, "../fixtures/test-paper.pdf")
    );
    await page.locator('[data-testid="generate-button"]').click();

    // Error should appear
    const errorMessage = page.locator('[data-testid="error-message"]');
    await expect(errorMessage).toBeVisible({ timeout: 5000 });
    await expect(errorMessage).toContainText("invalid");

    await page.screenshot({
      path: "tests/screenshots/task3-flow-04-pdf-error.png",
      fullPage: true,
    });

    // Click retry
    const retryBtn = page.locator('[data-testid="retry-button"]');
    await retryBtn.click();

    // Should return to input form
    await expect(page.locator('[data-testid="input-form"]')).toBeVisible();
  });

  test("new notebook button resets and allows second generation", async ({
    page,
  }) => {
    await page.goto("/");
    await mockGenerateSSE(page);

    // First generation
    await page.locator('[data-testid="api-key-input"]').fill("sk-test-key");
    const fileInput = page.locator('[data-testid="pdf-file-input"]');
    await fileInput.setInputFiles(
      path.resolve(__dirname, "../fixtures/test-paper.pdf")
    );
    await page.locator('[data-testid="generate-button"]').click();

    // Wait for result
    await expect(
      page.locator('[data-testid="result-view"]')
    ).toBeVisible({ timeout: 10000 });

    // Click new notebook
    await page.locator('[data-testid="new-notebook-button"]').click();

    // Input form should be back
    await expect(page.locator('[data-testid="input-form"]')).toBeVisible();
    await expect(page.locator('[data-testid="result-view"]')).not.toBeVisible();
  });
});

test.describe("Full flow — arXiv URL (mocked backend)", () => {
  test("complete arXiv URL flow: key → URL → progress → result → download", async ({
    page,
  }) => {
    await page.goto("/");
    await mockGenerateSSE(page);

    // Step 1: Enter API key
    await page.locator('[data-testid="api-key-input"]').fill("sk-test-key");

    // Step 2: Switch to arXiv tab
    await page.locator('[data-testid="input-tab-arxiv"]').click();

    await page.screenshot({
      path: "tests/screenshots/task3-flow-05-arxiv-tab.png",
      fullPage: true,
    });

    // Step 3: Enter arXiv URL
    await page
      .locator('[data-testid="arxiv-url-input"]')
      .fill("https://arxiv.org/abs/1706.03762");

    await page.screenshot({
      path: "tests/screenshots/task3-flow-06-arxiv-ready.png",
      fullPage: true,
    });

    // Step 4: Generate button should be enabled
    const generateBtn = page.locator('[data-testid="generate-button"]');
    await expect(generateBtn).toBeEnabled();
    await generateBtn.click();

    // Step 5: Processing view
    const processingView = page.locator('[data-testid="processing-view"]');
    await expect(processingView).toBeVisible({ timeout: 5000 });

    // Step 6: Result view
    const resultView = page.locator('[data-testid="result-view"]');
    await expect(resultView).toBeVisible({ timeout: 10000 });

    await page.screenshot({
      path: "tests/screenshots/task3-flow-07-arxiv-result.png",
      fullPage: true,
    });

    // Verify notebook content
    const summary = page.locator('[data-testid="notebook-summary"]');
    await expect(summary).toContainText("6 cells");

    const downloadBtn = page.locator('[data-testid="download-button"]');
    await expect(downloadBtn).toBeEnabled();
  });

  test("arXiv flow sends arxiv_url in request (no file)", async ({ page }) => {
    await page.goto("/");

    let capturedFormData: string | null = null;

    await page.route("**/api/generate", async (route) => {
      // Capture the request body to verify arxiv_url is sent
      const request = route.request();
      capturedFormData = request.postData();

      const sseBody = `event: complete\ndata: ${JSON.stringify(MOCK_NOTEBOOK)}\n\n`;
      await route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: sseBody,
      });
    });

    await page.locator('[data-testid="api-key-input"]').fill("sk-test-key");
    await page.locator('[data-testid="input-tab-arxiv"]').click();
    await page
      .locator('[data-testid="arxiv-url-input"]')
      .fill("1706.03762");
    await page.locator('[data-testid="generate-button"]').click();

    // Wait for result
    await expect(
      page.locator('[data-testid="result-view"]')
    ).toBeVisible({ timeout: 10000 });

    // Verify arxiv_url was in the request
    expect(capturedFormData).toBeTruthy();
    expect(capturedFormData).toContain("1706.03762");
  });

  test("arXiv flow: error from backend shows error view", async ({ page }) => {
    await page.goto("/");

    await page.route("**/api/generate", async (route) => {
      const sseBody =
        'event: error\ndata: {"message":"Paper 9999.99999 not found on arXiv."}\n\n';
      await route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: sseBody,
      });
    });

    await page.locator('[data-testid="api-key-input"]').fill("sk-test-key");
    await page.locator('[data-testid="input-tab-arxiv"]').click();
    await page.locator('[data-testid="arxiv-url-input"]').fill("9999.99999");
    await page.locator('[data-testid="generate-button"]').click();

    const errorMessage = page.locator('[data-testid="error-message"]');
    await expect(errorMessage).toBeVisible({ timeout: 5000 });
    await expect(errorMessage).toContainText("not found");

    await page.screenshot({
      path: "tests/screenshots/task3-flow-08-arxiv-error.png",
      fullPage: true,
    });
  });

  test("switching tabs mid-form preserves API key", async ({ page }) => {
    await page.goto("/");

    // Enter API key in PDF mode
    await page.locator('[data-testid="api-key-input"]').fill("sk-my-key");

    // Switch to arXiv
    await page.locator('[data-testid="input-tab-arxiv"]').click();

    // API key should still be filled
    const apiKeyInput = page.locator('[data-testid="api-key-input"]');
    await expect(apiKeyInput).toHaveValue("sk-my-key");
  });
});
