import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { warehouse } from "./warehouse";
import { item, itemLot } from "./inventory";
import { location } from "./warehouse";

export const job = sqliteTable("job", {
  id: text("id").primaryKey(),
  warehouseId: text("warehouse_id")
    .notNull()
    .references(() => warehouse.id, { onDelete: "cascade" }),
  jobNumber: text("job_number").notNull().unique(),
  workOrderRef: text("work_order_ref"),
  status: text("status", {
    enum: ["planned", "allocated", "in_progress", "completed", "cancelled"]
  })
    .notNull()
    .default("planned"),
  dueDate: integer("due_date"),
  createdAt: integer("created_at").notNull()
});

export const jobBomLine = sqliteTable("job_bom_line", {
  id: text("id").primaryKey(),
  jobId: text("job_id")
    .notNull()
    .references(() => job.id, { onDelete: "cascade" }),
  itemId: text("item_id")
    .notNull()
    .references(() => item.id, { onDelete: "cascade" }),
  requiredQty: real("required_qty").notNull(),
  issuedQty: real("issued_qty").notNull().default(0),
  status: text("status", {
    enum: ["pending", "partially_issued", "issued", "closed"]
  })
    .notNull()
    .default("pending")
});

export const jobIssue = sqliteTable("job_issue", {
  id: text("id").primaryKey(),
  jobBomLineId: text("job_bom_line_id")
    .notNull()
    .references(() => jobBomLine.id, { onDelete: "cascade" }),
  sourceLocationId: text("source_location_id")
    .notNull()
    .references(() => location.id),
  issueQty: real("issue_qty").notNull(),
  issuedBy: text("issued_by"),
  issuedAt: integer("issued_at").notNull()
});

export const scrapReturn = sqliteTable("scrap_return", {
  id: text("id").primaryKey(),
  jobId: text("job_id")
    .notNull()
    .references(() => job.id, { onDelete: "cascade" }),
  itemId: text("item_id")
    .notNull()
    .references(() => item.id, { onDelete: "cascade" }),
  lotId: text("lot_id").references(() => itemLot.id),
  targetLocationId: text("target_location_id")
    .notNull()
    .references(() => location.id),
  returnQty: real("return_qty").notNull(),
  reasonCode: text("reason_code").notNull(),
  returnedBy: text("returned_by"),
  returnedAt: integer("returned_at").notNull()
});
