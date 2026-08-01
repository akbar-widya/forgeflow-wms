import { relations } from "drizzle-orm";
import {
  authUser,
  authSession,
  authAccount,
  authVerification
} from "./schema/auth";
import { staffProfile } from "./schema/staff";
import { warehouse, zone, location } from "./schema/warehouse";
import { item, itemLot, stockBalance } from "./schema/inventory";
import {
  purchaseOrder,
  purchaseOrderLine,
  receipt,
  receiptLine,
  qualityInspection
} from "./schema/purchasing";
import { job, jobBomLine, jobIssue, scrapReturn } from "./schema/jobs";
import { stockMovement } from "./schema/movements";
import { notification } from "./schema/notifications";
import { idempotencyKey } from "./schema/idempotency";

export const authUserRelations = relations(authUser, ({ one, many }) => ({
  staffProfile: one(staffProfile, {
    fields: [authUser.id],
    references: [staffProfile.authUserId]
  }),
  sessions: many(authSession),
  accounts: many(authAccount),
  notifications: many(notification)
}));

export const authSessionRelations = relations(authSession, ({ one }) => ({
  user: one(authUser, {
    fields: [authSession.userId],
    references: [authUser.id]
  })
}));

export const authAccountRelations = relations(authAccount, ({ one }) => ({
  user: one(authUser, {
    fields: [authAccount.userId],
    references: [authUser.id]
  })
}));

export const authVerificationRelations = relations(authVerification, () => ({}));

export const staffProfileRelations = relations(staffProfile, ({ one, many }) => ({
  user: one(authUser, {
    fields: [staffProfile.authUserId],
    references: [authUser.id]
  }),
  performedMovements: many(stockMovement)
}));

export const warehouseRelations = relations(warehouse, ({ many }) => ({
  zones: many(zone),
  locations: many(location),
  stockBalances: many(stockBalance)
}));

export const zoneRelations = relations(zone, ({ one, many }) => ({
  warehouse: one(warehouse, {
    fields: [zone.warehouseId],
    references: [warehouse.id]
  }),
  locations: many(location)
}));

export const locationRelations = relations(location, ({ one, many }) => ({
  warehouse: one(warehouse, {
    fields: [location.warehouseId],
    references: [warehouse.id]
  }),
  zone: one(zone, {
    fields: [location.zoneId],
    references: [zone.id]
  }),
  stockBalances: many(stockBalance)
}));

export const itemRelations = relations(item, ({ many }) => ({
  lots: many(itemLot),
  stockBalances: many(stockBalance)
}));

export const itemLotRelations = relations(itemLot, ({ one, many }) => ({
  item: one(item, {
    fields: [itemLot.itemId],
    references: [item.id]
  }),
  stockBalances: many(stockBalance)
}));

export const stockBalanceRelations = relations(
  stockBalance,
  ({ one }) => ({
    warehouse: one(warehouse, {
      fields: [stockBalance.warehouseId],
      references: [warehouse.id]
    }),
    location: one(location, {
      fields: [stockBalance.locationId],
      references: [location.id]
    }),
    item: one(item, {
      fields: [stockBalance.itemId],
      references: [item.id]
    }),
    lot: one(itemLot, {
      fields: [stockBalance.lotId],
      references: [itemLot.id]
    })
  })
);

export const purchaseOrderRelations = relations(
  purchaseOrder,
  ({ one, many }) => ({
    warehouse: one(warehouse, {
      fields: [purchaseOrder.warehouseId],
      references: [warehouse.id]
    }),
    lines: many(purchaseOrderLine),
    receipts: many(receipt)
  })
);

export const purchaseOrderLineRelations = relations(
  purchaseOrderLine,
  ({ one }) => ({
    purchaseOrder: one(purchaseOrder, {
      fields: [purchaseOrderLine.purchaseOrderId],
      references: [purchaseOrder.id]
    }),
    item: one(item, {
      fields: [purchaseOrderLine.itemId],
      references: [item.id]
    })
  })
);

export const receiptRelations = relations(receipt, ({ one, many }) => ({
  warehouse: one(warehouse, {
    fields: [receipt.warehouseId],
    references: [warehouse.id]
  }),
  purchaseOrder: one(purchaseOrder, {
    fields: [receipt.purchaseOrderId],
    references: [purchaseOrder.id]
  }),
  lines: many(receiptLine)
}));

export const receiptLineRelations = relations(receiptLine, ({ one }) => ({
  receipt: one(receipt, {
    fields: [receiptLine.receiptId],
    references: [receipt.id]
  }),
  purchaseOrderLine: one(purchaseOrderLine, {
    fields: [receiptLine.purchaseOrderLineId],
    references: [purchaseOrderLine.id]
  }),
  item: one(item, {
    fields: [receiptLine.itemId],
    references: [item.id]
  }),
  lot: one(itemLot, {
    fields: [receiptLine.lotId],
    references: [itemLot.id]
  }),
  targetLocation: one(location, {
    fields: [receiptLine.targetLocationId],
    references: [location.id]
  }),
  inspection: one(qualityInspection, {
    fields: [receiptLine.id],
    references: [qualityInspection.receiptLineId]
  })
}));

export const qualityInspectionRelations = relations(
  qualityInspection,
  ({ one }) => ({
    receiptLine: one(receiptLine, {
      fields: [qualityInspection.receiptLineId],
      references: [receiptLine.id]
    })
  })
);

export const jobRelations = relations(job, ({ one, many }) => ({
  warehouse: one(warehouse, {
    fields: [job.warehouseId],
    references: [warehouse.id]
  }),
  bomLines: many(jobBomLine),
  scrapReturns: many(scrapReturn)
}));

export const jobBomLineRelations = relations(jobBomLine, ({ one, many }) => ({
  job: one(job, {
    fields: [jobBomLine.jobId],
    references: [job.id]
  }),
  item: one(item, {
    fields: [jobBomLine.itemId],
    references: [item.id]
  }),
  issues: many(jobIssue)
}));

export const jobIssueRelations = relations(jobIssue, ({ one }) => ({
  bomLine: one(jobBomLine, {
    fields: [jobIssue.jobBomLineId],
    references: [jobBomLine.id]
  }),
  sourceLocation: one(location, {
    fields: [jobIssue.sourceLocationId],
    references: [location.id]
  })
}));

export const scrapReturnRelations = relations(scrapReturn, ({ one }) => ({
  job: one(job, {
    fields: [scrapReturn.jobId],
    references: [job.id]
  }),
  item: one(item, {
    fields: [scrapReturn.itemId],
    references: [item.id]
  }),
  lot: one(itemLot, {
    fields: [scrapReturn.lotId],
    references: [itemLot.id]
  }),
  targetLocation: one(location, {
    fields: [scrapReturn.targetLocationId],
    references: [location.id]
  })
}));

export const stockMovementRelations = relations(stockMovement, ({ one }) => ({
  warehouse: one(warehouse, {
    fields: [stockMovement.warehouseId],
    references: [warehouse.id]
  }),
  item: one(item, {
    fields: [stockMovement.itemId],
    references: [item.id]
  }),
  lot: one(itemLot, {
    fields: [stockMovement.lotId],
    references: [itemLot.id]
  }),
  fromLocation: one(location, {
    fields: [stockMovement.fromLocationId],
    references: [location.id]
  }),
  toLocation: one(location, {
    fields: [stockMovement.toLocationId],
    references: [location.id]
  }),
  performedByStaff: one(staffProfile, {
    fields: [stockMovement.performedBy],
    references: [staffProfile.id]
  })
}));

export const notificationRelations = relations(notification, ({ one }) => ({
  user: one(authUser, {
    fields: [notification.userId],
    references: [authUser.id]
  }),
  movement: one(stockMovement, {
    fields: [notification.movementId],
    references: [stockMovement.id]
  })
}));

export const idempotencyKeyRelations = relations(idempotencyKey, () => ({}));
