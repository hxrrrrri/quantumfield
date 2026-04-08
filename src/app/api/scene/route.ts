/**
 * @fileoverview Scene preset API endpoint.
 * Validates and returns scene configuration for a given preset name.
 */
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { checkRateLimit, parseScenePreset } from "@/lib/security";
import { readFile } from "fs/promises";
import { join } from "path";

const requestSchema = z.object({
  preset: z.string().min(1).max(64).regex(/^[\w-]+$/),
});

export async function GET(req: NextRequest): Promise<NextResponse> {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

  const rateCheck = checkRateLimit(`scene:${ip}`, 100, 60_000);
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { success: false, error: "Rate limit exceeded" },
      {
        status: 429,
        headers: {
          "Retry-After": String(
            Math.ceil((rateCheck.resetAt - Date.now()) / 1000)
          ),
        },
      }
    );
  }

  const { searchParams } = new URL(req.url);
  const parseResult = requestSchema.safeParse({
    preset: searchParams.get("preset"),
  });

  if (!parseResult.success) {
    return NextResponse.json(
      {
        success: false,
        error: "Invalid preset name",
        details: parseResult.error.flatten(),
      },
      { status: 400 }
    );
  }

  const { preset } = parseResult.data;

  try {
    const filePath = join(process.cwd(), "public", "presets", `${preset}.json`);
    const raw = await readFile(filePath, "utf-8");
    const validated = parseScenePreset(raw);
    return NextResponse.json({ success: true, data: validated });
  } catch {
    return NextResponse.json(
      { success: false, error: "Preset not found" },
      { status: 404 }
    );
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

  const rateCheck = checkRateLimit(`scene-post:${ip}`, 20, 60_000);
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { success: false, error: "Rate limit exceeded" },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  try {
    const validated = parseScenePreset(JSON.stringify(body));
    return NextResponse.json({ success: true, data: validated });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: "Invalid scene data", details: String(err) },
      { status: 400 }
    );
  }
}
