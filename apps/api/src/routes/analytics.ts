import { Hono } from "hono";
import { gte } from "drizzle-orm";
import { stockMovement, type ForgeDb } from "@forgeflow/db";
import { getDb } from "../db";
import { authRequired } from "../middleware/auth-required";
import type { AppEnv } from "../types";

export const analyticsRoutes = new Hono<AppEnv>();

analyticsRoutes.use("*", authRequired);

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

analyticsRoutes.get("/analytics/movements", async (c) => {
  const db: ForgeDb = getDb(c.env);

  const todayStart = startOfDay(new Date());
  const start = todayStart - 6 * DAY_MS;

  const rows = await db
    .select({ qtyDelta: stockMovement.qtyDelta, occurredAt: stockMovement.occurredAt })
    .from(stockMovement)
    .where(gte(stockMovement.occurredAt, start))
    .all();

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start + i * DAY_MS);
    return {
      date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
      label: d.toLocaleDateString("en-US", { month: "short", day: "2-digit" }),
      inbound: 0,
      outbound: 0
    };
  });

  for (const r of rows) {
    const idx = Math.floor((r.occurredAt - start) / DAY_MS);
    if (idx < 0 || idx >= 7) continue;
    const day = days[idx];
    if (!day) continue;
    if (r.qtyDelta >= 0) {
      day.inbound += r.qtyDelta;
    } else {
      day.outbound += -r.qtyDelta;
    }
  }

  return c.json({
    days,
    totalInbound: days.reduce((sum, d) => sum + d.inbound, 0),
    totalOutbound: days.reduce((sum, d) => sum + d.outbound, 0)
  });
});
