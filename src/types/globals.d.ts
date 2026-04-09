/// <reference types="@webgpu/types" />

/**
 * Global window augmentation for debug object.
 */
declare global {
  interface Window {
    __QUANTUMFIELD_DEBUG__: {
      particles: () => {
        px: Float32Array;
        py: Float32Array;
        pvx: Float32Array;
        pvy: Float32Array;
        pm: Float32Array;
        pc: Float32Array;
      };
      mode: () => string;
      preset: () => string;
    };
  }
}

export {};
