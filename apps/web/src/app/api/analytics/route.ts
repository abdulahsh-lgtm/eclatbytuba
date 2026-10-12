import { NextRequest, NextResponse } from "next/server";
import { recordHit, summarizeAnalytics, getOrders } from "@eclat/db";
import { requireAdminSession } from "@eclat/auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.sessionId || !body.type) {
      return NextResponse.json(
        { error: "sessionId and type required" },
        { status: 400 }
      );
    }

    const hit = recordHit({
      type: body.type,
      sessionId: String(body.sessionId),
      path: body.path,
      userId: body.userId,
      durationMs: body.durationMs != null ? Number(body.durationMs) : undefined,
      engaged: body.engaged,
      props: body.props,
      source: body.source,
      medium: body.medium,
      campaign: body.campaign,
      device: body.device,
      country: body.country,
      ts: body.ts,
    });

    return NextResponse.json({ ok: true, id: hit.id });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const admin = await requireAdminSession(req);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const days = Number(new URL(req.url).searchParams.get("days") || 30);
    const orders = await getOrders();
    const summary = summarizeAnalytics(orders as any[], days);
    return NextResponse.json(summary);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
