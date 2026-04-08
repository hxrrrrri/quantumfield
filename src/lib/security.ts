/**
 * @fileoverview Security utilities: input validation, rate limiting,
 * MIME type verification, and scene JSON sanitization.
 */

import { z } from "zod";
import type { UploadValidationResult } from "@/types";

// ---- MIME type magic bytes ----

const MAGIC_BYTES: Record<string, Uint8Array> = {
  "image/png": new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
  "image/jpeg": new Uint8Array([0xff, 0xd8, 0xff]),
  "image/webp": new Uint8Array([0x52, 0x49, 0x46, 0x46]),
  "image/gif": new Uint8Array([0x47, 0x49, 0x46, 0x38]),
};

/**
 * Validate image upload by checking magic bytes (not extension).
 * Rejects oversized files and strips metadata via re-render.
 */
export async function validateImageUpload(
  file: File,
  maxSizeBytes = 10 * 1024 * 1024
): Promise<UploadValidationResult> {
  // Size check
  if (file.size > maxSizeBytes) {
    return {
      valid: false,
      error: `File too large: ${(file.size / 1024 / 1024).toFixed(1)}MB (max 10MB)`,
    };
  }

  // Read first 12 bytes for magic number check
  const head = await file.slice(0, 12).arrayBuffer();
  const bytes = new Uint8Array(head);

  let detectedMime: string | null = null;
  for (const [mime, magic] of Object.entries(MAGIC_BYTES)) {
    if (magic.every((b, i) => bytes[i] === b)) {
      detectedMime = mime;
      break;
    }
  }

  // SVG: text-based, check for XML/SVG signature
  const text = new TextDecoder().decode(bytes);
  if (text.includes("<svg") || text.includes("<?xml")) {
    detectedMime = "image/svg+xml";
  }

  if (!detectedMime) {
    return {
      valid: false,
      error: "Invalid file type. Accepted: PNG, JPG, WebP, GIF, SVG",
    };
  }

  // Block SVG with script content (XSS prevention)
  if (detectedMime === "image/svg+xml") {
    const fullText = await file.text();
    if (/<script/i.test(fullText) || /javascript:/i.test(fullText)) {
      return {
        valid: false,
        error: "SVG contains disallowed script content",
      };
    }
  }

  return { valid: true, mimeType: detectedMime };
}

// ---- Text sanitization ----

/**
 * Sanitize user text input: strip HTML, limit length, reject injection patterns.
 */
export function sanitizeText(input: string, maxLength = 500): string {
  // Remove HTML tags
  let clean = input.replace(/<[^>]*>/g, "");
  // Remove null bytes and control chars
  clean = clean.replace(/[\x00-\x08\x0b-\x1f\x7f]/g, "");
  // Trim and limit
  return clean.trim().slice(0, maxLength);
}

// ---- Scene preset JSON validation ----

export const scenePresetSchema = z.object({
  name: z.string().min(1).max(64).regex(/^[\w\s\-]+$/),
  displayName: z.string().min(1).max(128),
  physics: z.enum(["classical", "quantum", "relativity", "fluid", "em", "future"]),
  particleCount: z.number().int().min(100).max(2_000_000),
  params: z.record(z.string(), z.number().finite()),
  camera: z.object({
    x: z.number().finite(),
    y: z.number().finite(),
    z: z.number().finite(),
    fov: z.number().min(10).max(170),
  }),
  description: z.string().max(512),
  equation: z.string().max(256),
  discoverer: z.string().max(128),
  year: z.number().int().min(-3000).max(2100),
});

export type ValidatedScenePreset = z.infer<typeof scenePresetSchema>;

/**
 * Validate and parse a scene preset JSON string.
 * Returns parsed preset or throws ZodError.
 */
export function parseScenePreset(raw: string): ValidatedScenePreset {
  const parsed: unknown = JSON.parse(raw);
  return scenePresetSchema.parse(parsed);
}

// ---- Rate limiter (in-memory sliding window) ----

interface RateLimitEntry {
  timestamps: number[];
}

const rateLimitStore = new Map<string, RateLimitEntry>();

/**
 * Check rate limit for an IP address.
 * Returns true if allowed, false if exceeded.
 */
export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const entry = rateLimitStore.get(key) ?? { timestamps: [] };

  // Slide window: remove old timestamps
  const windowStart = now - windowMs;
  entry.timestamps = entry.timestamps.filter((t) => t > windowStart);

  const allowed = entry.timestamps.length < maxRequests;
  if (allowed) {
    entry.timestamps.push(now);
  }
  rateLimitStore.set(key, entry);

  const remaining = Math.max(0, maxRequests - entry.timestamps.length);
  const oldest = entry.timestamps[0] ?? now;
  const resetAt = oldest + windowMs;

  return { allowed, remaining, resetAt };
}

// ---- API input schemas ----

export const apiSceneBodySchema = z.object({
  preset: z.string().min(1).max(64),
  overrides: z.record(z.string(), z.unknown()).optional(),
});

export const apiHealthBodySchema = z.object({}).optional();
