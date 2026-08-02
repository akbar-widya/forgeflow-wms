import { and, eq, isNull } from "drizzle-orm";
import { type BatchItem } from "drizzle-orm/batch";
import {
  stockBalance,
  stockMovement,
  itemLot,
  type ForgeDb,
  type StockMovementInsert
} from "@forgeflow/db";
import type {
  MovementType,
  ReferenceType,
  StockStatus
} from "@forgeflow/contracts";
import { badRequest, conflict } from "../lib/http";

export type MovementCommand = {
  db: ForgeDb;
  warehouseId: string;
  itemId: string;
  lotId?: string | null;
  locationId?: string | null;
  fromLocationId?: string | null;
  toLocationId?: string | null;
  qtyDelta: number;
  movementType: MovementType;
  referenceType: ReferenceType;
  referenceId?: string | null;
  performedBy?: string | null;
  occurredAt?: number;
};

export function computeStockStatus(
  availableQty: number,
  reorderPoint: number | null
): StockStatus {
  if (availableQty <= 0) return "out_of_stock";
  if (reorderPoint != null && availableQty < reorderPoint) return "low";
  return "available";
}

function lotClause(db: ForgeDb, lotId?: string | null) {
  return lotId ? eq(stockBalance.lotId, lotId) : isNull(stockBalance.lotId);
}

async function findBalance(
  db: ForgeDb,
  warehouseId: string,
  locationId: string,
  itemId: string,
  lotId?: string | null
) {
  return db
    .select()
    .from(stockBalance)
    .where(
      and(
        eq(stockBalance.warehouseId, warehouseId),
        eq(stockBalance.locationId, locationId),
        eq(stockBalance.itemId, itemId),
        lotClause(db, lotId)
      )
    )
    .get();
}

export type MovementStatementBundle = {
  movementId: string;
  movementStmt: BatchItem<"sqlite">;
  balanceStmt: BatchItem<"sqlite">;
};

/**
 * Prepare the ledger + balance statements for a single-location movement without
 * executing them. Callers can batch multiple bundles together atomically.
 */
export function buildSingleLocationMovementStatements(
  db: ForgeDb,
  cmd: Omit<MovementCommand, "db">,
  existing?: typeof stockBalance.$inferSelect
): MovementStatementBundle {
  const {
    warehouseId,
    itemId,
    lotId,
    locationId,
    qtyDelta,
    movementType,
    referenceType,
    referenceId,
    performedBy,
    occurredAt
  } = cmd;

  const resolvedLocation = locationId ?? cmd.toLocationId ?? cmd.fromLocationId;

  if (resolvedLocation == null) {
    badRequest("location is required for this movement");
  }

  const now = occurredAt ?? Date.now();
  const movementId = crypto.randomUUID();

  let newOnHand: number;
  let stockStatus: StockStatus;

  if (existing) {
    newOnHand = Math.max(0, existing.onHandQty + qtyDelta);
    stockStatus = existing.stockStatus;
    if (newOnHand < 0) {
      conflict("Insufficient stock for movement", {
        code: "INSUFFICIENT_STOCK",
        availableQty: existing.availableQty
      });
    }
  } else {
    newOnHand = qtyDelta;
    if (newOnHand < 0) {
      conflict("Insufficient stock for movement", {
        code: "INSUFFICIENT_STOCK"
      });
    }
    stockStatus = newOnHand === 0 ? "out_of_stock" : "available";
  }

  const availableQty = newOnHand;
  const nowMs = now;

  const movement: StockMovementInsert = {
    id: movementId,
    warehouseId,
    itemId,
    lotId: lotId ?? null,
    fromLocationId: qtyDelta < 0 ? resolvedLocation : null,
    toLocationId: qtyDelta >= 0 ? resolvedLocation : null,
    qtyDelta,
    movementType,
    referenceType,
    referenceId: referenceId ?? null,
    performedBy: performedBy ?? null,
    occurredAt: nowMs
  };

  return {
    movementId,
    movementStmt: db.insert(stockMovement).values(movement),
    balanceStmt: existing
      ? db
          .update(stockBalance)
          .set({
            onHandQty: newOnHand,
            availableQty,
            stockStatus,
            updatedAt: nowMs
          })
          .where(eq(stockBalance.id, existing.id))
      : db.insert(stockBalance).values({
          id: crypto.randomUUID(),
          warehouseId,
          locationId: resolvedLocation,
          itemId,
          lotId: lotId ?? null,
          onHandQty: newOnHand,
          allocatedQty: 0,
          availableQty,
          stockStatus,
          updatedAt: nowMs
        })
  };
}

/**
 * Apply a movement that adjusts a single stock balance row.
 * Inserts the immutable ledger row and updates the balance in one D1 batch.
 */
export async function applySingleLocationMovement(
  cmd: MovementCommand
): Promise<string> {
  const { db, ...rest } = cmd;

  const resolvedLocation =
    rest.locationId ?? rest.toLocationId ?? rest.fromLocationId;

  if (resolvedLocation == null) {
    badRequest("location is required for this movement");
  }

  const existing = await findBalance(
    db,
    rest.warehouseId,
    resolvedLocation,
    rest.itemId,
    rest.lotId
  );

  const { movementId, movementStmt, balanceStmt } =
    buildSingleLocationMovementStatements(db, rest, existing);

  await db.batch([movementStmt, balanceStmt]);

  return movementId;
}

/**
 * Apply a transfer between two locations: decrement source, increment target.
 * Both rows plus a single ledger row in one D1 batch.
 */
export async function applyTransferMovement(cmd: MovementCommand): Promise<string> {
  const {
    db,
    warehouseId,
    itemId,
    lotId,
    fromLocationId,
    toLocationId,
    qtyDelta,
    movementType,
    referenceType,
    referenceId,
    performedBy,
    occurredAt
  } = cmd;

  if (fromLocationId == null || toLocationId == null) {
    badRequest("Both from and to locations are required for transfer");
  }
  if (qtyDelta <= 0) {
    badRequest("Transfer quantity must be positive");
  }

  const now = occurredAt ?? Date.now();
  const movementId = crypto.randomUUID();

  const source = await findBalance(
    db,
    warehouseId,
    fromLocationId!,
    itemId,
    lotId
  );
  if (!source || source.availableQty < qtyDelta) {
    conflict("Insufficient stock at source location for transfer", {
      code: "INSUFFICIENT_STOCK",
      availableQty: source?.availableQty ?? 0
    });
  }

  const target = await findBalance(db, warehouseId, toLocationId!, itemId, lotId);

  const sourceOnHand = source!.onHandQty - qtyDelta;
  const targetOnHand = (target?.onHandQty ?? 0) + qtyDelta;

  await db.batch([
    db.insert(stockMovement).values({
      id: movementId,
      warehouseId,
      itemId,
      lotId: lotId ?? null,
      fromLocationId,
      toLocationId,
      qtyDelta,
      movementType,
      referenceType,
      referenceId: referenceId ?? null,
      performedBy: performedBy ?? null,
      occurredAt: now
    }),
    db
      .update(stockBalance)
      .set({
        onHandQty: sourceOnHand,
        availableQty: sourceOnHand,
        stockStatus: sourceOnHand <= 0 ? "out_of_stock" : source!.stockStatus,
        updatedAt: now
      })
      .where(eq(stockBalance.id, source!.id)),
    target
      ? db
          .update(stockBalance)
          .set({ onHandQty: targetOnHand, availableQty: targetOnHand, updatedAt: now })
          .where(eq(stockBalance.id, target.id))
      : db.insert(stockBalance).values({
          id: crypto.randomUUID(),
          warehouseId,
          locationId: toLocationId!,
          itemId,
          lotId: lotId ?? null,
          onHandQty: targetOnHand,
          allocatedQty: 0,
          availableQty: targetOnHand,
          stockStatus: "available",
          updatedAt: now
        })
  ]);

  return movementId;
}

export async function applyAdjustment(
  cmd: Omit<MovementCommand, "qtyDelta"> & { newQty: number }
): Promise<string> {
  const { db, newQty, ...rest } = cmd;
  const existing = await findBalance(
    db,
    rest.warehouseId,
    rest.locationId ?? "",
    rest.itemId,
    rest.lotId
  );
  const qtyDelta = newQty - (existing?.onHandQty ?? 0);
  return applySingleLocationMovement({ ...rest, db, qtyDelta });
}

export async function ensureLot(
  db: ForgeDb,
  itemId: string,
  lotCode?: string,
  expiryDate?: number
): Promise<string | null> {
  if (!lotCode) return null;
  const existing = await db
    .select()
    .from(itemLot)
    .where(and(eq(itemLot.itemId, itemId), eq(itemLot.lotCode, lotCode)))
    .get();
  if (existing) return existing.id;
  const id = crypto.randomUUID();
  await db.insert(itemLot).values({
    id,
    itemId,
    lotCode,
    expiryDate: expiryDate ?? null,
    qualityStatus: "available",
    createdAt: Date.now()
  });
  return id;
}
