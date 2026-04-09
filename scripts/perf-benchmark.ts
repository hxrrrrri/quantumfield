#!/usr/bin/env bun
/**
 * Performance benchmark — measures physics step time at various particle counts.
 * Run: bun run bench
 */

const P95_THRESHOLD_MS = Number(
  process.env["BENCH_P95_THRESHOLD_MS"] ?? (process.env["CI"] ? "30" : "20")
); // CI runners are noisier; allow override and a safer default in CI.

function physicsStep(count: number, G: number): number {
  const px = new Float32Array(count);
  const py = new Float32Array(count);
  const pvx = new Float32Array(count);
  const pvy = new Float32Array(count);
  const pm = new Float32Array(count).fill(1);

  for (let i = 0; i < count; i++) {
    px[i] = Math.random() * 800;
    py[i] = Math.random() * 600;
    pvx[i] = (Math.random() - 0.5) * 2;
    pvy[i] = (Math.random() - 0.5) * 2;
  }

  const start = performance.now();

  // Grid-based gravity
  const W = 800, H = 600;
  const cellSize = 70;
  const gcx = Math.ceil(W / cellSize) + 1;
  const gcy = Math.ceil(H / cellSize) + 1;
  const gridMass = new Float32Array(gcx * gcy);
  const gridX = new Float32Array(gcx * gcy);
  const gridY = new Float32Array(gcx * gcy);

  for (let i = 0; i < count; i++) {
    const gx = Math.max(0, Math.min(gcx - 1, Math.floor(px[i]! / cellSize)));
    const gy = Math.max(0, Math.min(gcy - 1, Math.floor(py[i]! / cellSize)));
    const gi = gy * gcx + gx;
    gridMass[gi]! += pm[i]!;
    gridX[gi]! += px[i]! * pm[i]!;
    gridY[gi]! += py[i]! * pm[i]!;
  }

  for (let i = 0; i < count; i++) {
    let ax = 0, ay = 0;
    const gxi = Math.floor(px[i]! / cellSize);
    const gyi = Math.floor(py[i]! / cellSize);
    for (let dgx = -2; dgx <= 2; dgx++) {
      for (let dgy = -2; dgy <= 2; dgy++) {
        const nx = gxi + dgx, ny = gyi + dgy;
        if (nx < 0 || nx >= gcx || ny < 0 || ny >= gcy) continue;
        const gi = ny * gcx + nx;
        const mass = gridMass[gi]!;
        if (mass < 0.001) continue;
        const cmx = gridX[gi]! / mass, cmy = gridY[gi]! / mass;
        const dx = cmx - px[i]!, dy = cmy - py[i]!;
        const r2 = dx * dx + dy * dy + 200;
        const r = Math.sqrt(r2);
        const f = G * mass / r2;
        ax += f * dx / r;
        ay += f * dy / r;
      }
    }
    pvx[i]! += ax * 0.016;
    pvy[i]! += ay * 0.016;
    px[i]! += pvx[i]!;
    py[i]! += pvy[i]!;
  }

  return performance.now() - start;
}

const COUNTS = [10_000, 50_000, 100_000, 500_000];
const RUNS = 10;

console.log("\n⚡ QuantumField Performance Benchmark (JS physics kernel)\n");
console.log(
  "Particles".padEnd(12) +
  "P50 (ms)".padEnd(12) +
  "P95 (ms)".padEnd(12) +
  "P99 (ms)".padEnd(12) +
  "Pass"
);
console.log("─".repeat(50));

let allPassed = true;

for (const count of COUNTS) {
  // Warm up JIT and allocator to reduce first-iteration jitter.
  physicsStep(count, 1.0);

  const times: number[] = [];
  for (let r = 0; r < RUNS; r++) {
    times.push(physicsStep(count, 1.0));
  }
  times.sort((a, b) => a - b);

  const p50 = times[Math.floor(RUNS * 0.5)]!;
  const p95 = times[Math.floor(RUNS * 0.95)]!;
  const p99 = times[Math.min(RUNS - 1, Math.floor(RUNS * 0.99))]!;
  const enforceThreshold = count === 100_000;
  const pass = enforceThreshold ? p95 <= P95_THRESHOLD_MS : true;
  if (!pass) allPassed = false;

  console.log(
    count.toLocaleString().padEnd(12) +
    p50.toFixed(1).padEnd(12) +
    p95.toFixed(1).padEnd(12) +
    p99.toFixed(1).padEnd(12) +
    (pass ? "✓" : `✗ P95>${P95_THRESHOLD_MS}ms`)
  );
}

console.log();
if (!allPassed) {
  console.error("❌ Performance benchmark FAILED\n");
  process.exit(1);
} else {
  console.log("✅ Performance benchmark PASSED\n");
}
