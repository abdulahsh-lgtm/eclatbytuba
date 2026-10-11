import { NextRequest, NextResponse } from "next/server";
import { getProducts, createProduct, updateProduct } from "@eclat/db";
import { requireAdminSession } from "@eclat/auth";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category") || undefined;
    const featured = searchParams.get("featured") === "true";
    const admin = searchParams.get("admin") === "true";

    if (admin) {
      const session = await requireAdminSession(req);
      if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const products = await getProducts({
      categorySlug: category,
      featured: featured || undefined,
      activeOnly: admin ? false : true,
    });

    return NextResponse.json({ products });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAdminSession(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = await req.json();
    const product = await createProduct({
      name: body.name,
      slug: body.slug,
      description: body.description,
      price: Number(body.price),
      compareAtPrice: body.compareAtPrice ? Number(body.compareAtPrice) : null,
      inventory: body.inventory ? Number(body.inventory) : 0,
      categoryId: body.categoryId,
      isActive: body.isActive ?? true,
      isFeatured: body.isFeatured ?? false,
      tags: body.tags,
      images: body.images,
    });
    return NextResponse.json({ product }, { status: 201 });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await requireAdminSession(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = await req.json();
    if (!body.id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }
    const product = await updateProduct(body.id, {
      name: body.name,
      slug: body.slug,
      description: body.description,
      price: body.price !== undefined ? Number(body.price) : undefined,
      compareAtPrice:
        body.compareAtPrice === null || body.compareAtPrice === ""
          ? null
          : body.compareAtPrice !== undefined
            ? Number(body.compareAtPrice)
            : undefined,
      inventory: body.inventory !== undefined ? Number(body.inventory) : undefined,
      categoryId: body.categoryId,
      isActive: body.isActive,
      isFeatured: body.isFeatured,
      tags: body.tags,
      images: body.images,
    });
    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }
    return NextResponse.json({ product });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
