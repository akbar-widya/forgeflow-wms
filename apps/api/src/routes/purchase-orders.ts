import { Hono } from "hono";
import { and, asc, count, desc, eq, like, or } from "drizzle-orm";
import {
  purchaseOrder,
  purchaseOrderLine,
  item,
  warehouse,
  type ForgeDb
} from "@forgeflow/db";
import {
  createPoRequestSchema,
  updatePoRequestSchema,
  poListParamsSchema,
  type PurchaseOrder
} from "@forgeflow/contracts";
import { getDb } from "../db";
import { authRequired } from "../middleware/auth-required";
import { requireWriteRole } from "../middleware/rbac";
import { validate } from "../middleware/validate";
import type { AppEnv } from "../types";
import { badRequest, notFound } from "../lib/http";
import { offsetFor, pageMeta } from "../lib/pagination";

export const purchaseOrderRoutes = new Hono<AppEnv>();

purchaseOrderRoutes.use("*", authRequired);

async function buildPoDto(db: ForgeDb, poId: string): Promise<PurchaseOrder> {
  const po = await db
    .select()
    .from(purchaseOrder)
    .where(eq(purchaseOrder.id, poId))
    .get();
  if (!po) notFound("Purchase order not found");

  const wh = await db
    .select()
    .from(warehouse)
    .where(eq(warehouse.id, po.warehouseId))
    .get();

  const lines = await db
    .select({
      line: purchaseOrderLine,
      sku: item.sku,
      itemName: item.name
    })
    .from(purchaseOrderLine)
    .innerJoin(item, eq(purchaseOrderLine.itemId, item.id))
    .where(eq(purchaseOrderLine.purchaseOrderId, poId));

  return {
    id: po.id,
    warehouseId: po.warehouseId,
    warehouseCode: wh?.code ?? "",
    poNumber: po.poNumber,
    supplierName: po.supplierName,
    status: po.status,
    expectedDate: po.expectedDate,
    createdAt: po.createdAt,
    lines: lines.map((l) => ({
      id: l.line.id,
      purchaseOrderId: l.line.purchaseOrderId,
      itemId: l.line.itemId,
      sku: l.sku,
      itemName: l.itemName,
      orderedQty: l.line.orderedQty,
      receivedQty: l.line.receivedQty,
      status: l.line.status
    }))
  };
}

purchaseOrderRoutes.get("/purchase-orders", async (c) => {
  const db: ForgeDb = getDb(c.env);
  const q = c.req.query();
  const params = poListParamsSchema.parse(q);

  const where = and(
    params.status ? eq(purchaseOrder.status, params.status) : undefined,
    params.warehouseId ? eq(purchaseOrder.warehouseId, params.warehouseId) : undefined,
    params.search
      ? or(
          like(purchaseOrder.poNumber, `%${params.search}%`),
          like(purchaseOrder.supplierName, `%${params.search}%`)
        )
      : undefined
  );

  const rows = await db
    .select()
    .from(purchaseOrder)
    .where(where)
    .orderBy(
      params.direction === "desc"
        ? desc(purchaseOrder.createdAt)
        : asc(purchaseOrder.createdAt)
    )
    .limit(params.pageSize)
    .offset(offsetFor(params));

  const totalRow = await db
    .select({ value: count() })
    .from(purchaseOrder)
    .where(where)
    .get();
  const total = totalRow?.value ?? 0;

  const items = [];
  for (const po of rows) {
    items.push(await buildPoDto(db, po.id));
  }

  return c.json({ items, meta: pageMeta(params.page, params.pageSize, total) });
});

purchaseOrderRoutes.post(
  "/purchase-orders",
  requireWriteRole("manager", "admin"),
  validate(createPoRequestSchema),
  async (c) => {
    const db: ForgeDb = getDb(c.env);
    const input = c.req.valid("json");
    const now = Date.now();
    const poId = crypto.randomUUID();
    const poNumber = `PO-${now.toString(36).toUpperCase()}`;

    const wh = await db
      .select()
      .from(warehouse)
      .where(eq(warehouse.id, input.warehouseId))
      .get();
    if (!wh) badRequest("Warehouse not found", { field: "warehouseId" });

    await db.batch([
      db.insert(purchaseOrder).values({
        id: poId,
        warehouseId: input.warehouseId,
        poNumber,
        supplierName: input.supplierName,
        status: "open",
        expectedDate: input.expectedDate ?? null,
        createdAt: now
      }),
      ...input.lines.map((l) =>
        db.insert(purchaseOrderLine).values({
          id: crypto.randomUUID(),
          purchaseOrderId: poId,
          itemId: l.itemId,
          orderedQty: l.orderedQty,
          receivedQty: 0,
          status: "pending"
        })
      )
    ]);

    return c.json(await buildPoDto(db, poId), 201);
  }
);

purchaseOrderRoutes.get("/purchase-orders/:id", async (c) => {
  const db: ForgeDb = getDb(c.env);
  return c.json(await buildPoDto(db, c.req.param("id")));
});

purchaseOrderRoutes.patch(
  "/purchase-orders/:id",
  requireWriteRole("manager", "admin"),
  validate(updatePoRequestSchema),
  async (c) => {
    const db: ForgeDb = getDb(c.env);
    const id = c.req.param("id");
    const input = c.req.valid("json");
    const po = await db.select().from(purchaseOrder).where(eq(purchaseOrder.id, id)).get();
    if (!po) notFound("Purchase order not found");

    await db
      .update(purchaseOrder)
      .set({
        status: input.status ?? po.status,
        supplierName: input.supplierName ?? po.supplierName,
        expectedDate:
          input.expectedDate !== undefined ? input.expectedDate : po.expectedDate
      })
      .where(eq(purchaseOrder.id, id));

    return c.json(await buildPoDto(db, id));
  }
);
