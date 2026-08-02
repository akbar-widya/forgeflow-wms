import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import * as schema from "@forgeflow/db";
import { getDb } from "./db";
import type { WorkerEnv } from "./env";

let authCache: ReturnType<typeof createAuth> | null = null;

export function createAuth(env: WorkerEnv) {
  const db = getDb(env);
  const isProduction = env.ENVIRONMENT === "production";
  return betterAuth({
    appName: "ForgeFlow WMS",
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: env.TRUSTED_ORIGINS.split(",").filter(Boolean),
    database: drizzleAdapter(db, {
      provider: "sqlite",
      schema: {
        user: schema.authUser,
        session: schema.authSession,
        account: schema.authAccount,
        verification: schema.authVerification
      }
    }),
    emailAndPassword: {
      enabled: true
    },
    advanced: {
      cookiePrefix: "forgeflow",
      useSecureCookies: isProduction,
      defaultCookieAttributes: {
        sameSite: isProduction ? "none" : "lax"
      }
    }
  });
}

export function getAuth(env: WorkerEnv) {
  if (!authCache) {
    authCache = createAuth(env);
  }
  return authCache;
}
