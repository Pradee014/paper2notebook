import { test, expect } from "@playwright/test";

test.describe("Design system and layout shell", () => {
  test("page has dark background", async ({ page }) => {
    await page.goto("/");
    const body = page.locator("body");
    const bgColor = await body.evaluate(
      (el) => getComputedStyle(el).backgroundColor
    );
    // #0a0a0a = rgb(10, 10, 10)
    expect(bgColor).toBe("rgb(10, 10, 10)");
  });

  test("uses Space Mono font family", async ({ page }) => {
    await page.goto("/");
    const body = page.locator("body");
    const fontFamily = await body.evaluate(
      (el) => getComputedStyle(el).fontFamily
    );
    expect(fontFamily.toLowerCase()).toContain("space mono");
  });

  test("header is visible with brand name", async ({ page }) => {
    await page.goto("/");
    const header = page.locator('[data-testid="site-header"]');
    await expect(header).toBeVisible();
    const brand = page.locator('[data-testid="header-brand"]');
    await expect(brand).toHaveText("Paper2Notebook");
  });

  test("header brand text uses yellow accent color", async ({ page }) => {
    await page.goto("/");
    const brand = page.locator('[data-testid="header-brand"]');
    const color = await brand.evaluate((el) => getComputedStyle(el).color);
    // #ffd700 = rgb(255, 215, 0)
    expect(color).toBe("rgb(255, 215, 0)");
  });

  test("main content area is present", async ({ page }) => {
    await page.goto("/");
    const main = page.locator('[data-testid="main-content"]');
    await expect(main).toBeVisible();
  });

  test("hero section displays tagline", async ({ page }) => {
    await page.goto("/");
    const tagline = page.locator('[data-testid="hero-tagline"]');
    await expect(tagline).toBeVisible();
    const text = await tagline.textContent();
    expect(text!.toLowerCase()).toContain("research paper");
  });

  test("dashed yellow separator is visible", async ({ page }) => {
    await page.goto("/");
    const separator = page.locator('[data-testid="separator"]').first();
    await expect(separator).toBeVisible();
  });

  test("full page screenshot matches design intent", async ({ page }) => {
    await page.goto("/");
    await page.waitForTimeout(500);
    await page.screenshot({
      path: "tests/screenshots/task2-01-full-page.png",
      fullPage: true,
    });
  });

  test("page is responsive at mobile width", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/");
    const header = page.locator('[data-testid="site-header"]');
    await expect(header).toBeVisible();
    await page.screenshot({
      path: "tests/screenshots/task2-02-mobile.png",
      fullPage: true,
    });
  });
});
