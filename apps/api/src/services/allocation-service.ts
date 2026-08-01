import { and, eq } from "drizzle-orm";
import {
  job,
  jobBomLine,
  jobIssue,
  scrapReturn,
  location,
  item,
  stockBalance,
  type ForgeDb
} from "@forgeflow/db";
import type {
  CreateIssuesRequest,
  IssuePreviewResponse,
  ScrapReturnRequest
} from "@forgeflow/contracts";
import { badRequest, conflict, notFound } from "../lib/http";
import { applySingleLocationMovement } from "./movement-service";
import { createNotification } from "./notification-service";

export async function previewIssues(
  db: ForgeDb,
  jobId: string
): Promise<IssuePreviewResponse> {
  const j = await db.select().from(job).where(eq(job.id, jobId)).get();
  if (!j) notFound("Job not found");

  const lines = await db
    .select()
    .from(jobBomLine)
    .where(eq(jobBomLine.jobId, jobId));

  const result = [];
  for (const line of lines) {
    const balances = await db
      .select({
        balance: stockBalance,
        item: item,
        location: location
      })
      .from(stockBalance)
      .innerJoin(item, eq(stockBalance.itemId, item.id))
      .innerJoin(location, eq(stockBalance.locationId, location.id))
      .where(eq(stockBalance.itemId, line.itemId));

    const totalAvailable = balances.reduce(
      (sum, b) => sum + b.balance.availableQty,
      0
    );
    const remaining = line.requiredQty - line.issuedQty;
    const best = balances
      .filter((b) => b.balance.availableQty > 0)
      .sort((a, b) => b.balance.availableQty - a.balance.availableQty)[0];

    result.push({
      bomLineId: line.id,
      availableQty: totalAvailable,
      recommendedQty: Math.min(remaining, totalAvailable),
      short: totalAvailable < remaining,
      locationId: best?.balance.locationId ?? null,
      locationCode: best?.location.code ?? null
    });
  }

  return { jobId, lines: result };
}

export async function createIssues(
  db: ForgeDb,
  jobId: string,
  input: CreateIssuesRequest,
  staffId: string
): Promise<IssuePreviewResponse> {
  const j = await db.select().from(job).where(eq(job.id, jobId)).get();
  if (!j) notFound("Job not found");
  if (j.status === "completed" || j.status === "cancelled") {
    conflict(`Cannot issue against ${j.status} job`);
  }

  const movements: string[] = [];
  for (const req of input.lines) {
    const bomLine = await db
      .select()
      .from(jobBomLine)
      .where(and(eq(jobBomLine.id, req.bomLineId), eq(jobBomLine.jobId, jobId)))
      .get();
    if (!bomLine) badRequest("BOM line not found", { bomLineId: req.bomLineId });

    const balance = await db
      .select()
      .from(stockBalance)
      .where(
        and(
          eq(stockBalance.locationId, req.sourceLocationId),
          eq(stockBalance.itemId, bomLine!.itemId)
        )
      )
      .get();
    if (!balance || balance.availableQty < req.issueQty) {
      conflict("Insufficient available stock for issue", {
        code: "INSUFFICIENT_STOCK",
        bomLineId: req.bomLineId,
        availableQty: balance?.availableQty ?? 0
      });
    }

    const movementId = await applySingleLocationMovement({
      db,
      warehouseId: j.warehouseId,
      itemId: bomLine!.itemId,
      lotId: balance!.lotId,
      locationId: req.sourceLocationId,
      qtyDelta: -req.issueQty,
      movementType: "issue",
      referenceType: "job_issue",
      referenceId: jobId,
      performedBy: staffId,
      occurredAt: Date.now()
    });
    movements.push(movementId);

    const newIssued = bomLine!.issuedQty + req.issueQty;
    const lineStatus =
      newIssued >= bomLine!.requiredQty ? "issued" : "partially_issued";
    await db
      .update(jobBomLine)
      .set({ issuedQty: newIssued, status: lineStatus })
      .where(eq(jobBomLine.id, req.bomLineId));

    await db.insert(jobIssue).values({
      id: crypto.randomUUID(),
      jobBomLineId: req.bomLineId,
      sourceLocationId: req.sourceLocationId,
      issueQty: req.issueQty,
      issuedBy: staffId,
      issuedAt: Date.now()
    });
  }

  const allLines = await db
    .select()
    .from(jobBomLine)
    .where(eq(jobBomLine.jobId, jobId));
  const allIssued = allLines.every((l) => l.status === "issued");
  await db
    .update(job)
    .set({ status: allIssued ? "allocated" : "in_progress" })
    .where(eq(job.id, jobId));

  void movements;
  return previewIssues(db, jobId);
}

export async function createScrapReturn(
  db: ForgeDb,
  jobId: string,
  input: ScrapReturnRequest,
  staffId: string
): Promise<{ movementId: string }> {
  const j = await db.select().from(job).where(eq(job.id, jobId)).get();
  if (!j) notFound("Job not found");

  const movementId = await applySingleLocationMovement({
    db,
    warehouseId: j.warehouseId,
    itemId: input.itemId,
    lotId: input.lotId ?? null,
    toLocationId: input.targetLocationId,
    qtyDelta: input.returnQty,
    movementType: "scrap_return",
    referenceType: "scrap_return",
    referenceId: jobId,
    performedBy: staffId,
    occurredAt: Date.now()
  });

  await db.insert(scrapReturn).values({
    id: crypto.randomUUID(),
    jobId,
    itemId: input.itemId,
    lotId: input.lotId ?? null,
    targetLocationId: input.targetLocationId,
    returnQty: input.returnQty,
    reasonCode: input.reasonCode,
    returnedBy: staffId,
    returnedAt: Date.now()
  });

  await createNotification(db, {
    userId: staffId,
    movementId,
    severity: "info",
    type: "system",
    title: "Scrap returned to stock",
    message: `${input.returnQty} units returned (${input.reasonCode}).`
  });

  return { movementId };
}
