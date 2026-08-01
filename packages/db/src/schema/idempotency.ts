import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const idempotencyKey = sqliteTable("idempotency_key", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  route: text("route").notNull(),
  requestHash: text("request_hash").notNull(),
  responseHash: text("response_hash"),
  createdAt: integer("created_at").notNull()
});
