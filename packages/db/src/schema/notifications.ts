import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { authUser } from "./auth";
import { stockMovement } from "./movements";

export const notification = sqliteTable("notification", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => authUser.id, { onDelete: "cascade" }),
  movementId: text("movement_id").references(() => stockMovement.id),
  severity: text("severity", { enum: ["info", "warning", "critical"] })
    .notNull()
    .default("info"),
  type: text("type", {
    enum: ["stock_shortage", "po_discrepancy", "stock_expiry", "system"]
  })
    .notNull()
    .default("system"),
  title: text("title").notNull(),
  message: text("message").notNull(),
  readAt: integer("read_at"),
  createdAt: integer("created_at").notNull()
});
