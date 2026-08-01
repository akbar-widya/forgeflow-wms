import { Hono } from "hono";
import { asc, and, count, desc, eq, like, or } from "drizzle-orm";
import {
  warehouse,
  zone,
  location,
  type ForgeDb
} from "@forgeflow/db";
import {
  createWarehouseRequestSchema,
  warehouseListParamsSchema,
  createLocationRequestSchema
} from "@forgeflow/contracts";
import { getDb } from "../db";
import { authRequired } from "../middleware/auth-required";
import { requireWriteRole } from "../middleware/rbac";
import { validate } from "../middleware/validate";
import type { AppEnv } from "../types";
import { badRequest, notFound } from "../lib/http";
import { offsetFor, pageMeta } from "../lib/pagination";

export const warehouseRoutes = new Hono<AppEnv>();

warehouseRoutes.use("*", authRequired);

warehouseRoutes.get("/warehouses", async (c) => {
  const db: ForgeDb = getDb(c.env);
  const q = c.req.query();
  const params = warehouseListParamsSchema.parse(q);

  const where = and(
    params.status ? eq(warehouse.status, params.status) : undefined,
    params.search
      ? or(
          like(warehouse.code, `%${params.search}%`),
          like(warehouse.name, `%${params.search}%`)
        )
      : undefined
  );

  const rows = await db
    .select()
    .from(warehouse)
    .where(where)
    .orderBy(params.direction === "desc" ? desc(warehouse.code) : asc(warehouse.code))
    .limit(params.pageSize)
    .offset(offsetFor(params));

  const totalRow = await db
    .select({ value: count() })
    .from(warehouse)
    .where(where)
    .get();
  const total = totalRow?.value ?? 0;

  return c.json({
    items: rows,
    meta: pageMeta(params.page, params.pageSize, total)
  });
});

warehouseRoutes.post(
  "/warehouses",
  requireWriteRole("admin"),
  validate(createWarehouseRequestSchema),
  async (c) => {
    const db: ForgeDb = getDb(c.env);
    const input = c.req.valid("json");
    const now = Date.now();
    const id = crypto.randomUUID();

    const dup = await db
      .select({ id: warehouse.id })
      .from(warehouse)
      .where(eq(warehouse.code, input.code))
      .get();
    if (dup) badRequest("Warehouse code already exists", { field: "code" });

    await db.insert(warehouse).values({
      id,
      code: input.code,
      name: input.name,
      status: input.status,
      createdAt: now,
      updatedAt: now
    });

    const created = await db.select().from(warehouse).where(eq(warehouse.id, id)).get();
    return c.json(created, 201);
  }
);

warehouseRoutes.get("/warehouses/:id", async (c) => {
  const db: ForgeDb = getDb(c.env);
  const row = await db
    .select()
    .from(warehouse)
    .where(eq(warehouse.id, c.req.param("id")))
    .get();
  if (!row) notFound("Warehouse not found");
  return c.json(row);
});

warehouseRoutes.get("/warehouses/:id/locations", async (c) => {
  const db: ForgeDb = getDb(c.env);
  const id = c.req.param("id");
  const wh = await db.select().from(warehouse).where(eq(warehouse.id, id)).get();
  if (!wh) notFound("Warehouse not found");

  const zones = await db.select().from(zone).where(eq(zone.warehouseId, id)).orderBy(asc(zone.code));
  const locations = await db
    .select()
    .from(location)
    .where(eq(location.warehouseId, id))
    .orderBy(asc(location.code));

  return c.json({ warehouse: wh, zones, locations });
});

warehouseRoutes.post(
  "/warehouses/:id/locations",
  requireWriteRole("manager", "admin"),
  validate(createLocationRequestSchema),
  async (c) => {
    const db: ForgeDb = getDb(c.env);
    const input = c.req.valid("json");
    const id = crypto.randomUUID();

    const zoneRow = await db
      .select()
      .from(zone)
      .where(eq(zone.id, input.zoneId))
      .get();
    if (!zoneRow) badRequest("Zone not found", { field: "zoneId" });

    const loc = await db
      .select()
      .from(location)
      .where(eq(location.code, input.code))
      .get();
    if (loc) badRequest("Location code already exists", { field: "code" });

    await db.insert(location).values({
      id,
      warehouseId: input.warehouseId,
      zoneId: input.zoneId,
      code: input.code,
      locationType: input.locationType,
      capacityQty: input.capacityQty ?? null,
      status: input.status
    });

    const created = await db.select().from(location).where(eq(location.id, id)).get();
    return c.json(created, 201);
  }
);
