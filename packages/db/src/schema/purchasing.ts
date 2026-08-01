import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { warehouse } from "./warehouse";
import { item, itemLot } from "./inventory";
import { location } from "./warehouse";

export const purchaseOrder = sqliteTable("purchase_order", {
  id: text("id").primaryKey(),
  warehouseId: text("warehouse_id")
    .notNull()
    .references(() => warehouse.id, { onDelete: "cascade" }),
  poNumber: text("po_number").notNull().unique(),
  supplierName: text("supplier_name").notNull(),
  status: text("status", {
    enum: [
      "draft",
      "open",
      "partially_received",
      "received",
      "closed",
      "cancelled"
    ]
  })
    .notNull()
    .default("open"),
  expectedDate: integer("expected_date"),
  createdAt: integer("created_at").notNull()
});

export const purchaseOrderLine = sqliteTable("purchase_order_line", {
  id: text("id").primaryKey(),
  purchaseOrderId: text("purchase_order_id")
    .notNull()
    .references(() => purchaseOrder.id, { onDelete: "cascade" }),
  itemId: text("item_id")
    .notNull()
    .references(() => item.id, { onDelete: "cascade" }),
  orderedQty: real("ordered_qty").notNull(),
  receivedQty: real("received_qty").notNull().default(0),
  status: text("status", {
    enum: ["pending", "partially_received", "received", "closed"]
  })
    .notNull()
    .default("pending")
});

export const receipt = sqliteTable("receipt", {
  id: text("id").primaryKey(),
  warehouseId: text("warehouse_id")
    .notNull()
    .references(() => warehouse.id, { onDelete: "cascade" }),
  purchaseOrderId: text("purchase_order_id").references(() => purchaseOrder.id),
  receiptNumber: text("receipt_number").notNull().unique(),
  status: text("status", { enum: ["draft", "inspecting", "posted"] })
    .notNull()
    .default("draft"),
  receivedBy: text("received_by"),
  receivedAt: integer("received_at")
});

export const receiptLine = sqliteTable("receipt_line", {
  id: text("id").primaryKey(),
  receiptId: text("receipt_id")
    .notNull()
    .references(() => receipt.id, { onDelete: "cascade" }),
  purchaseOrderLineId: text("purchase_order_line_id").references(
    () => purchaseOrderLine.id
  ),
  itemId: text("item_id")
    .notNull()
    .references(() => item.id, { onDelete: "cascade" }),
  lotId: text("lot_id").references(() => itemLot.id),
  targetLocationId: text("target_location_id").references(() => location.id),
  receivedQty: real("received_qty").notNull(),
  acceptedQty: real("accepted_qty").notNull().default(0),
  rejectedQty: real("rejected_qty").notNull().default(0),
  status: text("status", { enum: ["draft", "inspecting", "posted"] })
    .notNull()
    .default("draft")
});

export const qualityInspection = sqliteTable("quality_inspection", {
  id: text("id").primaryKey(),
  receiptLineId: text("receipt_line_id")
    .notNull()
    .references(() => receiptLine.id, { onDelete: "cascade" }),
  result: text("result", {
    enum: ["pending", "accepted", "rejected", "quarantined"]
  })
    .notNull()
    .default("pending"),
  discrepancyCode: text("discrepancy_code", {
    enum: ["damaged", "wrong_item", "wrong_qty", "expired", "no_issue"]
  }),
  notes: text("notes"),
  inspectedBy: text("inspected_by"),
  inspectedAt: integer("inspected_at")
});
