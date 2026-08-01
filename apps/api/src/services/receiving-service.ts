import { and, eq } from "drizzle-orm";
import {
  receipt,
  receiptLine,
  purchaseOrder,
  purchaseOrderLine,
  qualityInspection,
  location,
  item,
  itemLot,
  type ForgeDb
} from "@forgeflow/db";
import type {
  CreateReceiptRequest,
  InspectReceiptLineRequest,
  Receipt,
  ReceiptLine as ReceiptLineDto
} from "@forgeflow/contracts";
import { badRequest, conflict, notFound } from "../lib/http";
import {
  applySingleLocationMovement,
  ensureLot
} from "./movement-service";
import { createNotification } from "./notification-service";

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
  staffId: string
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
        userId: r.receivedBy ?? staffId,
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
