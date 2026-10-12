import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@eclat/auth";
import {
  getPublicSettingsPersistent,
  getAdminSettingsPersistent,
  updateSettingsPersistent,
} from "@eclat/db";

/**
 * GET ?admin=1 returns secrets only to an authenticated admin.
 * Public GET returns a sanitized view.
 * PUT validates the payload and persists settings in PostgreSQL when configured.
 */
export async function GET(request: NextRequest) {
  const admin = request.nextUrl.searchParams.get("admin") === "1";
  if (admin) {
    const session = await requireAdminSession(request);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const settings = admin
      ? await getAdminSettingsPersistent()
      : await getPublicSettingsPersistent();
    return NextResponse.json(settings);
  } catch (e: unknown) {
    console.error("Settings load failed:", e);
    return NextResponse.json(
      { error: "Settings storage is unavailable" },
      { status: 503 }
    );
  }
}

export async function PUT(request: NextRequest) {
  const session = await requireAdminSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body: unknown = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid settings request" }, { status: 400 });
    }
    const updated = await updateSettingsPersistent(body);
    return NextResponse.json(updated);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "";
    if (
      message.includes("settings") ||
      message.includes("Unknown ") ||
      message.includes("must be a ") ||
      message.includes("is too long") ||
      message.includes("cannot be enabled")
    ) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    console.error("Settings save failed:", e);
    return NextResponse.json(
      { error: "Settings storage is unavailable" },
      { status: 503 }
    );
  }
}
