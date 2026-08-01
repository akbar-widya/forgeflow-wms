import { createMiddleware } from "hono/factory";
import type { Role } from "@forgeflow/contracts";
import { forbidden } from "../lib/http";
import type { AppEnv } from "../types";

export function requireRole(...roles: Role[]) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const role = c.get("role") as Role;
    if (!roles.includes(role)) {
      return forbidden();
    }
    await next();
  });
}

export function requireWriteRole(...roles: Role[]) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const role = c.get("role") as Role;
    if (role === "auditor") {
      return forbidden("Auditor accounts are read-only");
    }
    if (!roles.includes(role)) {
      return forbidden();
    }
    await next();
  });
}
