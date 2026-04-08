import { describe, it, expect } from "vitest";
import { SpatialHash } from "@/engine/SpatialHash";

describe("SpatialHash", () => {
  it("finds neighbors within radius", () => {
    const hash = new SpatialHash(500, 500, 50, 100);
    const px = new Float32Array([100, 110, 300]);
    const py = new Float32Array([100, 105, 300]);
    hash.build(px, py, 3);

    const found: number[] = [];
    hash.query(105, 102, 30, (j) => found.push(j));
    expect(found).toContain(0);
    expect(found).toContain(1);
    expect(found).not.toContain(2);
  });

  it("does not return false negatives within radius", () => {
    const hash = new SpatialHash(1000, 1000, 60, 200);
    const n = 100;
    const px = new Float32Array(n);
    const py = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      px[i] = Math.random() * 1000;
      py[i] = Math.random() * 1000;
    }
    hash.build(px, py, n);

    const qx = 500, qy = 500, r = 100;
    const fromHash = new Set<number>();
    hash.query(qx, qy, r, (j) => fromHash.add(j));

    for (let i = 0; i < n; i++) {
      const dist = Math.hypot(px[i]! - qx, py[i]! - qy);
      if (dist <= r) {
        expect(fromHash.has(i)).toBe(true);
      }
    }
  });

  it("returns empty for isolated point far away", () => {
    const hash = new SpatialHash(500, 500, 50, 10);
    const px = new Float32Array([10, 15, 12]);
    const py = new Float32Array([10, 12, 11]);
    hash.build(px, py, 3);

    const found: number[] = [];
    hash.query(490, 490, 20, (j) => found.push(j));
    expect(found).toHaveLength(0);
  });
});
