import type {
  authUser,
  authSession,
  authAccount,
  authVerification,
  staffProfile,
  warehouse,
  zone,
  location,
  item,
  itemLot,
  stockBalance,
  purchaseOrder,
  purchaseOrderLine,
  receipt,
  receiptLine,
  qualityInspection,
  job,
  jobBomLine,
  jobIssue,
  scrapReturn,
  stockMovement,
  notification,
  idempotencyKey
} from "./schema";

export type AuthUser = typeof authUser.$inferSelect;
export type AuthUserInsert = typeof authUser.$inferInsert;
export type AuthSession = typeof authSession.$inferSelect;
export type AuthAccount = typeof authAccount.$inferSelect;
export type AuthVerification = typeof authVerification.$inferSelect;
export type StaffProfile = typeof staffProfile.$inferSelect;
export type StaffProfileInsert = typeof staffProfile.$inferInsert;
export type Warehouse = typeof warehouse.$inferSelect;
export type WarehouseInsert = typeof warehouse.$inferInsert;
export type Zone = typeof zone.$inferSelect;
export type Location = typeof location.$inferSelect;
export type LocationInsert = typeof location.$inferInsert;
export type Item = typeof item.$inferSelect;
export type ItemInsert = typeof item.$inferInsert;
export type ItemLot = typeof itemLot.$inferSelect;
export type ItemLotInsert = typeof itemLot.$inferInsert;
export type StockBalance = typeof stockBalance.$inferSelect;
export type StockBalanceInsert = typeof stockBalance.$inferInsert;
export type PurchaseOrder = typeof purchaseOrder.$inferSelect;
export type PurchaseOrderInsert = typeof purchaseOrder.$inferInsert;
export type PurchaseOrderLine = typeof purchaseOrderLine.$inferSelect;
export type Receipt = typeof receipt.$inferSelect;
export type ReceiptInsert = typeof receipt.$inferInsert;
export type ReceiptLine = typeof receiptLine.$inferSelect;
export type ReceiptLineInsert = typeof receiptLine.$inferInsert;
export type QualityInspection = typeof qualityInspection.$inferSelect;
export type Job = typeof job.$inferSelect;
export type JobInsert = typeof job.$inferInsert;
export type JobBomLine = typeof jobBomLine.$inferSelect;
export type JobIssue = typeof jobIssue.$inferSelect;
export type ScrapReturn = typeof scrapReturn.$inferSelect;
export type StockMovement = typeof stockMovement.$inferSelect;
export type StockMovementInsert = typeof stockMovement.$inferInsert;
export type Notification = typeof notification.$inferSelect;
export type NotificationInsert = typeof notification.$inferInsert;
export type IdempotencyKey = typeof idempotencyKey.$inferSelect;
