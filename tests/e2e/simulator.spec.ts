import { test, expect } from "@playwright/test";

test.describe("QuantumField Simulator", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("page loads and canvas renders within 3 seconds", async ({ page }) => {
    await expect(page.locator("canvas")).toBeVisible({ timeout: 3000 });
    const title = await page.title();
    expect(title).toContain("QuantumField");
  });

  test("physics mode buttons exist in topbar", async ({ page }) => {
    await expect(page.getByRole("button", { name: /classical/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /quantum/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /relativity/i })).toBeVisible();
  });

  test("changing physics mode updates the equation label", async ({ page }) => {
    await page.getByRole("button", { name: /quantum/i }).click();
    await expect(page.getByText("iℏ∂ψ/∂t = Ĥψ")).toBeVisible({ timeout: 2000 });
  });

  test("sidebar controls are accessible", async ({ page }) => {
    await expect(page.getByRole("complementary")).toBeVisible();
    await expect(page.getByRole("slider").first()).toBeVisible();
  });

  test("preset buttons are present", async ({ page }) => {
    await expect(page.getByRole("button", { name: /big bang/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /galaxy/i })).toBeVisible();
  });

  test("pause/play button works", async ({ page }) => {
    const btn = page.getByRole("button", { name: /pause/i });
    await expect(btn).toBeVisible();
    await btn.click();
    await expect(page.getByRole("button", { name: /play/i })).toBeVisible();
  });

  test("api health endpoint returns ok", async ({ request }) => {
    const res = await request.get("/api/health");
    expect(res.status()).toBe(200);
    const body = await res.json() as { status: string };
    expect(body.status).toBe("ok");
  });

  test("api scene rejects invalid preset name", async ({ request }) => {
    const res = await request.get("/api/scene?preset=../../../etc");
    expect(res.status()).toBe(400);
  });

  test("text input renders particles on button click", async ({ page }) => {
    const input = page.getByLabel("Text to render as particles");
    await input.fill("TEST");
    await page.getByRole("button", { name: /render as particles/i }).click();
    // Canvas should still be visible after action
    await expect(page.locator("canvas")).toBeVisible();
  });

  test("no uncaught JS errors on load", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await page.waitForTimeout(2000);
    expect(errors.filter((e) => !e.includes("ResizeObserver"))).toHaveLength(0);
  });
});
