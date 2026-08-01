import { Hono } from "hono";
import { and, count, desc, eq, gte, inArray, lte } from "drizzle-orm";
import {
  stockMovement,
  item,
  warehouse,
  location,
  itemLot,
  staffProfile,
  type ForgeDb
} from "@forgeflow/db";
import {
  movementListParamsSchema,
  adjustmentRequestSchema,
  transferRequestSchema
} from "@forgeflow/contracts";
import { getDb } from "../db";
import { authRequired } from "../middleware/auth-required";
import { requireWriteRole } from "../middleware/rbac";
import { validate } from "../middleware/validate";
import type { AppEnv } from "../types";
import { notFound } from "../lib/http";
import { offsetFor, pageMeta } from "../lib/pagination";
import { applyAdjustment, applyTransferMovement } from "../services/movement-service";
import { withIdempotency } from "../lib/idempotency";

export const movementRoutes = new Hono<AppEnv>();

movementRoutes.use("*", authRequired);

movementRoutes.get("/movements", async (c) => {
  const db: ForgeDb = getDb(c.env);
  const q = c.req.query();
  const params = movementListParamsSchema.parse(q);

  const where = and(
    params.warehouseId ? eq(stockMovement.warehouseId, params.warehouseId) : undefined,
    params.itemId ? eq(stockMovement.itemId, params.itemId) : undefined,
    params.lotId ? eq(stockMovement.lotId, params.lotId) : undefined,
    params.movementType ? eq(stockMovement.movementType, params.movementType) : undefined,
    params.referenceType ? eq(stockMovement.referenceType, params.referenceType) : undefined,
    params.fromDate ? gte(stockMovement.occurredAt, params.fromDate) : undefined,
    params.toDate ? lte(stockMovement.occurredAt, params.toDate) : undefined
  );

  const base = db
    .select({
      movement: stockMovement,
      sku: item.sku,
      itemName: item.name,
      warehouseCode: warehouse.code,
      lotCode: itemLot.lotCode,
      fromLocationCode: location.code,
      performedByName: staffProfile.displayName
    })
    .from(stockMovement)
    .innerJoin(warehouse, eq(stockMovement.warehouseId, warehouse.id))
    .innerJoin(item, eq(stockMovement.itemId, item.id))
    .leftJoin(itemLot, eq(stockMovement.lotId, itemLot.id))
    .leftJoin(location, eq(stockMovement.fromLocationId, location.id))
    .leftJoin(staffProfile, eq(stockMovement.performedBy, staffProfile.id))
    .where(where);

  const rows = await base
    .orderBy(desc(stockMovement.occurredAt))
    .limit(params.pageSize)
    .offset(offsetFor(params));

  const toLocationIds = rows
    .map((r) => r.movement.toLocationId)
    .filter((id): id is string => Boolean(id));
  const toLocations =
    toLocationIds.length > 0
      ? await db
          .select()
          .from(location)
          .where(inArray(location.id, toLocationIds))
      : [];
  const toLocationMap = new Map(toLocations.map((l) => [l.id, l.code]));

  const totalRow = await db
    .select({ value: count() })
    .from(stockMovement)
    .where(where)
    .get();
  const total = totalRow?.value ?? 0;

  return c.json({
    items: rows.map((r) => ({
      id: r.movement.id,
      warehouseId: r.movement.warehouseId,
      warehouseCode: r.warehouseCode,
      itemId: r.movement.itemId,
      sku: r.sku,
      itemName: r.itemName,
      lotId: r.movement.lotId,
      lotCode: r.lotCode,
      fromLocationId: r.movement.fromLocationId,
      fromLocationCode: r.fromLocationCode,
      toLocationId: r.movement.toLocationId,
      toLocationCode: r.movement.toLocationId ? toLocationMap.get(r.movement.toLocationId) ?? null : null,
      qtyDelta: r.movement.qtyDelta,
      movementType: r.movement.movementType,
      referenceType: r.movement.referenceType,
      referenceId: r.movement.referenceId,
      performedBy: r.movement.performedBy,
      performedByName: r.performedByName ?? null,
      occurredAt: r.movement.occurredAt
    })),
    meta: pageMeta(params.page, params.pageSize, total)
  });
});

movementRoutes.get("/movements/:id", async (c) => {
  const db: ForgeDb = getDb(c.env);
  const row = await db
    .select()
    .from(stockMovement)
    .where(eq(stockMovement.id, c.req.param("id")))
    .get();
  if (!row) notFound("Movement not found");
  return c.json(row);
});

movementRoutes.post(
  "/movements/adjustments",
  requireWriteRole("manager", "admin"),
  validate(adjustmentRequestSchema),
  async (c) => {
    const db: ForgeDb = getDb(c.env);
    const input = c.req.valid("json");
    const staffId = c.get("staffId");
    const idempotencyHeader = c.req.header("Idempotency-Key");

    const loc = await db
      .select()
      .from(location)
      .where(eq(location.id, input.locationId))
      .get();
    if (!loc) notFound("Source location not found");

    const result = await withIdempotency(
      db,
      idempotencyHeader,
      "create_adjustment",
      JSON.stringify(input),
      async () => {
        const movementId = await applyAdjustment({
          db,
          warehouseId: loc.warehouseId,
          itemId: input.itemId,
          lotId: input.lotId ?? null,
          locationId: input.locationId,
          newQty: input.newQty,
          movementType: "adjust",
          referenceType: "adjustment",
          referenceId: null,
          performedBy: staffId,
          occurredAt: Date.now()
        });
        return { movementId };
      }
    );
    return c.json(result, 201);
  }
);

movementRoutes.post(
  "/movements/transfers",
  requireWriteRole("operator", "manager", "admin"),
  validate(transferRequestSchema),
  async (c) => {
    const db: ForgeDb = getDb(c.env);
    const input = c.req.valid("json");
    const staffId = c.get("staffId");
    const idempotencyHeader = c.req.header("Idempotency-Key");

    // Determine the warehouse from the source location.
    const loc = await db
      .select()
      .from(location)
      .where(eq(location.id, input.fromLocationId))
      .get();
    if (!loc) notFound("Source location not found");

    const result = await withIdempotency(
      db,
      idempotencyHeader,
      "create_transfer",
      JSON.stringify(input),
      async () => {
        const movementId = await applyTransferMovement({
          db,
          warehouseId: loc.warehouseId,
          itemId: input.itemId,
          lotId: input.lotId ?? null,
          fromLocationId: input.fromLocationId,
          toLocationId: input.toLocationId,
          qtyDelta: input.qty,
          movementType: "transfer",
          referenceType: "transfer",
          performedBy: staffId,
          occurredAt: Date.now()
        });
        return { movementId };
      }
    );
    return c.json(result, 201);
  }
);
