import { Hono } from "hono";
import {
  createItemRequestSchema,
  updateItemRequestSchema,
  itemListParamsSchema,
  stockBalanceListParamsSchema
} from "@forgeflow/contracts";
import { getDb } from "../db";
import { authRequired } from "../middleware/auth-required";
import { requireWriteRole } from "../middleware/rbac";
import { validate } from "../middleware/validate";
import type { AppEnv } from "../types";
import {
  createItem,
  getItem,
  listBalances,
  listItems,
  updateItem
} from "../services/inventory-service";
import { badRequest, notFound } from "../lib/http";
import type { ForgeDb } from "@forgeflow/db";
import { eq } from "drizzle-orm";
import { stockBalance } from "@forgeflow/db";

export const inventoryRoutes = new Hono<AppEnv>();

inventoryRoutes.use("*", authRequired);

inventoryRoutes.get("/inventory/items", async (c) => {
  const db: ForgeDb = getDb(c.env);
  const q = c.req.query();
  const params = itemListParamsSchema.parse(q);
  return c.json(await listItems(db, params));
});

inventoryRoutes.post(
  "/inventory/items",
  requireWriteRole("manager", "admin"),
  validate(createItemRequestSchema),
  async (c) => {
    const db: ForgeDb = getDb(c.env);
    const input = c.req.valid("json");
    try {
      const created = await createItem(db, input);
      return c.json(created, 201);
    } catch {
      badRequest("SKU already exists", { field: "sku" });
    }
  }
);

inventoryRoutes.get("/inventory/items/:id", async (c) => {
  const db: ForgeDb = getDb(c.env);
  return c.json(await getItem(db, c.req.param("id")));
});

inventoryRoutes.patch(
  "/inventory/items/:id",
  requireWriteRole("manager", "admin"),
  validate(updateItemRequestSchema),
  async (c) => {
    const db: ForgeDb = getDb(c.env);
    const input = c.req.valid("json");
    return c.json(await updateItem(db, c.req.param("id"), input));
  }
);

inventoryRoutes.get("/inventory/balances", async (c) => {
  const db: ForgeDb = getDb(c.env);
  const q = c.req.query();
  const params = stockBalanceListParamsSchema.parse(q);
  return c.json(await listBalances(db, params));
});

inventoryRoutes.get("/inventory/balances/:id", async (c) => {
  const db: ForgeDb = getDb(c.env);
  const row = await db
    .select()
    .from(stockBalance)
    .where(eq(stockBalance.id, c.req.param("id")))
    .get();
  if (!row) notFound("Stock balance not found");
  return c.json(row);
});
