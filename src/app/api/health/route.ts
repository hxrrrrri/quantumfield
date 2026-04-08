/**
 * @fileoverview Health check endpoint.
 * Returns app status, uptime, and version info.
 */
import { type NextRequest, NextResponse } from "next/server";

const startTime = Date.now();

export async function GET(_req: NextRequest): Promise<NextResponse> {
  return NextResponse.json({
    status: "ok",
    uptime: (Date.now() - startTime) / 1000,
    version: process.env["npm_package_version"] ?? "1.0.0",
    timestamp: new Date().toISOString(),
    env: process.env["NODE_ENV"],
  });
}
