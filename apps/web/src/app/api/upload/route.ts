import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@eclat/auth";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { validateImageFile } from "@eclat/ui";

/**
 * Image upload — validates via packages/ui media helpers.
 * Saves to public/uploads/ in development.
 * Production: swap for Cloudflare R2 / Images + compression pipeline.
 */
export async function POST(req: NextRequest) {
  const admin = await requireAdminSession(req);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const validationError = validateImageFile({ type: file.type, size: file.size });
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const ext = file.name.split(".").pop() || "jpg";
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const uploadDir = path.join(process.cwd(), "public", "uploads");
    await mkdir(uploadDir, { recursive: true });
    await writeFile(path.join(uploadDir, filename), buffer);

    const url = `/uploads/${filename}`;
    return NextResponse.json({ url, filename });
  } catch (e: any) {
    console.error("Upload error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
