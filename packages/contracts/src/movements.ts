import { z } from "zod";
import { paginatedSchema, paginationParamsSchema } from "./common";

export const movementTypeSchema = z.enum([
  "receive",
  "issue",
  "adjust",
  "transfer",
  "scrap_return",
  "correction"
]);

export type MovementType = z.infer<typeof movementTypeSchema>;

export const referenceTypeSchema = z.enum([
  "receipt",
  "job_issue",
  "adjustment",
  "transfer",
  "scrap_return",
  "correction"
]);

export type ReferenceType = z.infer<typeof referenceTypeSchema>;

export const stockMovementSchema = z.object({
  id: z.string(),
  warehouseId: z.string(),
  warehouseCode: z.string(),
  itemId: z.string(),
  sku: z.string(),
  itemName: z.string(),
  lotId: z.string().nullable(),
  lotCode: z.string().nullable(),
  fromLocationId: z.string().nullable(),
  fromLocationCode: z.string().nullable(),
  toLocationId: z.string().nullable(),
  toLocationCode: z.string().nullable(),
  qtyDelta: z.number(),
  movementType: movementTypeSchema,
  referenceType: referenceTypeSchema,
  referenceId: z.string().nullable(),
  performedBy: z.string().nullable(),
  performedByName: z.string().nullable(),
  occurredAt: z.number()
});

export type StockMovement = z.infer<typeof stockMovementSchema>;

export const movementListParamsSchema = paginationParamsSchema.extend({
  warehouseId: z.string().optional(),
  itemId: z.string().optional(),
  lotId: z.string().optional(),
  movementType: movementTypeSchema.optional(),
  referenceType: referenceTypeSchema.optional(),
  fromDate: z.number().optional(),
  toDate: z.number().optional()
});

export type MovementListParams = z.infer<typeof movementListParamsSchema>;

export const movementListResponseSchema = paginatedSchema(stockMovementSchema);

export type MovementListResponse = z.infer<typeof movementListResponseSchema>;

export const adjustmentRequestSchema = z.object({
  itemId: z.string().min(1),
  locationId: z.string().min(1),
  lotId: z.string().optional(),
  newQty: z.number().nonnegative(),
  reason: z.string().min(1).max(200),
  idempotencyKey: z.string().min(8).max(128).optional()
});

export type AdjustmentRequest = z.infer<typeof adjustmentRequestSchema>;

export const transferRequestSchema = z.object({
  itemId: z.string().min(1),
  lotId: z.string().optional(),
  fromLocationId: z.string().min(1),
  toLocationId: z.string().min(1),
  qty: z.number().positive(),
  idempotencyKey: z.string().min(8).max(128).optional()
});

export type TransferRequest = z.infer<typeof transferRequestSchema>;
