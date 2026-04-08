#!/usr/bin/env bun
/**
 * Smoke test script — hits health endpoint and main page.
 * Run: bun run smoke
 */

const BASE_URL = process.env["BASE_URL"] ?? "http://localhost:3000";

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

const results: TestResult[] = [];

async function check(name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
    results.push({ name, passed: true });
    console.log(`  ✓ ${name}`);
  } catch (err) {
    results.push({ name, passed: false, error: String(err) });
    console.error(`  ✗ ${name}: ${String(err)}`);
  }
}

console.log(`\n🔬 QuantumField Smoke Tests — ${BASE_URL}\n`);

await check("GET / returns 200", async () => {
  const res = await fetch(BASE_URL);
  if (!res.ok) throw new Error(`Status ${res.status}`);
  const html = await res.text();
  if (!html.includes("QuantumField")) throw new Error("Title not found in HTML");
});

await check("GET /api/health returns 200 with status:ok", async () => {
  const res = await fetch(`${BASE_URL}/api/health`);
  if (!res.ok) throw new Error(`Status ${res.status}`);
  const body = await res.json() as { status: string };
  if (body.status !== "ok") throw new Error(`status was ${body.status}`);
});

await check("GET /api/scene?preset=galaxy returns 404 or 200", async () => {
  const res = await fetch(`${BASE_URL}/api/scene?preset=galaxy`);
  if (res.status !== 200 && res.status !== 404) {
    throw new Error(`Unexpected status ${res.status}`);
  }
});

await check("GET /api/scene?preset=../etc returns 400", async () => {
  const res = await fetch(`${BASE_URL}/api/scene?preset=../etc`);
  if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
});

await check("POST /api/scene with invalid body returns 400", async () => {
  const res = await fetch(`${BASE_URL}/api/scene`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ invalid: true }),
  });
  if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
});

const passed = results.filter((r) => r.passed).length;
const failed = results.filter((r) => !r.passed).length;
console.log(`\n${passed}/${results.length} tests passed\n`);

if (failed > 0) {
  process.exit(1);
}
