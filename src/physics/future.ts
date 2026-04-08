/**
 * @fileoverview Speculative / future physics module.
 * Implements string theory vibrations, dark matter halos,
 * extra dimensions, quantum gravity foam, and CCC cosmology.
 */

export const futureModule = {
  name: "Speculative Physics",
  equation: "S = −1/(2α′)∫d²σ·∂ₐXᵘ∂ᵃXᵤ",
  discoverer: "Nambu, Nielsen, Susskind",
  year: 1970,
  description:
    "String vibrations, dark matter halos, extra dimensions (4D→3D projection), quantum gravity foam.",
};

/**
 * String theory: particle vibrates as 1D string.
 * Frequency encodes color; amplitude encodes mass.
 * Mode n contributes mass² = n/α′
 */
export function stringVibration(
  x0: number,
  y0: number,
  t: number,
  stringLength: number,
  tension: number,
  modes: number[]
): { x: number; y: number } {
  let dx = 0;
  let dy = 0;
  for (let n = 1; n <= modes.length; n++) {
    const amplitude = (modes[n - 1] ?? 0) / n;
    const omega = Math.sqrt(tension * n * n * Math.PI * Math.PI / (stringLength * stringLength));
    dx += amplitude * Math.sin((n * Math.PI * x0) / stringLength) * Math.cos(omega * t);
    dy += amplitude * Math.sin((n * Math.PI * y0) / stringLength) * Math.sin(omega * t);
  }
  return { x: dx, y: dy };
}

/**
 * Dark matter NFW density profile: ρ(r) = ρs / [(r/rs)(1 + r/rs)²]
 */
export function nfwDensity(
  r: number,
  rhoS: number,
  rs: number
): number {
  if (r < 0.01) return rhoS;
  const x = r / rs;
  return rhoS / (x * (1 + x) * (1 + x));
}

/**
 * Dark matter acceleration at radius r toward halo center.
 * Derived from NFW mass integral: M(r) = 4πρs·rs³·[ln(1+r/rs) − r/(rs+r)]
 */
export function darkMatterAcceleration(
  r: number,
  rhoS: number,
  rs: number,
  G: number
): number {
  if (r < 0.01) return 0;
  const x = r / rs;
  const mass = 4 * Math.PI * rhoS * rs * rs * rs * (Math.log(1 + x) - x / (1 + x));
  return (G * mass) / (r * r);
}

/**
 * Project 4D position to 3D via rotation matrix.
 * Used in extra-dimensions mode.
 */
export function project4Dto3D(
  x: number,
  y: number,
  z: number,
  w: number,
  rotAngle: number
): { x: number; y: number; z: number } {
  // Simple rotation in xw-plane
  const cosA = Math.cos(rotAngle);
  const sinA = Math.sin(rotAngle);
  return {
    x: x * cosA - w * sinA,
    y: y,
    z: z * cosA + w * sinA,
  };
}

/**
 * Quantum gravity foam: Planck-scale position jitter.
 * δx ~ lPlanck = √(ℏG/c³)
 * Scaled for visualization.
 */
export function planckJitter(
  scale: number,
  dt: number
): { dx: number; dy: number } {
  // Ornstein-Uhlenbeck process for colored noise
  const sigma = scale * Math.sqrt(dt);
  return {
    dx: sigma * (Math.random() * 2 - 1),
    dy: sigma * (Math.random() * 2 - 1),
  };
}

/**
 * Apply future physics forces to particle arrays.
 */
export function applyFuturePhysics(
  pxArr: Float32Array,
  pyArr: Float32Array,
  pvxArr: Float32Array,
  pvyArr: Float32Array,
  pmArr: Float32Array,
  pcArr: Float32Array,
  pphase: Float32Array,
  count: number,
  dt: number,
  subMode: "strings" | "dark" | "extra" | "foam" | "ccc",
  simTime: number,
  canvasW: number,
  canvasH: number
): void {
  const cx = canvasW / 2;
  const cy = canvasH / 2;

  for (let i = 0; i < count; i++) {
    const x = pxArr[i] ?? 0;
    const y = pyArr[i] ?? 0;
    const phase = pphase[i] ?? 0;
    let vx = pvxArr[i] ?? 0;
    let vy = pvyArr[i] ?? 0;

    switch (subMode) {
      case "strings": {
        // String vibration contributes velocity
        const modes = [1, 0.5, 0.25, 0.12];
        const freq = 1 + (pmArr[i] ?? 1) * 2;
        const vib = stringVibration(x, y, simTime * freq, 200, 10, modes);
        vx += vib.x * 0.1 * dt;
        vy += vib.y * 0.1 * dt;
        pcArr[i] = (Math.sin(phase + simTime * freq) + 1) * 0.5;
        break;
      }
      case "dark": {
        const r = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2) + 0.1;
        const acc = darkMatterAcceleration(r, 2, 200, 0.8);
        const ax = (acc * (cx - x)) / r;
        const ay = (acc * (cy - y)) / r;
        vx += ax * dt;
        vy += ay * dt;
        pcArr[i] = Math.min(1, 0.15 + 0.85 * (1 - r / Math.max(canvasW, canvasH)));
        break;
      }
      case "foam": {
        const jitter = planckJitter(3.0, dt);
        vx += jitter.dx;
        vy += jitter.dy;
        pcArr[i] = Math.random() * 0.5 + 0.5;
        break;
      }
      case "ccc": {
        // Conformal Cyclic Cosmology: big bang → big crunch → repeat
        const r = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
        const cycle = Math.sin(simTime * 0.1) * 0.5 + 0.5; // 0→1→0
        const forceDir = cycle < 0.5 ? 1 : -1;
        const f = forceDir * 0.02 * (1 - r / Math.max(canvasW, canvasH));
        vx += ((cx - x) / (r + 1)) * f * dt;
        vy += ((cy - y) / (r + 1)) * f * dt;
        pcArr[i] = cycle;
        break;
      }
      case "extra": {
        // 4D rotation projected to 2D
        const w = Math.sin(phase + simTime * 0.2) * 50;
        const proj = project4Dto3D(x - cx, y - cy, 0, w, simTime * 0.05);
        vx += (proj.x + cx - x) * 0.005 * dt;
        vy += (proj.y + cy - y) * 0.005 * dt;
        pcArr[i] = (Math.sin(proj.z * 0.05 + simTime) + 1) * 0.5;
        break;
      }
    }

    // Damping
    vx *= 0.999;
    vy *= 0.999;
    pvxArr[i] = vx;
    pvyArr[i] = vy;

    let nx = x + vx * dt;
    let ny = y + vy * dt;
    if (nx < 0) nx = canvasW;
    if (nx > canvasW) nx = 0;
    if (ny < 0) ny = canvasH;
    if (ny > canvasH) ny = 0;
    pxArr[i] = nx;
    pyArr[i] = ny;

    pphase[i] = phase + 0.03 * dt;
  }
}
