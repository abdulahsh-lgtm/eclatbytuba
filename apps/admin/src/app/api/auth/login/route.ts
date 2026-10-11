import { NextRequest, NextResponse } from "next/server";
import {
  authenticateAdmin,
  createSessionToken,
  SESSION_COOKIE,
} from "@eclat/auth";
import { rateLimit, RATE_LIMITS, clientKey } from "@eclat/config";

export async function POST(req: NextRequest) {
  try {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";
    const rl = rateLimit({
      key: clientKey("login", ip),
      limit: RATE_LIMITS.login.limit,
      windowMs: RATE_LIMITS.login.windowMs,
    });
    if (!rl.success) {
      return NextResponse.json(
        { error: "Too many login attempts. Try again later." },
        {
          status: 429,
          headers: rl.retryAfterMs
            ? { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) }
            : undefined,
        }
      );
    }

    const { email, password } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ error: "Email and password required" }, { status: 400 });
    }

    const user = await authenticateAdmin(email, password);
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
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
