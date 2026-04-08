import { describe, it, expect } from "vitest";
import { imageDataToParticles } from "@/lib/imageToParticles";

describe("imageToParticles", () => {
  function makeImageData(w: number, h: number, fill: [number,number,number,number]): Uint8ClampedArray {
    const data = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < w * h; i++) {
      data[i * 4] = fill[0];
      data[i * 4 + 1] = fill[1];
      data[i * 4 + 2] = fill[2];
      data[i * 4 + 3] = fill[3];
    }
    return data;
  }

  it("produces correct particle count for solid image", () => {
    const w = 100, h = 100;
    const data = makeImageData(w, h, [255, 0, 0, 255]);
    const result = imageDataToParticles(
      data, w, h,
      { density: 1, samplingMode: "grid", colorFromImage: true, massFromLuminance: false },
      500
    );
    expect(result.count).toBeGreaterThan(0);
    expect(result.count).toBeLessThanOrEqual(500);
  });

  it("produces zero particles for transparent image", () => {
    const w = 50, h = 50;
    const data = makeImageData(w, h, [0, 0, 0, 0]);
    const result = imageDataToParticles(
      data, w, h,
      { density: 1, samplingMode: "grid", colorFromImage: true, massFromLuminance: false },
      500
    );
    expect(result.count).toBe(0);
  });

  it("positions are within image bounds", () => {
    const w = 80, h = 60;
    const data = makeImageData(w, h, [200, 200, 200, 255]);
    const result = imageDataToParticles(
      data, w, h,
      { density: 1, samplingMode: "grid", colorFromImage: false, massFromLuminance: true },
      200
    );
    for (let i = 0; i < result.count; i++) {
      expect(result.positions[i * 2]!).toBeGreaterThanOrEqual(0);
      expect(result.positions[i * 2]!).toBeLessThanOrEqual(w + 1);
      expect(result.positions[i * 2 + 1]!).toBeGreaterThanOrEqual(0);
      expect(result.positions[i * 2 + 1]!).toBeLessThanOrEqual(h + 1);
    }
  });

  it("colors are in [0,1] range", () => {
    const w = 40, h = 40;
    const data = makeImageData(w, h, [128, 64, 200, 255]);
    const result = imageDataToParticles(
      data, w, h,
      { density: 1, samplingMode: "grid", colorFromImage: true, massFromLuminance: false },
      100
    );
    for (let i = 0; i < result.count * 4; i++) {
      expect(result.colors[i]!).toBeGreaterThanOrEqual(0);
      expect(result.colors[i]!).toBeLessThanOrEqual(1);
    }
  });

  it("mass from luminance scales with brightness", () => {
    const w = 10, h = 1;
    const data = new Uint8ClampedArray(w * h * 4);
    // bright pixel
    data[0] = 255; data[1] = 255; data[2] = 255; data[3] = 255;
    // dark pixel
    data[4] = 10;  data[5] = 10;  data[6] = 10;  data[7] = 255;
    const result = imageDataToParticles(
      data, w, h,
      { density: 1, samplingMode: "grid", colorFromImage: false, massFromLuminance: true },
      10
    );
    if (result.count >= 2) {
      expect(result.masses[0]!).toBeGreaterThan(result.masses[1]!);
    }
  });
});
