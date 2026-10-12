import { SignJWT, jwtVerify } from "jose";

function resolveAuthSecret(): string {
  const secret =
    process.env.NEXTAUTH_SECRET?.trim() || process.env.AUTH_SECRET?.trim();
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "NEXTAUTH_SECRET or AUTH_SECRET must be set in production"
    );
  }
  return "eclat-dev-secret-change-me";
}

const SECRET = () => new TextEncoder().encode(resolveAuthSecret());

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: "ADMIN" | "SUPER_ADMIN" | "CUSTOMER";
};

export async function createSessionToken(user: SessionUser): Promise<string> {
  return new SignJWT({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(SECRET());
}

export async function verifySessionToken(
  token: string
): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET());
    return {
      id: payload.id as string,
      email: payload.email as string,
      name: payload.name as string,
      role: payload.role as SessionUser["role"],
    };
  } catch {
    return null;
  }
}

/** Read session user from a Cookie header value or raw cookie string map. */
export async function getSessionUserFromCookieHeader(
  cookieHeader: string | null | undefined
): Promise<SessionUser | null> {
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(";").map((p) => p.trim());
  const match = parts.find((p) => p.startsWith(`${SESSION_COOKIE}=`));
  if (!match) return null;
  const token = match.slice(SESSION_COOKIE.length + 1);
  if (!token) return null;
  return verifySessionToken(token);
}

export function isAdminRole(role: string | undefined | null): boolean {
  return role === "ADMIN" || role === "SUPER_ADMIN";
}

/**
 * Resolve admin session from a request-like object with cookies.get or headers.
 * Returns null when unauthenticated or not an admin.
 */
export async function requireAdminSession(input: {
  cookies?: { get: (name: string) => { value: string } | undefined };
  headers?: { get: (name: string) => string | null };
}): Promise<SessionUser | null> {
  let token: string | undefined;
  if (input.cookies?.get) {
    token = input.cookies.get(SESSION_COOKIE)?.value;
  }
  if (!token && input.headers?.get) {
    const user = await getSessionUserFromCookieHeader(
      input.headers.get("cookie")
    );
    if (user && isAdminRole(user.role)) return user;
    return null;
  }
  if (!token) return null;
  const user = await verifySessionToken(token);
  if (!user || !isAdminRole(user.role)) return null;
  return user;
}

/** Demo credentials for local development only. Production requires env vars. */
export async function authenticateAdmin(
  email: string,
  password: string
): Promise<SessionUser | null> {
  const adminEmail = process.env.ADMIN_EMAIL?.trim();
  const adminPassword = process.env.ADMIN_PASSWORD?.trim();

  if (process.env.NODE_ENV === "production") {
    if (!adminEmail || !adminPassword) {
      console.error("ADMIN_EMAIL and ADMIN_PASSWORD must be set in production");
      return null;
    }
  }

  const expectedEmail = adminEmail || "admin@eclatbytuba.com";
  const expectedPassword = adminPassword || "eclat2026";

  if (email === expectedEmail && password === expectedPassword) {
    return {
      id: "admin-1",
      email: expectedEmail,
      name: "Admin",
      role: "SUPER_ADMIN",
    };
  }
  return null;
}

export const SESSION_COOKIE = "eclat_session";
