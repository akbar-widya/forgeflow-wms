import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

export const warehouse = sqliteTable("warehouse", {
  id: text("id").primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  status: text("status", { enum: ["active", "inactive"] })
    .notNull()
    .default("active"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull()
});

export const zone = sqliteTable("zone", {
  id: text("id").primaryKey(),
  warehouseId: text("warehouse_id")
    .notNull()
    .references(() => warehouse.id, { onDelete: "cascade" }),
  code: text("code").notNull(),
  name: text("name").notNull(),
  type: text("type", {
    enum: ["receiving", "storage", "staging", "shipping", "quarantine"]
  })
    .notNull()
    .default("storage"),
  status: text("status", { enum: ["active", "inactive"] })
    .notNull()
    .default("active")
});

export const location = sqliteTable("location", {
  id: text("id").primaryKey(),
  warehouseId: text("warehouse_id")
    .notNull()
    .references(() => warehouse.id, { onDelete: "cascade" }),
  zoneId: text("zone_id")
    .notNull()
    .references(() => zone.id, { onDelete: "cascade" }),
  code: text("code").notNull().unique(),
  locationType: text("location_type", {
    enum: ["rack", "bin", "floor", "dock", "staging", "quarantine"]
  })
    .notNull()
    .default("rack"),
  capacityQty: real("capacity_qty"),
  status: text("status", { enum: ["active", "inactive", "blocked"] })
    .notNull()
    .default("active")
});
