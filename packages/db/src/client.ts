import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";
import * as relations from "./relations";

export type D1Database = import("@cloudflare/workers-types").D1Database;

export function createDb(binding: D1Database) {
  return drizzle(binding, { schema: { ...schema, ...relations } });
}

export type ForgeDb = ReturnType<typeof createDb>;
