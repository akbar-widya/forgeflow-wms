import { z } from "zod";

export const kpiSchema = z.object({
  totalSkuCount: z.number(),
  totalOnHandQty: z.number(),
  totalWarehouseCount: z.number(),
  lowStockCount: z.number(),
  openPoCount: z.number(),
  openJobCount: z.number(),
  unreadNotificationCount: z.number()
});

export type Kpi = z.infer<typeof kpiSchema>;

export const capacitySliceSchema = z.object({
  warehouseId: z.string(),
  warehouseCode: z.string(),
  warehouseName: z.string(),
  capacityQty: z.number(),
  onHandQty: z.number(),
  utilizationPct: z.number()
});

export type CapacitySlice = z.infer<typeof capacitySliceSchema>;

export const capacityResponseSchema = z.object({
  warehouses: z.array(capacitySliceSchema),
  totalCapacity: z.number(),
  totalOnHand: z.number(),
  overallUtilizationPct: z.number()
});

export type CapacityResponse = z.infer<typeof capacityResponseSchema>;

export const inventorySummaryResponseSchema = z.object({
  items: z.array(
    z.object({
      itemId: z.string(),
      sku: z.string(),
      itemName: z.string(),
      uom: z.string(),
      category: z.string().nullable(),
      totalOnHand: z.number(),
      totalAllocated: z.number(),
      totalAvailable: z.number(),
      stockStatus: z.string()
    })
  )
});

export type InventorySummaryResponse = z.infer<
  typeof inventorySummaryResponseSchema
>;
