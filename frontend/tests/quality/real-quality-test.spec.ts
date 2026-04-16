/**
 * REAL QUALITY TEST — Manual API key entry with headed browser
 *
 * This test is NOT part of CI. Run it manually:
 *
 *   cd frontend
 *   npx playwright test tests/quality/real-quality-test.spec.ts --headed --timeout 600000
 *
 * What happens:
 *   1. A visible browser opens
 *   2. The app loads at http://localhost:3000
 *   3. The browser PAUSES — you type your OpenAI API key into the input
 *   4. Click the green "Resume" button in the Playwright inspector to continue
 *   5. The test uploads "Attention Is All You Need" and clicks Generate
 *   6. Waits up to 5 minutes for generation to complete
 *   7. Validates the notebook: JSON structure, 8+ sections, valid Python, etc.
 *   8. Screenshots are saved to tests/screenshots/quality/
 *   9. A pass/fail report is printed to the console
 *
 * Prerequisites:
 *   - Backend running: cd backend && uvicorn main:app --port 8000
 *   - Frontend running: cd frontend && npm run dev
 */

import { test, expect } from "@playwright/test";
import path from "path";

// This test needs a real backend — no route mocking
test.describe("Real quality test — Attention Is All You Need", () => {
  // 5 minute timeout for LLM generation
  test.setTimeout(600_000);

  test("generate notebook from real paper and validate quality", async ({
    page,
  }) => {
    // ─── Step 1: Navigate to app ───
    await page.goto("/");
    await page.screenshot({
      path: "tests/screenshots/quality/01-app-loaded.png",
      fullPage: true,
    });

    // ─── Step 2: Pause for manual API key entry ───
    // The browser will pause here. Type your OpenAI API key into the
    // API key input field, then click "Resume" in the Playwright inspector.
    console.log("\n");
    console.log("╔══════════════════════════════════════════════════════╗");
    console.log("║  PAUSED — Enter your OpenAI API key in the browser  ║");
    console.log("║  Then click 'Resume' in the Playwright inspector    ║");
    console.log("╚══════════════════════════════════════════════════════╝");
    console.log("\n");

    await page.pause();

    // Verify API key was entered
    const apiKeyInput = page.locator('[data-testid="api-key-input"]');
    const keyValue = await apiKeyInput.inputValue();
    expect(keyValue.length).toBeGreaterThan(0);

    await page.screenshot({
      path: "tests/screenshots/quality/02-api-key-entered.png",
      fullPage: true,
    });

    // ─── Step 3: Upload the paper ───
    const fileInput = page.locator('[data-testid="pdf-file-input"]');
    const paperPath = path.resolve(
      __dirname,
      "../fixtures/attention-is-all-you-need.pdf"
    );
    await fileInput.setInputFiles(paperPath);

    // Verify file is shown
    const fileName = page.locator('[data-testid="selected-file-name"]');
    await expect(fileName).toBeVisible();
    await expect(fileName).toContainText("attention");

    await page.screenshot({
      path: "tests/screenshots/quality/03-paper-uploaded.png",
      fullPage: true,
    });

    // ─── Step 4: Click Generate ───
    const generateBtn = page.locator('[data-testid="generate-button"]');
    await expect(generateBtn).toBeEnabled();
    await generateBtn.click();

    // ─── Step 5: Wait for processing ───
    const processingView = page.locator('[data-testid="processing-view"]');
    await expect(processingView).toBeVisible({ timeout: 10_000 });

    await page.screenshot({
      path: "tests/screenshots/quality/04-processing.png",
      fullPage: true,
    });

    // ─── Step 6: Wait for completion (up to 5 minutes) ───
    console.log("Waiting for notebook generation (up to 5 minutes)...");

    const resultView = page.locator('[data-testid="result-view"]');
    const errorMessage = page.locator('[data-testid="error-message"]');

    // Wait for either result or error
    await expect(
      resultView.or(errorMessage)
    ).toBeVisible({ timeout: 300_000 });

    // Check if we got an error
    if (await errorMessage.isVisible()) {
      const errText = await errorMessage.textContent();
      await page.screenshot({
        path: "tests/screenshots/quality/05-ERROR.png",
        fullPage: true,
      });
      throw new Error(`Generation failed with error: ${errText}`);
    }

    await page.screenshot({
      path: "tests/screenshots/quality/05-result.png",
      fullPage: true,
    });

    console.log("Generation complete! Validating notebook...");

    // ─── Step 7: Validate the notebook ───
    const summary = page.locator('[data-testid="notebook-summary"]');
    await expect(summary).toBeVisible();
    const summaryText = await summary.textContent();
    console.log(`Notebook summary: ${summaryText}`);

    // Extract cell count from summary text like "Generated 35 cells — 18 markdown, 17 code"
    const cellMatch = summaryText?.match(/(\d+)\s*cells/);
    const totalCells = cellMatch ? parseInt(cellMatch[1], 10) : 0;
    const markdownMatch = summaryText?.match(/(\d+)\s*markdown/);
    const codeMatch = summaryText?.match(/(\d+)\s*code/);
    const markdownCells = markdownMatch ? parseInt(markdownMatch[1], 10) : 0;
    const codeCells = codeMatch ? parseInt(codeMatch[1], 10) : 0;

    // ─── Validation 1: Minimum cell count ───
    console.log(`  Total cells: ${totalCells}`);
    expect(totalCells).toBeGreaterThanOrEqual(15);

    // ─── Validation 2: Both markdown and code cells present ───
    console.log(`  Markdown cells: ${markdownCells}, Code cells: ${codeCells}`);
    expect(markdownCells).toBeGreaterThanOrEqual(5);
    expect(codeCells).toBeGreaterThanOrEqual(5);

    // ─── Validation 3: Download button works ───
    const downloadBtn = page.locator('[data-testid="download-button"]');
    await expect(downloadBtn).toBeEnabled();

    // Set up download listener and click
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      downloadBtn.click(),
    ]);

    const downloadPath = await download.path();
    expect(downloadPath).toBeTruthy();

    // Read the downloaded file
    const fs = await import("fs");
    const notebookContent = fs.readFileSync(downloadPath!, "utf-8");

    // ─── Validation 4: Valid JSON structure ───
    let notebook: {
      nbformat: number;
      cells: Array<{
        cell_type: string;
        source: string | string[];
      }>;
    };
    try {
      notebook = JSON.parse(notebookContent);
    } catch {
      await page.screenshot({
        path: "tests/screenshots/quality/06-INVALID-JSON.png",
        fullPage: true,
      });
      throw new Error("Downloaded notebook is not valid JSON");
    }
    console.log("  Valid JSON: YES");

    // ─── Validation 5: Valid nbformat ───
    expect(notebook.nbformat).toBe(4);
    console.log("  nbformat 4: YES");

    // ─── Validation 6: Has cells array ───
    expect(notebook.cells).toBeDefined();
    expect(Array.isArray(notebook.cells)).toBe(true);
    expect(notebook.cells.length).toBeGreaterThanOrEqual(15);
    console.log(`  Cells in .ipynb: ${notebook.cells.length}`);

    // ─── Validation 7: 8+ sections (markdown cells with headers) ───
    const sectionHeaders = notebook.cells.filter((c) => {
      if (c.cell_type !== "markdown") return false;
      const src = Array.isArray(c.source) ? c.source.join("") : c.source;
      return /^#+\s/.test(src.trim());
    });
    console.log(
      `  Sections (markdown headers): ${sectionHeaders.length}`
    );
    const sectionTitles = sectionHeaders.map((c) => {
      const src = Array.isArray(c.source) ? c.source.join("") : c.source;
      return src.trim().split("\n")[0];
    });
    console.log("  Section titles:");
    for (const title of sectionTitles) {
      console.log(`    ${title}`);
    }
    expect(sectionHeaders.length).toBeGreaterThanOrEqual(8);

    // ─── Validation 8: Code cells contain Python-like syntax ───
    const codeCellsList = notebook.cells.filter(
      (c) => c.cell_type === "code"
    );
    const pythonKeywords = [
      "import",
      "def ",
      "class ",
      "for ",
      "if ",
      "return",
      "print",
      "np.",
      "torch",
      "plt.",
    ];
    let pythonHits = 0;
    for (const cell of codeCellsList) {
      const src = Array.isArray(cell.source)
        ? cell.source.join("")
        : cell.source;
      if (pythonKeywords.some((kw) => src.includes(kw))) {
        pythonHits++;
      }
    }
    console.log(
      `  Code cells with Python keywords: ${pythonHits}/${codeCellsList.length}`
    );
    // At least 80% of code cells should look like Python
    expect(pythonHits).toBeGreaterThanOrEqual(
      Math.floor(codeCellsList.length * 0.8)
    );

    // ─── Validation 9: Paper title referenced ───
    const allText = notebook.cells
      .map((c) => (Array.isArray(c.source) ? c.source.join("") : c.source))
      .join(" ")
      .toLowerCase();
    const hasAttention =
      allText.includes("attention") && allText.includes("transformer");
    console.log(`  References "attention" + "transformer": ${hasAttention ? "YES" : "NO"}`);
    expect(hasAttention).toBe(true);

    // ─── Final screenshot ───
    await page.screenshot({
      path: "tests/screenshots/quality/06-validation-passed.png",
      fullPage: true,
    });

    // ─── Report ───
    console.log("\n");
    console.log("╔══════════════════════════════════════════════════════╗");
    console.log("║              QUALITY TEST REPORT                    ║");
    console.log("╠══════════════════════════════════════════════════════╣");
    console.log(`║  Paper: Attention Is All You Need (1706.03762)      ║`);
    console.log(`║  Total cells: ${String(totalCells).padEnd(39)}║`);
    console.log(`║  Markdown cells: ${String(markdownCells).padEnd(36)}║`);
    console.log(`║  Code cells: ${String(codeCells).padEnd(40)}║`);
    console.log(`║  Sections (headers): ${String(sectionHeaders.length).padEnd(32)}║`);
    console.log(`║  Valid JSON: YES${" ".repeat(37)}║`);
    console.log(`║  nbformat 4: YES${" ".repeat(36)}║`);
    console.log(`║  Python code cells: ${pythonHits}/${codeCellsList.length}${" ".repeat(Math.max(0, 31 - `${pythonHits}/${codeCellsList.length}`.length))}║`);
    console.log(`║  Paper title referenced: YES${" ".repeat(25)}║`);
    console.log("╠══════════════════════════════════════════════════════╣");
    console.log("║  RESULT: ALL CHECKS PASSED                         ║");
    console.log("╚══════════════════════════════════════════════════════╝");
    console.log("\n");
    console.log(
      `Screenshots saved to: tests/screenshots/quality/`
    );
  });
});
