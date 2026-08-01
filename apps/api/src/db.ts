import { createDb } from "@forgeflow/db";
import type { WorkerEnv } from "./env";

let dbCache: ReturnType<typeof createDb> | null = null;

export function getDb(env: WorkerEnv) {
  if (!dbCache) {
    dbCache = createDb(env.DB);
  }
  return dbCache;
}
