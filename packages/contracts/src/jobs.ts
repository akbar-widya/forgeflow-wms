import { z } from "zod";
import { paginatedSchema, paginationParamsSchema } from "./common";

export const jobStatusSchema = z.enum([
  "planned",
  "allocated",
  "in_progress",
  "completed",
  "cancelled"
]);

export type JobStatus = z.infer<typeof jobStatusSchema>;

export const bomLineStatusSchema = z.enum([
  "pending",
  "partially_issued",
  "issued",
  "closed"
]);

export type BomLineStatus = z.infer<typeof bomLineStatusSchema>;

export const jobBomLineSchema = z.object({
  id: z.string(),
  jobId: z.string(),
  itemId: z.string(),
  sku: z.string(),
  itemName: z.string(),
  uom: z.string(),
  requiredQty: z.number(),
  issuedQty: z.number(),
  status: bomLineStatusSchema
});

export type JobBomLine = z.infer<typeof jobBomLineSchema>;

export const jobSchema = z.object({
  id: z.string(),
  warehouseId: z.string(),
  warehouseCode: z.string(),
  jobNumber: z.string(),
  workOrderRef: z.string().nullable().default(null),
  status: jobStatusSchema,
  dueDate: z.number().nullable().default(null),
  createdAt: z.number(),
  bomLines: z.array(jobBomLineSchema).default([])
});

export type Job = z.infer<typeof jobSchema>;

export const createJobRequestSchema = z.object({
  warehouseId: z.string().min(1),
  workOrderRef: z.string().max(80).optional(),
  dueDate: z.number().optional(),
  bomLines: z
    .array(
      z.object({
        itemId: z.string().min(1),
        requiredQty: z.number().positive()
      })
    )
    .min(1)
});

export type CreateJobRequest = z.infer<typeof createJobRequestSchema>;

export const updateJobRequestSchema = z.object({
  status: jobStatusSchema.optional(),
  workOrderRef: z.string().max(80).nullable().optional(),
  dueDate: z.number().nullable().optional()
});

export type UpdateJobRequest = z.infer<typeof updateJobRequestSchema>;

export const jobListParamsSchema = paginationParamsSchema.extend({
  status: jobStatusSchema.optional(),
  warehouseId: z.string().optional(),
  search: z.string().optional()
});

export type JobListParams = z.infer<typeof jobListParamsSchema>;

export const jobListResponseSchema = paginatedSchema(jobSchema);

export type JobListResponse = z.infer<typeof jobListResponseSchema>;

export const issuePreviewLineSchema = z.object({
  bomLineId: z.string(),
  availableQty: z.number(),
  recommendedQty: z.number(),
  short: z.boolean(),
  locationId: z.string().nullable(),
  locationCode: z.string().nullable()
});

export type IssuePreviewLine = z.infer<typeof issuePreviewLineSchema>;

export const issuePreviewRequestSchema = z.object({
  jobId: z.string().min(1)
});

export type IssuePreviewRequest = z.infer<typeof issuePreviewRequestSchema>;

export const issuePreviewResponseSchema = z.object({
  jobId: z.string(),
  lines: z.array(issuePreviewLineSchema)
});

export type IssuePreviewResponse = z.infer<typeof issuePreviewResponseSchema>;

export const issueRequestSchema = z.object({
  bomLineId: z.string().min(1),
  sourceLocationId: z.string().min(1),
  lotId: z.string().optional(),
  issueQty: z.number().positive(),
  idempotencyKey: z.string().min(8).max(128).optional()
});

export type IssueRequest = z.infer<typeof issueRequestSchema>;

export const createIssuesRequestSchema = z.object({
  idempotencyKey: z.string().min(8).max(128).optional(),
  lines: z.array(issueRequestSchema).min(1)
});

export type CreateIssuesRequest = z.infer<typeof createIssuesRequestSchema>;

export const scrapReturnRequestSchema = z.object({
  itemId: z.string().min(1),
  lotId: z.string().optional(),
  targetLocationId: z.string().min(1),
  returnQty: z.number().positive(),
  reasonCode: z.string().min(1).max(60),
  idempotencyKey: z.string().min(8).max(128).optional()
});

export type ScrapReturnRequest = z.infer<typeof scrapReturnRequestSchema>;
