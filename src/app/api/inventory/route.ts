// GET  /api/inventory  — list products with stock levels
// POST /api/inventory  — add product or adjust stock
// Includes perk redemption logic

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { audit, AUDIT_ACTIONS } from "@/lib/audit";
import { apiError, apiSuccess } from "@/lib/utils";

export async function GET(_request: NextRequest) {
  const products = await prisma.product.findMany({
    where: { isActive: true },
    include: {
      _count: { select: { transactions: true } },
    },
    orderBy: { name: "asc" },
  });

  return apiSuccess(
    products.map((p) => ({
      ...p,
      price: Number(p.price),
      isLowStock: p.stockQuantity <= p.lowStockThreshold,
    }))
  );
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return apiError("Unauthorised", 401);

  const actor = await prisma.profile.findUnique({ where: { id: user.id } });
  if (!["founder", "staff"].includes(actor?.role ?? "")) {
    return apiError("Forbidden", 403);
  }

  const body = await request.json();
  const { action } = body;

  // ── Create a new product ──────────────────────────────────────────────────
  if (action === "create") {
    const { name, description, price, stockQuantity, lowStockThreshold, category } = body;
    if (!name || price === undefined) return apiError("name and price are required");

    const product = await prisma.product.create({
      data: {
        name,
        description: description ?? null,
        price: Number(price),
        stockQuantity: Number(stockQuantity ?? 0),
        lowStockThreshold: Number(lowStockThreshold ?? 5),
        category: category ?? null,
      },
    });
    return apiSuccess(product, 201);
  }

  // ── Restock ───────────────────────────────────────────────────────────────
  if (action === "restock") {
    const { productId, quantity, notes } = body;
    if (!productId || !quantity) return apiError("productId and quantity required");

    const old = await prisma.product.findUnique({ where: { id: productId } });
    if (!old) return apiError("Product not found", 404);

    const updated = await prisma.product.update({
      where: { id: productId },
      data: { stockQuantity: { increment: Number(quantity) } },
    });

    await prisma.productTransaction.create({
      data: {
        clientId: user.id, // Using actor as placeholder — restock doesn't have a client
        productId,
        type: "adjusted",
        quantity: Number(quantity),
        unitPrice: Number(old.price),
        totalAmount: 0,
        notes: notes ?? `Restocked: +${quantity} units`,
        processedById: user.id,
      },
    });

    await audit({
      actorId: user.id,
      action: AUDIT_ACTIONS.INVENTORY_ADJUSTED,
      entityType: "product",
      entityId: productId,
      oldValue: { stockQuantity: old.stockQuantity },
      newValue: { stockQuantity: updated.stockQuantity, change: quantity },
    });

    return apiSuccess({ stockQuantity: updated.stockQuantity });
  }

  // ── Sell to client (cash purchase) ───────────────────────────────────────
  if (action === "sell") {
    const { productId, clientId, quantity = 1 } = body;
    if (!productId || !clientId) return apiError("productId and clientId required");

    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) return apiError("Product not found", 404);
    if (product.stockQuantity < quantity) {
      return apiError(`Only ${product.stockQuantity} unit(s) in stock`);
    }

    const total = Number(product.price) * Number(quantity);

    await prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id: productId },
        data: { stockQuantity: { decrement: Number(quantity) } },
      });

      await tx.productTransaction.create({
        data: {
          clientId,
          productId,
          type: "purchased",
          quantity: Number(quantity),
          unitPrice: product.price,
          totalAmount: total,
          processedById: user.id,
        },
      });
    });

    await audit({
      actorId: user.id,
      action: AUDIT_ACTIONS.PRODUCT_PURCHASED,
      entityType: "product",
      entityId: productId,
      newValue: { clientId, quantity, total },
    });

    return apiSuccess({ sold: true, total });
  }

  // ── Redeem as perk (complimentary from package) ───────────────────────────
  if (action === "redeem") {
    const { productId, clientId, clientPackageId } = body;
    if (!productId || !clientId || !clientPackageId) {
      return apiError("productId, clientId, and clientPackageId required");
    }

    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) return apiError("Product not found", 404);
    if (product.stockQuantity < 1) return apiError("Product out of stock");

    const cp = await prisma.clientPackage.findUnique({ where: { id: clientPackageId } });
    if (!cp) return apiError("Package not found", 404);
    if (cp.drinksRemaining <= 0) {
      return apiError("No complimentary drinks remaining in this package this month");
    }

    await prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id: productId },
        data: { stockQuantity: { decrement: 1 } },
      });

      await tx.clientPackage.update({
        where: { id: clientPackageId },
        data: { drinksRemaining: { decrement: 1 } },
      });

      await tx.productTransaction.create({
        data: {
          clientId,
          productId,
          clientPackageId,
          type: "complimentary",
          quantity: 1,
          unitPrice: product.price,
          totalAmount: 0, // Free!
          processedById: user.id,
        },
      });
    });

    await audit({
      actorId: user.id,
      action: AUDIT_ACTIONS.PRODUCT_REDEEMED,
      entityType: "product",
      entityId: productId,
      newValue: { clientId, clientPackageId, complimentary: true },
    });

    return apiSuccess({ redeemed: true, drinksRemaining: cp.drinksRemaining - 1 });
  }

  return apiError("Invalid action. Use: create | restock | sell | redeem");
}

// ── PATCH /api/inventory  — edit product details ──────────────────────────────
export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return apiError("Unauthorised", 401);

  const actor = await prisma.profile.findUnique({ where: { id: user.id } });
  if (actor?.role !== "founder") return apiError("Only founders can edit products", 403);

  const body = await request.json();
  const { id, name, description, price, stockQuantity, lowStockThreshold, category, isActive } = body;
  if (!id) return apiError("Product id required");

  const old = await prisma.product.findUnique({ where: { id } });
  if (!old) return apiError("Product not found", 404);

  const updated = await prisma.product.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(description !== undefined && { description }),
      ...(price !== undefined && { price: Number(price) }),
      ...(stockQuantity !== undefined && { stockQuantity: Number(stockQuantity) }),
      ...(lowStockThreshold !== undefined && { lowStockThreshold: Number(lowStockThreshold) }),
      ...(category !== undefined && { category }),
      ...(isActive !== undefined && { isActive }),
    },
  });

  await audit({
    actorId: user.id,
    action: AUDIT_ACTIONS.INVENTORY_ADJUSTED,
    entityType: "product",
    entityId: id,
    oldValue: { name: old.name, price: Number(old.price), category: old.category },
    newValue: { name: updated.name, price: Number(updated.price), category: updated.category },
  });

  return apiSuccess({ ...updated, price: Number(updated.price) });
}

// ── DELETE /api/inventory?id=xxx  — soft-delete a product ────────────────────
export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return apiError("Unauthorised", 401);

  const actor = await prisma.profile.findUnique({ where: { id: user.id } });
  if (actor?.role !== "founder") return apiError("Only founders can delete products", 403);

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return apiError("Product id required");

  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) return apiError("Product not found", 404);

  await prisma.product.update({ where: { id }, data: { isActive: false } });

  await audit({
    actorId: user.id,
    action: AUDIT_ACTIONS.INVENTORY_ADJUSTED,
    entityType: "product",
    entityId: id,
    oldValue: { isActive: true },
    newValue: { isActive: false, deleted: true },
  });

  return apiSuccess({ deleted: true });
}
