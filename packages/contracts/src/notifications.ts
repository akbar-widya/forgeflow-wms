import { z } from "zod";
import { paginatedSchema, paginationParamsSchema } from "./common";

export const notificationSeveritySchema = z.enum([
  "info",
  "warning",
  "critical"
]);

export type NotificationSeverity = z.infer<typeof notificationSeveritySchema>;

export const notificationTypeSchema = z.enum([
  "stock_shortage",
  "po_discrepancy",
  "stock_expiry",
  "system"
]);

export type NotificationType = z.infer<typeof notificationTypeSchema>;

export const notificationSchema = z.object({
  id: z.string(),
  userId: z.string(),
  movementId: z.string().nullable(),
  severity: notificationSeveritySchema,
  type: notificationTypeSchema,
  title: z.string(),
  message: z.string(),
  readAt: z.number().nullable(),
  createdAt: z.number()
});

export type Notification = z.infer<typeof notificationSchema>;

export const notificationListParamsSchema = paginationParamsSchema.extend({
  unreadOnly: z.coerce.boolean().optional(),
  severity: notificationSeveritySchema.optional(),
  type: notificationTypeSchema.optional()
});

export type NotificationListParams = z.infer<typeof notificationListParamsSchema>;

export const notificationListResponseSchema = paginatedSchema(notificationSchema);

export type NotificationListResponse = z.infer<
  typeof notificationListResponseSchema
>;
