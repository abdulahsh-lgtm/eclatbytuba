import { NextRequest, NextResponse } from "next/server";
import {
  authenticateAdmin,
  createSessionToken,
  SESSION_COOKIE,
} from "@eclat/auth";
import { rateLimit, RATE_LIMITS, clientKey } from "@eclat/config";

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  const limit = rateLimit({
    key: clientKey("admin-login", ip),
    limit: RATE_LIMITS.login.limit,
    windowMs: RATE_LIMITS.login.windowMs,
  });
  if (!limit.success) {
    return NextResponse.json(
      { error: "Too many login attempts. Please try again later." },
      {
        status: 429,
        headers: limit.retryAfterMs
          ? { "Retry-After": String(Math.ceil(limit.retryAfterMs / 1000)) }
          : undefined,
      }
    );
  }

  try {
    const body: unknown = await req.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid login request" }, { status: 400 });
    }
    const input = body as Record<string, unknown>;
    if (
      typeof input.email !== "string" ||
      !input.email.trim() ||
      typeof input.password !== "string" ||
      !input.password
    ) {
      return NextResponse.json(
        { error: "Email and password required" },
        { status: 400 }
      );
    }

    const user = await authenticateAdmin(input.email.trim(), input.password);
    if (!user) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const token = await createSessionToken(user);
    const res = NextResponse.json({ user: { email: user.email, name: user.name } });
    res.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
    return res;
  } catch (e: unknown) {
    console.error("Admin login failed:", e);
    return NextResponse.json({ error: "Unable to sign in" }, { status: 500 });
  }
}
