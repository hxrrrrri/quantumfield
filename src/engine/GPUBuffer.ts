/**
 * @fileoverview WebGPU buffer management utilities.
 * Handles buffer creation, upload, and lifecycle.
 */

export class GPUBufferManager {
  private readonly device: GPUDevice;
  private buffers = new Map<string, GPUBuffer>();

  constructor(device: GPUDevice) {
    this.device = device;
  }

  /** Create or update a GPU buffer with Float32Array data */
  upsert(
    label: string,
    data: Float32Array,
    usage: GPUBufferUsageFlags
  ): GPUBuffer {
    const existing = this.buffers.get(label);
    const byteSize = data.byteLength;

    if (existing && existing.size === byteSize) {
      this.device.queue.writeBuffer(existing, 0, data);
      return existing;
    }

    existing?.destroy();
    const buffer = this.device.createBuffer({
      label,
      size: byteSize,
      usage: usage | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true,
    });
    new Float32Array(buffer.getMappedRange()).set(data);
    buffer.unmap();
    this.buffers.set(label, buffer);
    return buffer;
  }

  /** Get an existing buffer by label */
  get(label: string): GPUBuffer | undefined {
    return this.buffers.get(label);
  }

  /** Destroy all buffers */
  destroyAll(): void {
    for (const buf of this.buffers.values()) {
      buf.destroy();
    }
    this.buffers.clear();
  }
}
