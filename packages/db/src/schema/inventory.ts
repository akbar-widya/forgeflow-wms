import { sqliteTable, text, integer, real, uniqueIndex } from "drizzle-orm/sqlite-core";
import { warehouse } from "./warehouse";
import { location } from "./warehouse";

export const item = sqliteTable("item", {
  id: text("id").primaryKey(),
  sku: text("sku").notNull().unique(),
  name: text("name").notNull(),
  uom: text("uom").notNull(),
  category: text("category"),
  lotTracked: integer("lot_tracked", { mode: "boolean" })
    .notNull()
    .default(false),
  expiryTracked: integer("expiry_tracked", { mode: "boolean" })
    .notNull()
    .default(false),
  serialTracked: integer("serial_tracked", { mode: "boolean" })
    .notNull()
    .default(false),
  reorderPoint: real("reorder_point"),
  status: text("status", { enum: ["active", "inactive", "discontinued"] })
    .notNull()
    .default("active"),
  createdAt: integer("created_at").notNull()
});

export const itemLot = sqliteTable("item_lot", {
  id: text("id").primaryKey(),
  itemId: text("item_id")
    .notNull()
    .references(() => item.id, { onDelete: "cascade" }),
  lotCode: text("lot_code").notNull(),
  expiryDate: integer("expiry_date"),
  qualityStatus: text("quality_status", {
    enum: ["available", "quarantined", "expired", "consumed"]
  })
    .notNull()
    .default("available"),
  createdAt: integer("created_at").notNull()
});

export const stockBalance = sqliteTable(
  "stock_balance",
  {
    id: text("id").primaryKey(),
    warehouseId: text("warehouse_id")
      .notNull()
      .references(() => warehouse.id, { onDelete: "cascade" }),
    locationId: text("location_id")
      .notNull()
      .references(() => location.id, { onDelete: "cascade" }),
    itemId: text("item_id")
      .notNull()
      .references(() => item.id, { onDelete: "cascade" }),
    lotId: text("lot_id").references(() => itemLot.id),
    onHandQty: real("on_hand_qty").notNull().default(0),
    allocatedQty: real("allocated_qty").notNull().default(0),
    availableQty: real("available_qty").notNull().default(0),
    stockStatus: text("stock_status", {
      enum: ["available", "low", "out_of_stock", "quarantined", "reserved"]
    })
      .notNull()
      .default("out_of_stock"),
    updatedAt: integer("updated_at").notNull()
  },
  (table) => ({
    uniqueKey: uniqueIndex("stock_balance_unique_key").on(
      table.warehouseId,
      table.locationId,
      table.itemId,
      table.lotId
    )
  })
);
