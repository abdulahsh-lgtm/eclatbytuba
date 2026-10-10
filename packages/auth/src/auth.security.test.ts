/**
 * Auth production safety tests
 */
import {
  authenticateAdmin,
  createSessionToken,
  verifySessionToken,
  requireAdminSession,
  isAdminRole,
  SESSION_COOKIE,
} from "./index";

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    console.log(`PASS - ${name}`);
    passed++;
  } catch (e) {
    console.error(`FAIL - ${name}`, e);
    failed++;
  }
}

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

async function main() {
  const isProd = process.env.NODE_ENV === "production";

  await test("isAdminRole accepts ADMIN and SUPER_ADMIN only", () => {
    assert(isAdminRole("ADMIN"), "ADMIN");
    assert(isAdminRole("SUPER_ADMIN"), "SUPER_ADMIN");
    assert(!isAdminRole("CUSTOMER"), "CUSTOMER");
    assert(!isAdminRole(undefined), "undefined");
  });

  if (isProd) {
    await test("production rejects missing admin env credentials", async () => {
      const prevEmail = process.env.ADMIN_EMAIL;
      const prevPass = process.env.ADMIN_PASSWORD;
      delete process.env.ADMIN_EMAIL;
      delete process.env.ADMIN_PASSWORD;
      const user = await authenticateAdmin("admin@eclatbytuba.com", "eclat2026");
      assert(user === null, "should reject default creds without env");
      if (prevEmail !== undefined) process.env.ADMIN_EMAIL = prevEmail;
      if (prevPass !== undefined) process.env.ADMIN_PASSWORD = prevPass;
    });

    await test("production createSessionToken requires secret", async () => {
      const prevN = process.env.NEXTAUTH_SECRET;
      const prevA = process.env.AUTH_SECRET;
      delete process.env.NEXTAUTH_SECRET;
      delete process.env.AUTH_SECRET;
      let threw = false;
      try {
        await createSessionToken({
          id: "1",
          email: "a@b.c",
          name: "A",
          role: "ADMIN",
        });
      } catch {
        threw = true;
      }
      assert(threw, "expected throw without secret");
      if (prevN !== undefined) process.env.NEXTAUTH_SECRET = prevN;
      if (prevA !== undefined) process.env.AUTH_SECRET = prevA;
    });
  } else {
    await test("development allows demo admin credentials", async () => {
      delete process.env.ADMIN_EMAIL;
      delete process.env.ADMIN_PASSWORD;
      const user = await authenticateAdmin("admin@eclatbytuba.com", "eclat2026");
      assert(user?.role === "SUPER_ADMIN", "demo admin");
    });

    await test("session token round-trip", async () => {
      process.env.AUTH_SECRET = process.env.AUTH_SECRET || "test-secret-for-unit";
      const token = await createSessionToken({
        id: "admin-1",
        email: "admin@test.com",
        name: "Admin",
        role: "SUPER_ADMIN",
      });
      const user = await verifySessionToken(token);
      assert(user?.email === "admin@test.com", "email");
      assert(user?.role === "SUPER_ADMIN", "role");
    });

    await test("requireAdminSession rejects missing cookie", async () => {
      process.env.AUTH_SECRET = process.env.AUTH_SECRET || "test-secret-for-unit";
      const user = await requireAdminSession({
        cookies: { get: () => undefined },
        headers: { get: () => null },
      });
      assert(user === null, "no cookie");
    });

    await test("requireAdminSession accepts admin cookie", async () => {
      process.env.AUTH_SECRET = process.env.AUTH_SECRET || "test-secret-for-unit";
      const token = await createSessionToken({
        id: "admin-1",
        email: "admin@test.com",
        name: "Admin",
        role: "ADMIN",
      });
      const user = await requireAdminSession({
        cookies: {
          get: (name: string) =>
            name === SESSION_COOKIE ? { value: token } : undefined,
        },
      });
      assert(user?.role === "ADMIN", "admin ok");
    });

    await test("requireAdminSession rejects customer role", async () => {
      process.env.AUTH_SECRET = process.env.AUTH_SECRET || "test-secret-for-unit";
      const token = await createSessionToken({
        id: "c1",
        email: "c@test.com",
        name: "Customer",
        role: "CUSTOMER",
      });
      const user = await requireAdminSession({
        cookies: {
          get: (name: string) =>
            name === SESSION_COOKIE ? { value: token } : undefined,
        },
      });
      assert(user === null, "customer rejected");
    });
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
