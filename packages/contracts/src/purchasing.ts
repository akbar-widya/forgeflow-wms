import { z } from "zod";
import { paginatedSchema, paginationParamsSchema } from "./common";

export const poStatusSchema = z.enum([
  "draft",
  "open",
  "partially_received",
  "received",
  "closed",
  "cancelled"
]);

export type PoStatus = z.infer<typeof poStatusSchema>;

export const purchaseOrderLineSchema = z.object({
  id: z.string(),
  purchaseOrderId: z.string(),
  itemId: z.string(),
  sku: z.string(),
  itemName: z.string(),
  orderedQty: z.number(),
  receivedQty: z.number(),
  status: z.string()
});

export type PurchaseOrderLine = z.infer<typeof purchaseOrderLineSchema>;

export const purchaseOrderSchema = z.object({
  id: z.string(),
  warehouseId: z.string(),
  warehouseCode: z.string(),
  poNumber: z.string(),
  supplierName: z.string(),
  status: poStatusSchema,
  expectedDate: z.number().nullable().default(null),
  createdAt: z.number(),
  lines: z.array(purchaseOrderLineSchema).default([])
});

export type PurchaseOrder = z.infer<typeof purchaseOrderSchema>;

export const createPoRequestSchema = z.object({
  warehouseId: z.string().min(1),
  supplierName: z.string().min(1).max(160),
  expectedDate: z.number().optional(),
  lines: z
    .array(
      z.object({
        itemId: z.string().min(1),
        orderedQty: z.number().positive()
      })
    )
    .min(1)
});

export type CreatePoRequest = z.infer<typeof createPoRequestSchema>;

export const updatePoRequestSchema = z.object({
  status: poStatusSchema.optional(),
  supplierName: z.string().min(1).max(160).optional(),
  expectedDate: z.number().nullable().optional()
});

export type UpdatePoRequest = z.infer<typeof updatePoRequestSchema>;

export const poListParamsSchema = paginationParamsSchema.extend({
  status: poStatusSchema.optional(),
  warehouseId: z.string().optional(),
  search: z.string().optional()
});

export type PoListParams = z.infer<typeof poListParamsSchema>;

export const poListResponseSchema = paginatedSchema(purchaseOrderSchema);

export type PoListResponse = z.infer<typeof poListResponseSchema>;
