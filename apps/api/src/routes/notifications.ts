import { Hono } from "hono";
import type { ForgeDb } from "@forgeflow/db";
import { notificationListParamsSchema } from "@forgeflow/contracts";
import { getDb } from "../db";
import { authRequired } from "../middleware/auth-required";
import type { AppEnv } from "../types";
import {
  listNotifications,
  markAllRead,
  markNotificationRead
} from "../services/notification-service";

export const notificationRoutes = new Hono<AppEnv>();

notificationRoutes.use("*", authRequired);

notificationRoutes.get("/notifications", async (c) => {
  const db: ForgeDb = getDb(c.env);
  const q = c.req.query();
  const params = notificationListParamsSchema.parse(q);
  const userId = c.get("authUserId");
  return c.json(await listNotifications(db, userId, params));
});

notificationRoutes.patch("/notifications/:id/read", async (c) => {
  const db: ForgeDb = getDb(c.env);
  const userId = c.get("authUserId");
  return c.json(await markNotificationRead(db, userId, c.req.param("id")));
});

notificationRoutes.patch("/notifications/read-all", async (c) => {
  const db: ForgeDb = getDb(c.env);
  const userId = c.get("authUserId");
  await markAllRead(db, userId);
  return c.json({ ok: true });
});
