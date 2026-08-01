import { z } from "zod";
import { paginatedSchema, paginationParamsSchema } from "./common";

export const itemStatusSchema = z.enum(["active", "inactive", "discontinued"]);

export type ItemStatus = z.infer<typeof itemStatusSchema>;

export const itemSchema = z.object({
  id: z.string(),
  sku: z.string(),
  name: z.string(),
  uom: z.string(),
  category: z.string().nullable().default(null),
  lotTracked: z.boolean(),
  expiryTracked: z.boolean(),
  serialTracked: z.boolean(),
  reorderPoint: z.number().nullable().default(null),
  status: itemStatusSchema
});

export type Item = z.infer<typeof itemSchema>;

export const createItemRequestSchema = z.object({
  sku: z.string().min(1).max(40),
  name: z.string().min(1).max(120),
  uom: z.string().min(1).max(10),
  category: z.string().max(60).optional(),
  lotTracked: z.boolean().default(false),
  expiryTracked: z.boolean().default(false),
  reorderPoint: z.number().nonnegative().optional(),
  status: itemStatusSchema.default("active")
});

export type CreateItemRequest = z.infer<typeof createItemRequestSchema>;

export const updateItemRequestSchema = createItemRequestSchema
  .omit({ sku: true })
  .partial()
  .extend({
    sku: z.string().min(1).max(40).optional()
  });

export type UpdateItemRequest = z.infer<typeof updateItemRequestSchema>;

export const itemListParamsSchema = paginationParamsSchema.extend({
  status: itemStatusSchema.optional(),
  category: z.string().optional(),
  search: z.string().optional()
});

export type ItemListParams = z.infer<typeof itemListParamsSchema>;

export const itemListResponseSchema = paginatedSchema(itemSchema);

export type ItemListResponse = z.infer<typeof itemListResponseSchema>;

export const stockStatusSchema = z.enum([
  "available",
  "low",
  "out_of_stock",
  "quarantined",
  "reserved"
]);

export type StockStatus = z.infer<typeof stockStatusSchema>;

export const stockBalanceSchema = z.object({
  id: z.string(),
  warehouseId: z.string(),
  warehouseCode: z.string(),
  locationId: z.string(),
  locationCode: z.string(),
  itemId: z.string(),
  sku: z.string(),
  itemName: z.string(),
  uom: z.string(),
  lotId: z.string().nullable(),
  lotCode: z.string().nullable(),
  expiryDate: z.number().nullable(),
  onHandQty: z.number(),
  allocatedQty: z.number(),
  availableQty: z.number(),
  stockStatus: stockStatusSchema,
  updatedAt: z.number()
});

export type StockBalance = z.infer<typeof stockBalanceSchema>;

export const stockBalanceListParamsSchema = paginationParamsSchema.extend({
  warehouseId: z.string().optional(),
  locationId: z.string().optional(),
  itemId: z.string().optional(),
  lotId: z.string().optional(),
  stockStatus: stockStatusSchema.optional(),
  search: z.string().optional()
});

export type StockBalanceListParams = z.infer<typeof stockBalanceListParamsSchema>;

export const stockBalanceListResponseSchema = paginatedSchema(stockBalanceSchema);

export type StockBalanceListResponse = z.infer<
  typeof stockBalanceListResponseSchema
>;

export const inventorySummaryRowSchema = z.object({
  itemId: z.string(),
  sku: z.string(),
  itemName: z.string(),
  uom: z.string(),
  category: z.string().nullable(),
  totalOnHand: z.number(),
  totalAllocated: z.number(),
  totalAvailable: z.number(),
  stockStatus: stockStatusSchema
});

export type InventorySummaryRow = z.infer<typeof inventorySummaryRowSchema>;
