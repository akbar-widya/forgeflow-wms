import { and, desc, eq, count, isNull } from "drizzle-orm";
import { type BatchItem } from "drizzle-orm/batch";
import {
  notification,
  type ForgeDb,
  type NotificationInsert
} from "@forgeflow/db";
import type {
  Notification,
  NotificationListParams,
  NotificationListResponse
} from "@forgeflow/contracts";
import { notFound } from "../lib/http";
import { offsetFor, pageMeta } from "../lib/pagination";

/**
 * Build an INSERT statement (or null when the item still has stock) for a
 * critical "stock shortage" notification. Designed to be pushed into the same
 * atomic batch as the movement that drained the item to zero.
 */
export function buildStockShortageNotificationStatement(
  db: ForgeDb,
  input: {
    authUserId: string;
    movementId: string;
    itemLabel: string;
    onHandQty: number;
  }
): BatchItem<"sqlite"> | null {
  if (input.onHandQty > 0) return null;
  return db.insert(notification).values({
    id: crypto.randomUUID(),
    userId: input.authUserId,
    movementId: input.movementId,
    severity: "critical",
    type: "stock_shortage",
    title: "Stock shortage",
    message: `${input.itemLabel} is out of stock (on-hand 0).`,
    readAt: null,
    createdAt: Date.now()
  });
}

/**
 * Build an INSERT statement for a warning "PO over-receipt" notification.
 */
export function buildPoDiscrepancyNotificationStatement(
  db: ForgeDb,
  input: {
    authUserId: string;
    movementId?: string | null;
    poNumber: string | null;
    itemLabel: string;
    orderedQty: number;
    receivedQty: number;
  }
): BatchItem<"sqlite"> {
  return db.insert(notification).values({
    id: crypto.randomUUID(),
    userId: input.authUserId,
    movementId: input.movementId ?? null,
    severity: "warning",
    type: "po_discrepancy",
    title: "PO over-receipt",
    message: `${input.poNumber ?? "PO"}: received ${input.receivedQty} × ${input.itemLabel} against ${input.orderedQty} ordered.`,
    readAt: null,
    createdAt: Date.now()
  });
}

export async function createNotification(
  db: ForgeDb,
  input: Omit<NotificationInsert, "id" | "createdAt">
): Promise<Notification> {
  const id = crypto.randomUUID();
  await db.insert(notification).values({
    ...input,
    id,
    readAt: null,
    createdAt: Date.now()
  });
  const row = await db.select().from(notification).where(eq(notification.id, id)).get();
  if (!row) throw new Error("Failed to create notification");
  return row;
}

export async function listNotifications(
  db: ForgeDb,
  userId: string,
  params: NotificationListParams
): Promise<NotificationListResponse> {
  const where = and(
    eq(notification.userId, userId),
    params.unreadOnly ? isNull(notification.readAt) : undefined,
    params.severity ? eq(notification.severity, params.severity) : undefined,
    params.type ? eq(notification.type, params.type) : undefined
  );

  const rows = await db
    .select()
    .from(notification)
    .where(where)
    .orderBy(desc(notification.createdAt))
    .limit(params.pageSize)
    .offset(offsetFor(params));

  const totalRow = await db
    .select({ value: count() })
    .from(notification)
    .where(where)
    .get();
  const total = totalRow?.value ?? 0;

  return {
    items: rows.map((r) => ({
      id: r.id,
      userId: r.userId,
      movementId: r.movementId,
      severity: r.severity,
      type: r.type,
      title: r.title,
      message: r.message,
      readAt: r.readAt,
      createdAt: r.createdAt
    })),
    meta: pageMeta(params.page, params.pageSize, total)
  };
}

export async function markNotificationRead(
  db: ForgeDb,
  userId: string,
  notificationId: string
): Promise<Notification> {
  const row = await db
    .select()
    .from(notification)
    .where(and(eq(notification.id, notificationId), eq(notification.userId, userId)))
    .get();
  if (!row) notFound("Notification not found");

  await db
    .update(notification)
    .set({ readAt: row.readAt ?? Date.now() })
    .where(eq(notification.id, notificationId));

  const updated = await db
    .select()
    .from(notification)
    .where(eq(notification.id, notificationId))
    .get();
  return updated!;
}

export async function markAllRead(db: ForgeDb, userId: string): Promise<void> {
  await db
    .update(notification)
    .set({ readAt: Date.now() })
    .where(and(eq(notification.userId, userId), isNull(notification.readAt)));
}

export async function unreadCount(db: ForgeDb, userId: string): Promise<number> {
  const row = await db
    .select({ value: count() })
    .from(notification)
    .where(and(eq(notification.userId, userId), isNull(notification.readAt)))
    .get();
  return Number(row?.value ?? 0);
}
