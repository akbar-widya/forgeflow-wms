import { and, eq, inArray, isNull } from "drizzle-orm";
import { type BatchItem } from "drizzle-orm/batch";
import {
  receipt,
  receiptLine,
  purchaseOrder,
  purchaseOrderLine,
  qualityInspection,
  location,
  item,
  itemLot,
  stockBalance,
  type ForgeDb
} from "@forgeflow/db";
import type {
  BatchPostReceiptsRequest,
  BatchPostReceiptsResponse,
  CreateReceiptRequest,
  InspectReceiptLineRequest,
  Receipt,
  ReceiptLine as ReceiptLineDto
} from "@forgeflow/contracts";
import { badRequest, conflict, notFound } from "../lib/http";
import {
  applySingleLocationMovement,
  buildSingleLocationMovementStatements,
  ensureLot
} from "./movement-service";
import { createNotification, buildPoDiscrepancyNotificationStatement } from "./notification-service";

export async function buildReceiptLineDto(
  db: ForgeDb,
  line: typeof receiptLine.$inferSelect
): Promise<ReceiptLineDto> {
  const itemRow = await db
    .select()
    .from(item)
    .where(eq(item.id, line.itemId))
    .get();
  const loc = line.targetLocationId
    ? await db
        .select()
        .from(location)
        .where(eq(location.id, line.targetLocationId))
        .get()
    : undefined;
  const lot = line.lotId
    ? await db
        .select()
        .from(itemLot)
        .where(eq(itemLot.id, line.lotId))
        .get()
    : undefined;

  const qi = await db
    .select()
    .from(qualityInspection)
    .where(eq(qualityInspection.receiptLineId, line.id))
    .get();

  return {
    id: line.id,
    receiptId: line.receiptId,
    purchaseOrderLineId: line.purchaseOrderLineId,
    itemId: line.itemId,
    sku: itemRow?.sku ?? "",
    itemName: itemRow?.name ?? "",
    lotId: line.lotId,
    lotCode: lot?.lotCode ?? "",
    targetLocationId: line.targetLocationId,
    targetLocationCode: loc?.code ?? "",
    receivedQty: line.receivedQty,
    acceptedQty: line.acceptedQty,
    rejectedQty: line.rejectedQty,
    inspectionResult: qi?.result ?? null,
    status: line.status
  };
}

export async function buildReceiptDto(
  db: ForgeDb,
  receiptId: string
): Promise<Receipt> {
  const r = await db
    .select()
    .from(receipt)
    .where(eq(receipt.id, receiptId))
    .get();
  if (!r) notFound("Receipt not found");

  const po = r.purchaseOrderId
    ? await db
        .select({ poNumber: purchaseOrder.poNumber })
        .from(purchaseOrder)
        .where(eq(purchaseOrder.id, r.purchaseOrderId))
        .get()
    : undefined;

  const lines = await db
    .select()
    .from(receiptLine)
    .where(eq(receiptLine.receiptId, receiptId));

  const lineDtos: ReceiptLineDto[] = [];
  for (const line of lines) {
    lineDtos.push(await buildReceiptLineDto(db, line));
  }

  return {
    id: r.id,
    warehouseId: r.warehouseId,
    warehouseCode: "",
    purchaseOrderId: r.purchaseOrderId,
    poNumber: po?.poNumber ?? null,
    receiptNumber: r.receiptNumber,
    status: r.status,
    receivedBy: r.receivedBy,
    receivedAt: r.receivedAt,
    lines: lineDtos
  };
}

export async function createReceipt(
  db: ForgeDb,
  input: CreateReceiptRequest,
  staffId: string
): Promise<Receipt> {
  const now = Date.now();
  const receiptId = crypto.randomUUID();
  const receiptNumber = `RCP-${now.toString(36).toUpperCase()}`;

  for (const l of input.lines) {
    const loc = await db
      .select()
      .from(location)
      .where(eq(location.id, l.targetLocationId))
      .get();
    if (!loc) {
      badRequest("Target location not found", { locationId: l.targetLocationId });
    }
    if (loc.status !== "active") {
      conflict("Target location is not active", { locationId: l.targetLocationId });
    }
  }

  const lotIds = await Promise.all(
    input.lines.map((l) => ensureLot(db, l.itemId, l.lotCode, l.expiryDate))
  );

  await db.batch([
    db.insert(receipt).values({
      id: receiptId,
      warehouseId: input.warehouseId,
      purchaseOrderId: input.purchaseOrderId ?? null,
      receiptNumber,
      status: "draft",
      receivedBy: staffId,
      receivedAt: now
    }),
    ...input.lines.map((l, i) =>
      db.insert(receiptLine).values({
        id: crypto.randomUUID(),
        receiptId,
        purchaseOrderLineId: l.purchaseOrderLineId ?? null,
        itemId: l.itemId,
        lotId: lotIds[i] ?? null,
        targetLocationId: l.targetLocationId,
        receivedQty: l.receivedQty,
        acceptedQty: 0,
        rejectedQty: 0,
        status: "draft"
      })
    )
  ]);

  await db
    .update(receipt)
    .set({ status: "inspecting" })
    .where(eq(receipt.id, receiptId));

  return buildReceiptDto(db, receiptId);
}

export async function inspectReceiptLine(
  db: ForgeDb,
  receiptId: string,
  lineId: string,
  input: InspectReceiptLineRequest,
  staffId: string
): Promise<ReceiptLineDto> {
  const r = await db
    .select()
    .from(receipt)
    .where(eq(receipt.id, receiptId))
    .get();
  if (!r) notFound("Receipt not found");
  if (r.status === "posted") conflict("Receipt already posted");

  const line = await db
    .select()
    .from(receiptLine)
    .where(and(eq(receiptLine.id, lineId), eq(receiptLine.receiptId, receiptId)))
    .get();
  if (!line) notFound("Receipt line not found");

  const acceptedQty = input.acceptedQty ?? line.receivedQty;
  const rejectedQty = input.rejectedQty ?? line.receivedQty - acceptedQty;

  if (acceptedQty < 0 || rejectedQty < 0) {
    badRequest("Quantities cannot be negative");
  }
  if (acceptedQty + rejectedQty > line.receivedQty) {
    badRequest("Accepted + rejected cannot exceed received quantity");
  }

  const now = Date.now();
  await db.batch([
    db
      .update(receiptLine)
      .set({ acceptedQty, rejectedQty, status: "inspecting" })
      .where(eq(receiptLine.id, lineId)),
    db.insert(qualityInspection).values({
      id: crypto.randomUUID(),
      receiptLineId: lineId,
      result: input.result,
      discrepancyCode: input.discrepancyCode ?? null,
      notes: input.notes ?? null,
      inspectedBy: staffId,
      inspectedAt: now
    })
  ]);

  const updated = await db
    .select()
    .from(receiptLine)
    .where(eq(receiptLine.id, lineId))
    .get();
  return buildReceiptLineDto(db, updated!);
}

export async function postReceipt(
  db: ForgeDb,
  receiptId: string,
  staffId: string,
  authUserId: string
): Promise<Receipt> {
  const r = await db
    .select()
    .from(receipt)
    .where(eq(receipt.id, receiptId))
    .get();
  if (!r) notFound("Receipt not found");
  if (r.status === "posted") conflict("Receipt already posted");

  const lines = await db
    .select()
    .from(receiptLine)
    .where(eq(receiptLine.receiptId, receiptId));

  const inspectedMap = new Map<string, typeof qualityInspection.$inferSelect>();
  for (const line of lines) {
    const qi = await db
      .select()
      .from(qualityInspection)
      .where(eq(qualityInspection.receiptLineId, line.id))
      .get();
    if (!qi || qi.result === "pending") {
      conflict("All receipt lines must be inspected before posting", {
        code: "LINES_NOT_INSPECTED"
      });
    }
    inspectedMap.set(line.id, qi!);
  }

  const movements: string[] = [];
  for (const line of lines) {
    const qi = inspectedMap.get(line.id)!;
    if (line.acceptedQty > 0 && qi.result === "accepted") {
      const movementId = await applySingleLocationMovement({
        db,
        warehouseId: r.warehouseId,
        itemId: line.itemId,
        lotId: line.lotId,
        toLocationId: line.targetLocationId ?? undefined,
        qtyDelta: line.acceptedQty,
        movementType: "receive",
        referenceType: "receipt",
        referenceId: receiptId,
        performedBy: staffId,
        occurredAt: Date.now()
      });
      movements.push(movementId);
    }
  }

  if (movements.length === 0) {
    conflict("No accepted quantity to post", { code: "NOTHING_TO_POST" });
  }

  const now = Date.now();
  await db.batch([
    db
      .update(receipt)
      .set({ status: "posted", receivedAt: now })
      .where(eq(receipt.id, receiptId)),
    db
      .update(receiptLine)
      .set({ status: "posted" })
      .where(eq(receiptLine.receiptId, receiptId))
  ]);

  if (r.purchaseOrderId) {
    const poLines = await db
      .select()
      .from(purchaseOrderLine)
      .where(eq(purchaseOrderLine.purchaseOrderId, r.purchaseOrderId));
    const poRow = await db
      .select({ poNumber: purchaseOrder.poNumber })
      .from(purchaseOrder)
      .where(eq(purchaseOrder.id, r.purchaseOrderId))
      .get();

    for (const poLine of poLines) {
      const matched = lines.find((l) => l.purchaseOrderLineId === poLine.id);
      if (matched) {
        const newReceived = poLine.receivedQty + matched.acceptedQty;
        const status =
          newReceived >= poLine.orderedQty ? "received" : "partially_received";
        await db
          .update(purchaseOrderLine)
          .set({ receivedQty: newReceived, status })
          .where(eq(purchaseOrderLine.id, poLine.id));

        if (newReceived > poLine.orderedQty) {
          const it = await db
            .select()
            .from(item)
            .where(eq(item.id, matched.itemId))
            .get();
          await createNotification(db, {
            userId: authUserId,
            movementId: null,
            severity: "warning",
            type: "po_discrepancy",
            title: "PO over-receipt",
            message: `${poRow?.poNumber ?? "PO"}: received ${newReceived} × ${
              it ? `${it.sku} (${it.name})` : matched.itemId
            } against ${poLine.orderedQty} ordered.`
          });
        }
      }
    }

    const remaining = await db
      .select()
      .from(purchaseOrderLine)
      .where(eq(purchaseOrderLine.purchaseOrderId, r.purchaseOrderId));
    const allReceived = remaining.every((l) => l.status === "received");
    await db
      .update(purchaseOrder)
      .set({ status: allReceived ? "received" : "partially_received" })
      .where(eq(purchaseOrder.id, r.purchaseOrderId));
  }

  for (const line of lines) {
    const qi = inspectedMap.get(line.id)!;
    if (qi.result === "rejected" && qi.discrepancyCode) {
      await createNotification(db, {
        userId: authUserId,
        movementId: movements[0] ?? null,
        severity: "warning",
        type: "po_discrepancy",
        title: "PO discrepancy detected",
        message: `Line rejected during inspection (${qi.discrepancyCode}).`
      });
    }
  }

  return buildReceiptDto(db, receiptId);
}

export async function batchPostReceipts(
  db: ForgeDb,
  input: BatchPostReceiptsRequest,
  staffId: string,
  authUserId: string
): Promise<BatchPostReceiptsResponse> {
  const now = Date.now();

  const locationIds = new Set<string>();
  for (const r of input.receipts) {
    for (const l of r.lines) {
      if (l.acceptedQty + l.rejectedQty > l.receivedQty) {
        badRequest("Accepted + rejected cannot exceed received quantity", {
          itemId: l.itemId
        });
      }
      locationIds.add(l.targetLocationId);
    }
  }

  const poIds = input.receipts.map((r) => r.purchaseOrderId);

  const locs = await db
    .select()
    .from(location)
    .where(inArray(location.id, [...locationIds]));
  const locById = new Map(locs.map((loc) => [loc.id, loc]));
  for (const id of locationIds) {
    const loc = locById.get(id);
    if (!loc) badRequest("Target location not found", { locationId: id });
    if (loc!.status !== "active") {
      conflict("Target location is not active", { locationId: id });
    }
  }

  const pos = await db
    .select()
    .from(purchaseOrder)
    .where(inArray(purchaseOrder.id, poIds));
  const poById = new Map(pos.map((p) => [p.id, p]));
  for (const r of input.receipts) {
    const po = poById.get(r.purchaseOrderId);
    if (!po) notFound("Purchase order not found");
    if (po!.warehouseId !== r.warehouseId) {
      conflict("Purchase order does not belong to this warehouse", {
        code: "PO_WAREHOUSE_MISMATCH"
      });
    }
    if (po!.status === "closed" || po!.status === "cancelled") {
      conflict("Purchase order is not receivable", { code: "PO_NOT_RECEIVABLE" });
    }
  }

  const lotByKey = new Map<string, string | null>();
  for (const r of input.receipts) {
    for (const l of r.lines) {
      const key = `${l.itemId}:${l.lotCode ?? ""}`;
      if (!lotByKey.has(key)) {
        lotByKey.set(key, await ensureLot(db, l.itemId, l.lotCode, l.expiryDate));
      }
    }
  }

  const balanceCache = new Map<string, typeof stockBalance.$inferSelect | null>();
  async function getBalance(
    warehouseId: string,
    locationId: string,
    itemId: string,
    lotId: string | null
  ) {
    const key = `${warehouseId}:${locationId}:${itemId}:${lotId ?? ""}`;
    if (!balanceCache.has(key)) {
      const row = await db
        .select()
        .from(stockBalance)
        .where(
          and(
            eq(stockBalance.warehouseId, warehouseId),
            eq(stockBalance.locationId, locationId),
            eq(stockBalance.itemId, itemId),
            lotId ? eq(stockBalance.lotId, lotId) : isNull(stockBalance.lotId)
          )
        )
        .get();
      balanceCache.set(key, row ?? null);
    }
    return balanceCache.get(key) ?? null;
  }

  const poLines = await db
    .select()
    .from(purchaseOrderLine)
    .where(inArray(purchaseOrderLine.purchaseOrderId, poIds));
  const poLineById = new Map(poLines.map((l) => [l.id, l]));

  const poLineItemIds = [...new Set(poLines.map((l) => l.itemId))];
  const poItems =
    poLineItemIds.length > 0
      ? await db.select().from(item).where(inArray(item.id, poLineItemIds))
      : [];
  const itemById = new Map(poItems.map((i) => [i.id, i]));

  const stmts: BatchItem<"sqlite">[] = [];
  const createdReceiptIds: string[] = [];
  let movementCount = 0;
  const acceptedByPoLine = new Map<string, number>();
  const acceptedByPo = new Map<string, number>();

  for (const r of input.receipts) {
    const receiptId = crypto.randomUUID();
    const receiptNumber = `RCP-${(now + createdReceiptIds.length)
      .toString(36)
      .toUpperCase()}`;
    createdReceiptIds.push(receiptId);

    stmts.push(
      db.insert(receipt).values({
        id: receiptId,
        warehouseId: r.warehouseId,
        purchaseOrderId: r.purchaseOrderId,
        receiptNumber,
        status: "posted",
        receivedBy: staffId,
        receivedAt: now
      })
    );

    for (const l of r.lines) {
      const lineId = crypto.randomUUID();
      const lotId = lotByKey.get(`${l.itemId}:${l.lotCode ?? ""}`) ?? null;

      stmts.push(
        db.insert(receiptLine).values({
          id: lineId,
          receiptId,
          purchaseOrderLineId: l.purchaseOrderLineId ?? null,
          itemId: l.itemId,
          lotId,
          targetLocationId: l.targetLocationId,
          receivedQty: l.receivedQty,
          acceptedQty: l.acceptedQty,
          rejectedQty: l.rejectedQty,
          status: "posted"
        })
      );

      stmts.push(
        db.insert(qualityInspection).values({
          id: crypto.randomUUID(),
          receiptLineId: lineId,
          result: l.inspectionResult,
          discrepancyCode: l.discrepancyCode ?? null,
          notes: l.notes ?? null,
          inspectedBy: staffId,
          inspectedAt: now
        })
      );

      if (l.purchaseOrderLineId) {
        acceptedByPoLine.set(
          l.purchaseOrderLineId,
          (acceptedByPoLine.get(l.purchaseOrderLineId) ?? 0) + l.acceptedQty
        );
        acceptedByPo.set(
          r.purchaseOrderId,
          (acceptedByPo.get(r.purchaseOrderId) ?? 0) + l.acceptedQty
        );
      }

      if (l.inspectionResult === "accepted" && l.acceptedQty > 0) {
        const existing = await getBalance(
          r.warehouseId,
          l.targetLocationId,
          l.itemId,
          lotId
        );
        const bundle = buildSingleLocationMovementStatements(
          db,
          {
            warehouseId: r.warehouseId,
            itemId: l.itemId,
            lotId,
            toLocationId: l.targetLocationId,
            qtyDelta: l.acceptedQty,
            movementType: "receive",
            referenceType: "receipt",
            referenceId: receiptId,
            performedBy: staffId,
            occurredAt: now
          },
          existing
        );
        stmts.push(bundle.movementStmt, bundle.balanceStmt);
        movementCount += 1;
      }
    }
  }

  if (movementCount === 0) {
    conflict("Nothing to post — accept at least one line", {
      code: "NOTHING_TO_POST"
    });
  }

  for (const [poLineId, extra] of acceptedByPoLine) {
    if (extra <= 0) continue;
    const pl = poLineById.get(poLineId);
    if (!pl) continue;
    const newReceived = pl.receivedQty + extra;
    const status =
      newReceived >= pl.orderedQty ? "received" : "partially_received";
    stmts.push(
      db
        .update(purchaseOrderLine)
        .set({ receivedQty: newReceived, status })
        .where(eq(purchaseOrderLine.id, poLineId))
    );
    if (newReceived > pl.orderedQty) {
      const it = itemById.get(pl.itemId);
      stmts.push(
        buildPoDiscrepancyNotificationStatement(db, {
          authUserId,
          poNumber: poById.get(pl.purchaseOrderId)?.poNumber ?? null,
          itemLabel: it ? `${it.sku} (${it.name})` : pl.itemId,
          orderedQty: pl.orderedQty,
          receivedQty: newReceived
        })
      );
    }
  }

  for (const r of input.receipts) {
    const accepted = acceptedByPo.get(r.purchaseOrderId) ?? 0;
    if (accepted <= 0) continue;
    const lines = poLines.filter((l) => l.purchaseOrderId === r.purchaseOrderId);
    const allReceived = lines.every((l) => {
      const extra = acceptedByPoLine.get(l.id) ?? 0;
      return l.receivedQty + extra >= l.orderedQty;
    });
    stmts.push(
      db
        .update(purchaseOrder)
        .set({ status: allReceived ? "received" : "partially_received" })
        .where(eq(purchaseOrder.id, r.purchaseOrderId))
    );
  }

  await db.batch(stmts as [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]]);

  for (const r of input.receipts) {
    for (const l of r.lines) {
      if (l.inspectionResult === "rejected" && l.discrepancyCode) {
        await createNotification(db, {
          userId: authUserId,
          movementId: null,
          severity: "warning",
          type: "po_discrepancy",
          title: "PO discrepancy detected",
          message: `Line rejected during inspection (${l.discrepancyCode}).`
        });
      }
    }
  }

  const receipts = await Promise.all(
    createdReceiptIds.map((id) => buildReceiptDto(db, id))
  );

  return { receipts, movementCount };
}
