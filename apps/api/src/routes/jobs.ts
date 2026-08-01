import { Hono } from "hono";
import { and, asc, count, desc, eq, like, or } from "drizzle-orm";
import {
  job,
  jobBomLine,
  item,
  warehouse,
  type ForgeDb
} from "@forgeflow/db";
import {
  createJobRequestSchema,
  updateJobRequestSchema,
  jobListParamsSchema,
  createIssuesRequestSchema,
  scrapReturnRequestSchema,
  type Job
} from "@forgeflow/contracts";
import { getDb } from "../db";
import { authRequired } from "../middleware/auth-required";
import { requireWriteRole } from "../middleware/rbac";
import { validate } from "../middleware/validate";
import type { AppEnv } from "../types";
import { badRequest, notFound } from "../lib/http";
import { offsetFor, pageMeta } from "../lib/pagination";
import { createIssues, createScrapReturn, previewIssues } from "../services/allocation-service";
import { withIdempotency } from "../lib/idempotency";

export const jobRoutes = new Hono<AppEnv>();

jobRoutes.use("*", authRequired);

async function buildJobDto(db: ForgeDb, jobId: string): Promise<Job> {
  const j = await db.select().from(job).where(eq(job.id, jobId)).get();
  if (!j) notFound("Job not found");

  const wh = await db
    .select()
    .from(warehouse)
    .where(eq(warehouse.id, j.warehouseId))
    .get();

  const lines = await db
    .select({
      line: jobBomLine,
      sku: item.sku,
      itemName: item.name,
      uom: item.uom
    })
    .from(jobBomLine)
    .innerJoin(item, eq(jobBomLine.itemId, item.id))
    .where(eq(jobBomLine.jobId, jobId));

  return {
    id: j.id,
    warehouseId: j.warehouseId,
    warehouseCode: wh?.code ?? "",
    jobNumber: j.jobNumber,
    workOrderRef: j.workOrderRef,
    status: j.status,
    dueDate: j.dueDate,
    createdAt: j.createdAt,
    bomLines: lines.map((l) => ({
      id: l.line.id,
      jobId: l.line.jobId,
      itemId: l.line.itemId,
      sku: l.sku,
      itemName: l.itemName,
      uom: l.uom,
      requiredQty: l.line.requiredQty,
      issuedQty: l.line.issuedQty,
      status: l.line.status
    }))
  };
}

jobRoutes.get("/jobs", async (c) => {
  const db: ForgeDb = getDb(c.env);
  const q = c.req.query();
  const params = jobListParamsSchema.parse(q);

  const where = and(
    params.status ? eq(job.status, params.status) : undefined,
    params.warehouseId ? eq(job.warehouseId, params.warehouseId) : undefined,
    params.search
      ? or(
          like(job.jobNumber, `%${params.search}%`),
          like(job.workOrderRef, `%${params.search}%`)
        )
      : undefined
  );

  const rows = await db
    .select()
    .from(job)
    .where(where)
    .orderBy(
      params.direction === "desc" ? desc(job.createdAt) : asc(job.createdAt)
    )
    .limit(params.pageSize)
    .offset(offsetFor(params));

  const totalRow = await db
    .select({ value: count() })
    .from(job)
    .where(where)
    .get();
  const total = totalRow?.value ?? 0;

  const items = [];
  for (const j of rows) {
    items.push(await buildJobDto(db, j.id));
  }

  return c.json({ items, meta: pageMeta(params.page, params.pageSize, total) });
});

jobRoutes.post(
  "/jobs",
  requireWriteRole("manager", "admin"),
  validate(createJobRequestSchema),
  async (c) => {
    const db: ForgeDb = getDb(c.env);
    const input = c.req.valid("json");
    const now = Date.now();
    const jobId = crypto.randomUUID();
    const jobNumber = `JOB-${now.toString(36).toUpperCase()}`;

    const wh = await db
      .select()
      .from(warehouse)
      .where(eq(warehouse.id, input.warehouseId))
      .get();
    if (!wh) badRequest("Warehouse not found", { field: "warehouseId" });

    await db.batch([
      db.insert(job).values({
        id: jobId,
        warehouseId: input.warehouseId,
        jobNumber,
        workOrderRef: input.workOrderRef ?? null,
        status: "planned",
        dueDate: input.dueDate ?? null,
        createdAt: now
      }),
      ...input.bomLines.map((l) =>
        db.insert(jobBomLine).values({
          id: crypto.randomUUID(),
          jobId,
          itemId: l.itemId,
          requiredQty: l.requiredQty,
          issuedQty: 0,
          status: "pending"
        })
      )
    ]);

    return c.json(await buildJobDto(db, jobId), 201);
  }
);

jobRoutes.get("/jobs/:id", async (c) => {
  const db: ForgeDb = getDb(c.env);
  return c.json(await buildJobDto(db, c.req.param("id")));
});

jobRoutes.get("/jobs/:id/bom", async (c) => {
  const db: ForgeDb = getDb(c.env);
  const j = await buildJobDto(db, c.req.param("id"));
  return c.json({ jobId: j.id, lines: j.bomLines });
});

jobRoutes.patch(
  "/jobs/:id",
  requireWriteRole("manager", "admin"),
  validate(updateJobRequestSchema),
  async (c) => {
    const db: ForgeDb = getDb(c.env);
    const id = c.req.param("id");
    const input = c.req.valid("json");
    const j = await db.select().from(job).where(eq(job.id, id)).get();
    if (!j) notFound("Job not found");

    await db
      .update(job)
      .set({
        status: input.status ?? j.status,
        workOrderRef: input.workOrderRef !== undefined ? input.workOrderRef : j.workOrderRef,
        dueDate: input.dueDate !== undefined ? input.dueDate : j.dueDate
      })
      .where(eq(job.id, id));

    return c.json(await buildJobDto(db, id));
  }
);

jobRoutes.post(
  "/jobs/:id/issues/preview",
  requireWriteRole("operator", "manager", "admin"),
  async (c) => {
    const db: ForgeDb = getDb(c.env);
    return c.json(await previewIssues(db, c.req.param("id")));
  }
);

jobRoutes.post(
  "/jobs/:id/issues",
  requireWriteRole("operator", "manager", "admin"),
  validate(createIssuesRequestSchema),
  async (c) => {
    const db: ForgeDb = getDb(c.env);
    const input = c.req.valid("json");
    const staffId = c.get("staffId");
    const jobId = c.req.param("id");
    const idempotencyHeader = c.req.header("Idempotency-Key");

    const result = await withIdempotency(
      db,
      idempotencyHeader,
      "create_job_issues",
      JSON.stringify({ jobId, ...input }),
      () => createIssues(db, jobId, input, staffId)
    );
    return c.json(result);
  }
);

jobRoutes.post(
  "/jobs/:id/scrap-returns",
  requireWriteRole("operator", "manager", "admin"),
  validate(scrapReturnRequestSchema),
  async (c) => {
    const db: ForgeDb = getDb(c.env);
    const input = c.req.valid("json");
    const staffId = c.get("staffId");
    const jobId = c.req.param("id");
    const idempotencyHeader = c.req.header("Idempotency-Key");

    const result = await withIdempotency(
      db,
      idempotencyHeader,
      "create_scrap_return",
      JSON.stringify({ jobId, ...input }),
      () => createScrapReturn(db, jobId, input, staffId)
    );
    return c.json(result, 201);
  }
);
