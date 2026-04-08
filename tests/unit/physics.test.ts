import { describe, it, expect } from "vitest";
import { elasticCollision, initMaxwellBoltzmann } from "@/physics/classical";
import { tunnelingProbability, doubleSlitIntensity, harmonicOscillatorEnergy } from "@/physics/quantum";
import { lorentzFactor, schwarzschildRadius, timeDilation, lengthContraction } from "@/physics/relativity";

describe("Classical Physics", () => {
  it("elastic collision conserves momentum", () => {
    const result = elasticCollision(1, 2, 0, 1, -1, 0, 1, 0);
    const pBefore = 1 * 2 + 1 * -1;
    const pAfter = 1 * result.v1x + 1 * result.v2x;
    expect(Math.abs(pAfter - pBefore)).toBeLessThan(0.001);
  });

  it("elastic collision conserves kinetic energy", () => {
    const result = elasticCollision(1, 3, 0, 1, 0, 0, 1, 0, 1.0);
    const keBefore = 0.5 * 1 * 9 + 0;
    const keAfter = 0.5 * result.v1x ** 2 + 0.5 * result.v2x ** 2;
    expect(Math.abs(keAfter - keBefore)).toBeLessThan(0.01);
  });

  it("Maxwell-Boltzmann produces non-zero velocities", () => {
    const pvx = new Float32Array(100);
    const pvy = new Float32Array(100);
    initMaxwellBoltzmann(pvx, pvy, 100, 300, 1.38e-23);
    const hasNonZero = Array.from(pvx).some((v) => v !== 0);
    expect(hasNonZero).toBe(true);
  });

  it("Maxwell-Boltzmann has near-zero mean", () => {
    const pvx = new Float32Array(1000);
    const pvy = new Float32Array(1000);
    initMaxwellBoltzmann(pvx, pvy, 1000, 300, 1.38e-23);
    const mean = Array.from(pvx).reduce((a, b) => a + b, 0) / 1000;
    expect(Math.abs(mean)).toBeLessThan(0.1);
  });
});

describe("Quantum Mechanics", () => {
  it("tunneling probability = 1 when E > V0", () => {
    expect(tunnelingProbability(10, 5, 1, 1, 1)).toBeCloseTo(1.0);
  });

  it("tunneling probability < 1 when E < V0", () => {
    const T = tunnelingProbability(1, 5, 1, 1, 0.1);
    expect(T).toBeGreaterThan(0);
    expect(T).toBeLessThan(1);
  });

  it("tunneling decreases with barrier width", () => {
    const T1 = tunnelingProbability(1, 5, 0.5, 1, 1);
    const T2 = tunnelingProbability(1, 5, 2.0, 1, 1);
    expect(T1).toBeGreaterThan(T2);
  });

  it("harmonic oscillator energy levels are quantized", () => {
    const E0 = harmonicOscillatorEnergy(0, 1, 1);
    const E1 = harmonicOscillatorEnergy(1, 1, 1);
    const E2 = harmonicOscillatorEnergy(2, 1, 1);
    expect(E1 - E0).toBeCloseTo(E2 - E1);
  });

  it("double slit intensity is zero at destructive nodes", () => {
    // At y = lambda*L/(2*d), we expect near-zero (first destructive node)
    const lambda = 500e-9, L = 1, d = 0.001;
    const y = (lambda * L) / (2 * d);
    const I = doubleSlitIntensity(y, d, d / 10, lambda, L);
    expect(I).toBeLessThan(0.1);
  });
});

describe("Special Relativity", () => {
  it("Lorentz factor is 1 at v=0", () => {
    expect(lorentzFactor(0, 300)).toBeCloseTo(1.0);
  });

  it("Lorentz factor > 1 at v > 0", () => {
    expect(lorentzFactor(100, 300)).toBeGreaterThan(1);
  });

  it("Lorentz factor → ∞ as v → c", () => {
    expect(lorentzFactor(299.9, 300)).toBeGreaterThan(30);
  });

  it("time dilation: moving clocks run slow", () => {
    const dt = timeDilation(1, 100, 300);
    expect(dt).toBeGreaterThan(1);
  });

  it("length contraction: moving objects appear shorter", () => {
    const L = lengthContraction(10, 100, 300);
    expect(L).toBeLessThan(10);
  });

  it("Schwarzschild radius scales with mass", () => {
    const rs1 = schwarzschildRadius(1, 6.674e-11, 3e8);
    const rs2 = schwarzschildRadius(2, 6.674e-11, 3e8);
    expect(rs2).toBeCloseTo(rs1 * 2);
  });
});
