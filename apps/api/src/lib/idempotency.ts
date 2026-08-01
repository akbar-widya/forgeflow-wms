import { eq } from "drizzle-orm";
import { idempotencyKey } from "@forgeflow/db";
import type { ForgeDb } from "@forgeflow/db";
import { conflict } from "./http";

export async function withIdempotency<T>(
  db: ForgeDb,
  key: string | undefined,
  route: string,
  requestHash: string,
  run: () => Promise<T>
): Promise<T> {
  if (!key) {
    return run();
  }
  const existing = await db
    .select()
    .from(idempotencyKey)
    .where(eq(idempotencyKey.key, key))
    .get();

  if (existing) {
    if (existing.requestHash !== requestHash) {
      conflict("Idempotency key reused with different payload", {
        code: "IDEMPOTENCY_KEY_MISMATCH"
      });
    }
    return existing.responseHash
      ? (JSON.parse(existing.responseHash) as T)
      : run();
  }

  const result = await run();
  await db.insert(idempotencyKey).values({
    id: crypto.randomUUID(),
    key,
    route,
    requestHash,
    responseHash: JSON.stringify(result),
    createdAt: Date.now()
  });
  return result;
}
