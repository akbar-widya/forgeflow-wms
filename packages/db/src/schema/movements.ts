import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { warehouse } from "./warehouse";
import { item, itemLot } from "./inventory";
import { location } from "./warehouse";
import { staffProfile } from "./staff";

export const stockMovement = sqliteTable("stock_movement", {
  id: text("id").primaryKey(),
  warehouseId: text("warehouse_id")
    .notNull()
    .references(() => warehouse.id, { onDelete: "cascade" }),
  itemId: text("item_id")
    .notNull()
    .references(() => item.id, { onDelete: "cascade" }),
  lotId: text("lot_id").references(() => itemLot.id),
  fromLocationId: text("from_location_id").references(() => location.id),
  toLocationId: text("to_location_id").references(() => location.id),
  qtyDelta: real("qty_delta").notNull(),
  movementType: text("movement_type", {
    enum: ["receive", "issue", "adjust", "transfer", "scrap_return", "correction"]
  }).notNull(),
  referenceType: text("reference_type", {
    enum: ["receipt", "job_issue", "adjustment", "transfer", "scrap_return", "correction"]
  }).notNull(),
  referenceId: text("reference_id"),
  performedBy: text("performed_by").references(() => staffProfile.id),
  occurredAt: integer("occurred_at").notNull()
});
