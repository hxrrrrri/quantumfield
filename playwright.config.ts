import { defineConfig, devices } from "@playwright/test";

const projects = [
  { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ...(process.env["CI"] ? [] : [{ name: "firefox", use: { ...devices["Desktop Firefox"] } }]),
];

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env["CI"],
  retries: process.env["CI"] ? 2 : 0,
  ...(process.env["CI"] ? { workers: 1 } : {}),
  reporter: "html",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects,
  webServer: {
    command: "bun run build && bun run start",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env["CI"],
    timeout: 120_000,
  },
});
