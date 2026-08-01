import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { staffProfile, type ForgeDb } from "@forgeflow/db";
import { getDb } from "../db";
import { authRequired } from "../middleware/auth-required";
import type { AppEnv } from "../types";
import type { WorkerEnv } from "../env";

export const authRoutes = new Hono<AppEnv>();

export async function getSessionUser(env: WorkerEnv, authUserId: string) {
  const db: ForgeDb = getDb(env);
  const staff = await db
    .select()
    .from(staffProfile)
    .where(eq(staffProfile.authUserId, authUserId))
    .get();
  return staff;
}

authRoutes.get("/me", authRequired, (c) => {
  const staff = c.get("staff") as { id: string; authUserId: string; displayName: string; role: string; employeeCode: string };
  return c.json({
    user: {
      id: c.get("authUserId"),
      email: c.get("authUserEmail"),
      name: staff.displayName,
      role: staff.role,
      staffProfile: staff
    }
  });
});

authRoutes.post("/logout", authRequired, (c) => {
  return c.json({ ok: true });
});
