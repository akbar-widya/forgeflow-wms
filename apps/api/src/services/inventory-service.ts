import { and, eq, like, or, desc, asc, count, ne } from "drizzle-orm";
import {
  item,
  itemLot,
  stockBalance,
  location,
  warehouse,
  type ForgeDb
} from "@forgeflow/db";
import type {
  CreateItemRequest,
  ItemListParams,
  ItemListResponse,
  StockBalanceListParams,
  StockBalanceListResponse,
  UpdateItemRequest
} from "@forgeflow/contracts";
import { badRequest, notFound } from "../lib/http";
import { offsetFor, pageMeta } from "../lib/pagination";

export async function listItems(
  db: ForgeDb,
  params: ItemListParams
): Promise<ItemListResponse> {
  const where = and(
    params.status ? eq(item.status, params.status) : undefined,
    params.category ? eq(item.category, params.category) : undefined,
    params.search
      ? or(
          like(item.sku, `%${params.search}%`),
          like(item.name, `%${params.search}%`)
        )
      : undefined
  );

  const sortCol =
    params.sort === "name"
      ? item.name
      : params.sort === "sku"
        ? item.sku
        : item.createdAt;

  const rows = await db
    .select()
    .from(item)
    .where(where)
    .orderBy(params.direction === "desc" ? desc(sortCol) : asc(sortCol))
    .limit(params.pageSize)
    .offset(offsetFor(params));

  const totalRow = await db
    .select({ value: count() })
    .from(item)
    .where(where)
    .get();
  const total = totalRow?.value ?? 0;

  return {
    items: rows.map((r) => ({
      id: r.id,
      sku: r.sku,
      name: r.name,
      uom: r.uom,
      category: r.category,
      lotTracked: r.lotTracked,
      expiryTracked: r.expiryTracked,
      serialTracked: r.serialTracked,
      reorderPoint: r.reorderPoint,
      status: r.status
    })),
    meta: pageMeta(params.page, params.pageSize, total)
  };
}

export async function createItem(db: ForgeDb, input: CreateItemRequest) {
  const dup = await db
    .select({ id: item.id })
    .from(item)
    .where(eq(item.sku, input.sku))
    .get();
  if (dup) badRequest("SKU already exists", { field: "sku" });

  const id = crypto.randomUUID();
  await db.insert(item).values({
    id,
    sku: input.sku,
    name: input.name,
    uom: input.uom,
    category: input.category ?? null,
    lotTracked: input.lotTracked,
    expiryTracked: input.expiryTracked,
    serialTracked: false,
    reorderPoint: input.reorderPoint ?? null,
    status: input.status,
    createdAt: Date.now()
  });
  const created = await db.select().from(item).where(eq(item.id, id)).get();
  if (!created) throw new Error("Failed to create item");
  return created;
}

export async function getItem(db: ForgeDb, id: string) {
  const row = await db.select().from(item).where(eq(item.id, id)).get();
  if (!row) notFound("Item not found");
  return row;
}

export async function updateItem(
  db: ForgeDb,
  id: string,
  input: UpdateItemRequest
) {
  const existing = await db.select().from(item).where(eq(item.id, id)).get();
  if (!existing) notFound("Item not found");

  const nextSku = input.sku ?? existing.sku;
  const dup = await db
    .select({ id: item.id })
    .from(item)
    .where(and(eq(item.sku, nextSku), ne(item.id, id)))
    .get();
  if (dup) badRequest("SKU already exists", { field: "sku" });

  await db
    .update(item)
    .set({
      name: input.name ?? existing.name,
      uom: input.uom ?? existing.uom,
      category:
        input.category !== undefined
          ? input.category ?? null
          : existing.category,
      lotTracked: input.lotTracked ?? existing.lotTracked,
      expiryTracked: input.expiryTracked ?? existing.expiryTracked,
      reorderPoint:
        input.reorderPoint !== undefined
          ? input.reorderPoint ?? null
          : existing.reorderPoint,
      status: input.status ?? existing.status
    })
    .where(eq(item.id, id));

  return getItem(db, id);
}

export async function listBalances(
  db: ForgeDb,
  params: StockBalanceListParams
): Promise<StockBalanceListResponse> {
  const where = and(
    params.warehouseId ? eq(stockBalance.warehouseId, params.warehouseId) : undefined,
    params.locationId ? eq(stockBalance.locationId, params.locationId) : undefined,
    params.itemId ? eq(stockBalance.itemId, params.itemId) : undefined,
    params.lotId ? eq(stockBalance.lotId, params.lotId) : undefined,
    params.stockStatus ? eq(stockBalance.stockStatus, params.stockStatus) : undefined
  );

  const base = db
    .select({
      balance: stockBalance,
      warehouseCode: warehouse.code,
      locationCode: location.code,
      sku: item.sku,
      itemName: item.name,
      uom: item.uom,
      lotCode: itemLot.lotCode,
      expiryDate: itemLot.expiryDate
    })
    .from(stockBalance)
    .innerJoin(warehouse, eq(stockBalance.warehouseId, warehouse.id))
    .innerJoin(location, eq(stockBalance.locationId, location.id))
    .innerJoin(item, eq(stockBalance.itemId, item.id))
    .leftJoin(itemLot, eq(stockBalance.lotId, itemLot.id))
    .where(where);

  const sortCol =
    params.sort === "sku"
      ? item.sku
      : params.sort === "location"
        ? location.code
        : stockBalance.updatedAt;

  const rows = await base
    .orderBy(params.direction === "desc" ? desc(sortCol) : asc(sortCol))
    .limit(params.pageSize)
    .offset(offsetFor(params));

  const countQuery = db
    .select({ value: count() })
    .from(stockBalance)
    .innerJoin(warehouse, eq(stockBalance.warehouseId, warehouse.id))
    .innerJoin(location, eq(stockBalance.locationId, location.id))
    .innerJoin(item, eq(stockBalance.itemId, item.id))
    .leftJoin(itemLot, eq(stockBalance.lotId, itemLot.id))
    .where(where);

  const totalRow = await countQuery.get();
  const total = totalRow?.value ?? 0;

  return {
    items: rows.map((r) => ({
      id: r.balance.id,
      warehouseId: r.balance.warehouseId,
      warehouseCode: r.warehouseCode,
      locationId: r.balance.locationId,
      locationCode: r.locationCode,
      itemId: r.balance.itemId,
      sku: r.sku,
      itemName: r.itemName,
      uom: r.uom,
      lotId: r.balance.lotId,
      lotCode: r.lotCode,
      expiryDate: r.expiryDate,
      onHandQty: r.balance.onHandQty,
      allocatedQty: r.balance.allocatedQty,
      availableQty: r.balance.availableQty,
      stockStatus: r.balance.stockStatus,
      updatedAt: r.balance.updatedAt
    })),
    meta: pageMeta(params.page, params.pageSize, total)
  };
}

export async function getBalanceSummary(db: ForgeDb) {
  const rows = await db
    .select({
      itemId: stockBalance.itemId,
      sku: item.sku,
      itemName: item.name,
      uom: item.uom,
      category: item.category,
      totalOnHand: stockBalance.onHandQty,
      totalAllocated: stockBalance.allocatedQty
    })
    .from(stockBalance)
    .innerJoin(item, eq(stockBalance.itemId, item.id));
  return rows;
}
