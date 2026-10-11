import { NextRequest, NextResponse } from "next/server";
import { getDashboardStats } from "@eclat/db";
import { requireAdminSession } from "@eclat/auth";

export async function GET(req: NextRequest) {
  try {
    const admin = await requireAdminSession(req);
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const stats = await getDashboardStats();
    return NextResponse.json(stats);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
