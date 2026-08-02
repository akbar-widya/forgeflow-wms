import { z } from "zod";
import { paginatedSchema, paginationParamsSchema } from "./common";

export const warehouseStatusSchema = z.enum(["active", "inactive"]);

export type WarehouseStatus = z.infer<typeof warehouseStatusSchema>;

export const warehouseSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  status: warehouseStatusSchema,
  createdAt: z.number(),
  updatedAt: z.number()
});

export type Warehouse = z.infer<typeof warehouseSchema>;

export const createWarehouseRequestSchema = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(1).max(120),
  status: warehouseStatusSchema.default("active")
});

export type CreateWarehouseRequest = z.infer<typeof createWarehouseRequestSchema>;

export const warehouseListParamsSchema = paginationParamsSchema.extend({
  status: warehouseStatusSchema.optional(),
  search: z.string().optional()
});

export type WarehouseListParams = z.infer<typeof warehouseListParamsSchema>;

export const warehouseListResponseSchema = paginatedSchema(warehouseSchema);

export type WarehouseListResponse = z.infer<typeof warehouseListResponseSchema>;

export const zoneTypeSchema = z.enum([
  "receiving",
  "storage",
  "staging",
  "shipping",
  "quarantine"
]);

export type ZoneType = z.infer<typeof zoneTypeSchema>;

export const zoneSchema = z.object({
  id: z.string(),
  warehouseId: z.string(),
  code: z.string(),
  name: z.string(),
  type: zoneTypeSchema,
  status: warehouseStatusSchema
});

export type Zone = z.infer<typeof zoneSchema>;

export const createZoneRequestSchema = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(1).max(120),
  type: zoneTypeSchema.default("storage"),
  status: warehouseStatusSchema.default("active")
});

export type CreateZoneRequest = z.infer<typeof createZoneRequestSchema>;

export const locationTypeSchema = z.enum([
  "rack",
  "bin",
  "floor",
  "dock",
  "staging",
  "quarantine"
]);

export type LocationType = z.infer<typeof locationTypeSchema>;

export const locationStatusSchema = z.enum(["active", "inactive", "blocked"]);

export type LocationStatus = z.infer<typeof locationStatusSchema>;

export const locationSchema = z.object({
  id: z.string(),
  warehouseId: z.string(),
  zoneId: z.string(),
  code: z.string(),
  locationType: locationTypeSchema,
  capacityQty: z.number().nullable().default(null),
  status: locationStatusSchema
});

export type Location = z.infer<typeof locationSchema>;

export const createLocationRequestSchema = z.object({
  warehouseId: z.string().min(1),
  zoneId: z.string().min(1),
  code: z.string().min(1).max(40),
  locationType: locationTypeSchema.default("rack"),
  capacityQty: z.number().nonnegative().optional(),
  status: locationStatusSchema.default("active")
});

export type CreateLocationRequest = z.infer<typeof createLocationRequestSchema>;

export const warehouseLocationsResponseSchema = z.object({
  warehouse: warehouseSchema,
  zones: z.array(zoneSchema),
  locations: z.array(locationSchema)
});

export type WarehouseLocationsResponse = z.infer<
  typeof warehouseLocationsResponseSchema
>;

export const locationListItemSchema = locationSchema.extend({
  warehouseCode: z.string(),
  warehouseName: z.string(),
  zoneCode: z.string(),
  zoneName: z.string()
});

export type LocationListItem = z.infer<typeof locationListItemSchema>;

export const locationListResponseSchema = z.object({
  items: z.array(locationListItemSchema)
});

export type LocationListResponse = z.infer<typeof locationListResponseSchema>;

export const zoneListItemSchema = zoneSchema.extend({
  warehouseCode: z.string(),
  warehouseName: z.string()
});

export type ZoneListItem = z.infer<typeof zoneListItemSchema>;

export const zoneListResponseSchema = z.object({
  items: z.array(zoneListItemSchema)
});

export type ZoneListResponse = z.infer<typeof zoneListResponseSchema>;
