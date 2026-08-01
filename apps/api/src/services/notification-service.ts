import { and, desc, eq, count, isNull } from "drizzle-orm";
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
