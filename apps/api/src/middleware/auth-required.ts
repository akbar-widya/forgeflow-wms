import { createMiddleware } from "hono/factory";
import { eq } from "drizzle-orm";
import { staffProfile } from "@forgeflow/db";
import type { ForgeDb } from "@forgeflow/db";
import { getAuth } from "../auth";
import { getDb } from "../db";
import { unauthorized } from "../lib/http";
import type { WorkerEnv } from "../env";
import type { AppEnv } from "../types";

const PUBLIC_PATH_PREFIXES = ["/api/auth", "/api/health", "/api/seed"];

export const authRequired = createMiddleware<AppEnv>(async (c, next) => {
  const pathname = new URL(c.req.url).pathname;
  if (
    PUBLIC_PATH_PREFIXES.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
    )
  ) {
    return next();
  }

  const env = c.env;
  const auth = getAuth(env);
  const session = await auth.api.getSession({ headers: c.req.raw.headers });

  if (!session) {
    return unauthorized();
  }

  const db: ForgeDb = getDb(env);
  const staff = await db
    .select()
    .from(staffProfile)
    .where(eq(staffProfile.authUserId, session.user.id))
    .get();

  if (!staff || staff.status !== "active") {
    return unauthorized("Staff account is not active");
  }

  c.set("authUserId", session.user.id);
  c.set("authUserEmail", session.user.email);
  c.set("staffId", staff.id);
  c.set("role", staff.role);
  c.set("staff", staff);

  await next();
});

export type AuthEnv = {
  Bindings: WorkerEnv;
  Variables: {
    authUserId: string;
    authUserEmail: string;
    staffId: string;
    role: string;
    staff: unknown;
  };
};
