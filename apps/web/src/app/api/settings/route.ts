import { NextRequest, NextResponse } from "next/server";
import {
  getPublicSettings,
  getAdminSettings,
  updateSettings,
  type StoreSettings,
} from "@eclat/db";
import { requireAdminSession } from "@eclat/auth";

/**
 * GET → public settings (no secrets)
 * GET ?admin=1 → full settings (admin session required)
 * PUT → update settings (admin session required)
 */
export async function GET(request: NextRequest) {
  const adminFlag = request.nextUrl.searchParams.get("admin") === "1";
  if (adminFlag) {
    const admin = await requireAdminSession(request);
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(getAdminSettings());
  }
  return NextResponse.json(getPublicSettings());
}

export async function PUT(request: NextRequest) {
  try {
    const admin = await requireAdminSession(request);
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = (await request.json()) as Partial<StoreSettings>;
    const updated = updateSettings(body);
    return NextResponse.json(updated);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Failed to update settings";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
