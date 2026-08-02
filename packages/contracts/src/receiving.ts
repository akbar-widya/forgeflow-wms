import { z } from "zod";

export const receiptStatusSchema = z.enum(["draft", "inspecting", "posted"]);

export type ReceiptStatus = z.infer<typeof receiptStatusSchema>;

export const inspectionResultSchema = z.enum([
  "pending",
  "accepted",
  "rejected",
  "quarantined"
]);

export type InspectionResult = z.infer<typeof inspectionResultSchema>;

export const discrepancyCodeSchema = z.enum([
  "damaged",
  "wrong_item",
  "wrong_qty",
  "expired",
  "no_issue"
]);

export type DiscrepancyCode = z.infer<typeof discrepancyCodeSchema>;

export const receiptLineSchema = z.object({
  id: z.string(),
  receiptId: z.string(),
  purchaseOrderLineId: z.string().nullable(),
  itemId: z.string(),
  sku: z.string(),
  itemName: z.string(),
  lotId: z.string().nullable(),
  lotCode: z.string().nullable(),
  targetLocationId: z.string().nullable(),
  targetLocationCode: z.string().nullable(),
  receivedQty: z.number(),
  acceptedQty: z.number(),
  rejectedQty: z.number(),
  inspectionResult: inspectionResultSchema.nullable(),
  status: receiptStatusSchema
});

export type ReceiptLine = z.infer<typeof receiptLineSchema>;

export const receiptSchema = z.object({
  id: z.string(),
  warehouseId: z.string(),
  warehouseCode: z.string(),
  purchaseOrderId: z.string().nullable(),
  poNumber: z.string().nullable(),
  receiptNumber: z.string(),
  status: receiptStatusSchema,
  receivedBy: z.string().nullable(),
  receivedAt: z.number().nullable(),
  lines: z.array(receiptLineSchema).default([])
});

export type Receipt = z.infer<typeof receiptSchema>;

export const createReceiptRequestSchema = z.object({
  warehouseId: z.string().min(1),
  purchaseOrderId: z.string().optional(),
  lines: z
    .array(
      z.object({
        purchaseOrderLineId: z.string().optional(),
        itemId: z.string().min(1),
        lotId: z.string().optional(),
        lotCode: z.string().optional(),
        expiryDate: z.number().optional(),
        targetLocationId: z.string().min(1),
        receivedQty: z.number().positive()
      })
    )
    .min(1)
});

export type CreateReceiptRequest = z.infer<typeof createReceiptRequestSchema>;

export const inspectReceiptLineRequestSchema = z.object({
  result: inspectionResultSchema,
  discrepancyCode: discrepancyCodeSchema.optional(),
  notes: z.string().max(500).optional(),
  acceptedQty: z.number().nonnegative().optional(),
  rejectedQty: z.number().nonnegative().optional()
});

export type InspectReceiptLineRequest = z.infer<
  typeof inspectReceiptLineRequestSchema
>;

export const postReceiptRequestSchema = z.object({
  idempotencyKey: z.string().min(8).max(128).optional()
});

export type PostReceiptRequest = z.infer<typeof postReceiptRequestSchema>;

export const batchPostReceiptsRequestSchema = z.object({
  receipts: z
    .array(
      z.object({
        warehouseId: z.string().min(1),
        purchaseOrderId: z.string().min(1),
        lines: z
          .array(
            z.object({
              purchaseOrderLineId: z.string().optional(),
              itemId: z.string().min(1),
              lotCode: z.string().optional(),
              expiryDate: z.number().optional(),
              targetLocationId: z.string().min(1),
              receivedQty: z.number().positive(),
              inspectionResult: z.enum([
                "accepted",
                "rejected",
                "quarantined"
              ]),
              acceptedQty: z.number().nonnegative(),
              rejectedQty: z.number().nonnegative(),
              discrepancyCode: discrepancyCodeSchema.optional(),
              notes: z.string().max(500).optional()
            })
          )
          .min(1)
      })
    )
    .min(1)
});

export type BatchPostReceiptsRequest = z.infer<
  typeof batchPostReceiptsRequestSchema
>;

export const batchPostReceiptsResponseSchema = z.object({
  receipts: z.array(receiptSchema),
  movementCount: z.number()
});

export type BatchPostReceiptsResponse = z.infer<
  typeof batchPostReceiptsResponseSchema
>;
