import { describe, it, expect } from "vitest";

// Integration tests run against the actual Next.js server
// In CI: `bun run build && bun run start` first, then run these tests.
// We mock the route handlers here for unit-style integration tests.

import { GET as healthGET } from "@/app/api/health/route";
import { GET as sceneGET, POST as scenePOST } from "@/app/api/scene/route";
import { NextRequest } from "next/server";

describe("GET /api/health", () => {
  it("returns 200 with status ok", async () => {
    const req = new NextRequest("http://localhost:3000/api/health");
    const res = await healthGET(req);
    expect(res.status).toBe(200);
    const body = await res.json() as { status: string; uptime: number };
    expect(body.status).toBe("ok");
    expect(typeof body.uptime).toBe("number");
  });
});

describe("GET /api/scene", () => {
  it("returns 400 for missing preset param", async () => {
    const req = new NextRequest("http://localhost:3000/api/scene");
    const res = await sceneGET(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid preset name with special chars", async () => {
    const req = new NextRequest("http://localhost:3000/api/scene?preset=../../etc/passwd");
    const res = await sceneGET(req);
    expect(res.status).toBe(400);
  });
});

describe("POST /api/scene", () => {
  it("returns 400 for invalid JSON", async () => {
    const req = new NextRequest("http://localhost:3000/api/scene", {
      method: "POST",
      body: "not json",
      headers: { "content-type": "application/json" },
    });
    const res = await scenePOST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 for schema violation", async () => {
    const req = new NextRequest("http://localhost:3000/api/scene", {
      method: "POST",
      body: JSON.stringify({ name: "test", particleCount: -1 }),
      headers: { "content-type": "application/json" },
    });
    const res = await scenePOST(req);
    expect(res.status).toBe(400);
  });

  it("returns 200 for valid scene data", async () => {
    const validScene = {
      name: "test-scene",
      displayName: "Test Scene",
      physics: "classical",
      particleCount: 1000,
      params: { G: 1.0 },
      camera: { x: 0, y: 0, z: 100, fov: 60 },
      description: "A test scene",
      equation: "F = ma",
      discoverer: "Newton",
      year: 1687,
    };
    const req = new NextRequest("http://localhost:3000/api/scene", {
      method: "POST",
      body: JSON.stringify(validScene),
      headers: { "content-type": "application/json" },
    });
    const res = await scenePOST(req);
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean };
    expect(body.success).toBe(true);
  });
});
