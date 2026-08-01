import { Hono } from "hono";
import { count, eq, or } from "drizzle-orm";
import {
  item,
  stockBalance,
  warehouse,
  purchaseOrder,
  job,
  type ForgeDb
} from "@forgeflow/db";
import { getDb } from "../db";
import { authRequired } from "../middleware/auth-required";
import type { AppEnv } from "../types";

export const dashboardRoutes = new Hono<AppEnv>();

dashboardRoutes.get("/dashboard/kpis", authRequired, async (c) => {
  const db: ForgeDb = getDb(c.env);

  const totalSkuRow = await db
    .select({ value: count() })
    .from(item)
    .where(eq(item.status, "active"))
    .get();

  const totalWarehouseRow = await db
    .select({ value: count() })
    .from(warehouse)
    .where(eq(warehouse.status, "active"))
    .get();

  const allBalances = await db
    .select({ onHandQty: stockBalance.onHandQty, stockStatus: stockBalance.stockStatus })
    .from(stockBalance);

  const totalOnHandQty = allBalances.reduce((sum, b) => sum + b.onHandQty, 0);
  const lowStockCount = allBalances.filter((b) => b.stockStatus === "low").length;

  const openPoRow = await db
    .select({ value: count() })
    .from(purchaseOrder)
    .where(
      or(
        eq(purchaseOrder.status, "open"),
        eq(purchaseOrder.status, "partially_received")
      )
    )
    .get();

  const openJobRow = await db
    .select({ value: count() })
    .from(job)
    .where(eq(job.status, "planned"))
    .get();

  return c.json({
    totalSkuCount: Number(totalSkuRow?.value ?? 0),
    totalOnHandQty,
    totalWarehouseCount: Number(totalWarehouseRow?.value ?? 0),
    lowStockCount,
    openPoCount: Number(openPoRow?.value ?? 0),
    openJobCount: Number(openJobRow?.value ?? 0),
    unreadNotificationCount: 0
  });
});

dashboardRoutes.get("/dashboard/capacity", authRequired, async (c) => {
  const db: ForgeDb = getDb(c.env);

  const balances = await db
    .select({ warehouseId: stockBalance.warehouseId, onHandQty: stockBalance.onHandQty })
    .from(stockBalance);

  const byWarehouse = new Map<string, number>();
  for (const b of balances) {
    byWarehouse.set(b.warehouseId, (byWarehouse.get(b.warehouseId) ?? 0) + b.onHandQty);
  }

  const warehouses = await db.select().from(warehouse);

  const slices = warehouses.map((w) => {
    const onHandQty = byWarehouse.get(w.id) ?? 0;
    return {
      warehouseId: w.id,
      warehouseCode: w.code,
      warehouseName: w.name,
      capacityQty: 0,
      onHandQty,
      utilizationPct: 0
    };
  });

  const totalOnHand = slices.reduce((sum, s) => sum + s.onHandQty, 0);

  return c.json({
    warehouses: slices,
    totalCapacity: 0,
    totalOnHand,
    overallUtilizationPct: 0
  });
});

dashboardRoutes.get("/dashboard/inventory-summary", authRequired, async (c) => {
  const db: ForgeDb = getDb(c.env);

  const rows = await db
    .select({
      itemId: stockBalance.itemId,
      sku: item.sku,
      itemName: item.name,
      uom: item.uom,
      category: item.category,
      onHandQty: stockBalance.onHandQty,
      allocatedQty: stockBalance.allocatedQty
    })
    .from(stockBalance)
    .innerJoin(item, eq(stockBalance.itemId, item.id));

  const summary = new Map<
    string,
    {
      itemId: string;
      sku: string;
      itemName: string;
      uom: string;
      category: string | null;
      totalOnHand: number;
      totalAllocated: number;
      totalAvailable: number;
    }
  >();

  for (const r of rows) {
    const existing = summary.get(r.itemId) ?? {
      itemId: r.itemId,
      sku: r.sku,
      itemName: r.itemName,
      uom: r.uom,
      category: r.category,
      totalOnHand: 0,
      totalAllocated: 0,
      totalAvailable: 0
    };
    existing.totalOnHand += r.onHandQty;
    existing.totalAllocated += r.allocatedQty;
    existing.totalAvailable = existing.totalOnHand - existing.totalAllocated;
    summary.set(r.itemId, existing);
  }

  const items = Array.from(summary.values()).map((s) => ({
    ...s,
    stockStatus: s.totalAvailable <= 0 ? "out_of_stock" : "available"
  }));

  return c.json({ items });
});
