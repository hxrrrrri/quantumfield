/**
 * @fileoverview GPU-friendly spatial hash for O(1) neighbor lookup.
 * Uses a flat array with cell lists for cache-efficient iteration.
 */

export class SpatialHash {
  private readonly cellSize: number;
  private readonly gridW: number;
  private readonly gridH: number;
  private readonly cells: Int32Array;
  private readonly particleNext: Int32Array;
  private readonly cellHead: Int32Array;
  private maxParticles: number;

  constructor(
    canvasW: number,
    canvasH: number,
    cellSize: number,
    maxParticles: number
  ) {
    this.cellSize = cellSize;
    this.gridW = Math.ceil(canvasW / cellSize) + 1;
    this.gridH = Math.ceil(canvasH / cellSize) + 1;
    this.maxParticles = maxParticles;

    this.cells = new Int32Array(this.gridW * this.gridH).fill(-1);
    this.cellHead = new Int32Array(this.gridW * this.gridH).fill(-1);
    this.particleNext = new Int32Array(maxParticles).fill(-1);
  }

  /** Hash 2D position to flat cell index */
  private hash(x: number, y: number): number {
    const gx = Math.max(0, Math.min(this.gridW - 1, Math.floor(x / this.cellSize)));
    const gy = Math.max(0, Math.min(this.gridH - 1, Math.floor(y / this.cellSize)));
    return gy * this.gridW + gx;
  }

  /** Rebuild hash from particle positions every frame */
  build(px: Float32Array, py: Float32Array, count: number): void {
    // Clear heads
    this.cellHead.fill(-1);

    // Insert particles
    for (let i = 0; i < count; i++) {
      const cell = this.hash(px[i] ?? 0, py[i] ?? 0);
      this.particleNext[i] = this.cellHead[cell] ?? -1;
      this.cellHead[cell] = i;
    }
  }

  /**
   * Query neighbors within radius.
   * Calls callback for each neighbor index.
   */
  query(
    x: number,
    y: number,
    radius: number,
    callback: (j: number, dx: number, dy: number, r2: number) => void
  ): void {
    const r2Max = radius * radius;
    const cxMin = Math.floor((x - radius) / this.cellSize);
    const cxMax = Math.floor((x + radius) / this.cellSize);
    const cyMin = Math.floor((y - radius) / this.cellSize);
    const cyMax = Math.floor((y + radius) / this.cellSize);

    for (let gx = cxMin; gx <= cxMax; gx++) {
      for (let gy = cyMin; gy <= cyMax; gy++) {
        if (gx < 0 || gx >= this.gridW || gy < 0 || gy >= this.gridH) continue;
        const cell = gy * this.gridW + gx;
        let j = this.cellHead[cell] ?? -1;
        while (j !== -1) {
          const dx = (this.cells[j] ?? 0) - x;
          const dy = (this.cells[j + 1] ?? 0) - y;
          const r2 = dx * dx + dy * dy;
          if (r2 <= r2Max) {
            callback(j, dx, dy, r2);
          }
          j = this.particleNext[j] ?? -1;
        }
      }
    }
  }

  /**
   * Get all particles in a specific cell.
   */
  getCell(x: number, y: number): number[] {
    const cell = this.hash(x, y);
    const result: number[] = [];
    let j = this.cellHead[cell] ?? -1;
    while (j !== -1) {
      result.push(j);
      j = this.particleNext[j] ?? -1;
    }
    return result;
  }
}
