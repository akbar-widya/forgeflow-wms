import { and, eq, isNull } from "drizzle-orm";
import { type BatchItem } from "drizzle-orm/batch";
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
import {
  applySingleLocationMovement,
  buildSingleLocationMovementStatements,
  type BalanceProjection
} from "./movement-service";
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

async function findBalanceByLocationItemLot(
  db: ForgeDb,
  warehouseId: string,
  locationId: string,
  itemId: string,
  lotId: string | null
) {
  return db
    .select()
    .from(stockBalance)
    .where(
      and(
        eq(stockBalance.warehouseId, warehouseId),
        eq(stockBalance.locationId, locationId),
        eq(stockBalance.itemId, itemId),
        lotId ? eq(stockBalance.lotId, lotId) : isNull(stockBalance.lotId)
      )
    )
    .get();
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

  const bomLines = await db
    .select()
    .from(jobBomLine)
    .where(eq(jobBomLine.jobId, jobId));
  const lineById = new Map(bomLines.map((l) => [l.id, l]));

  const now = Date.now();
  const stmts: BatchItem<"sqlite">[] = [];
  const issuedDelta = new Map<string, number>();
  const projected = new Map<string, BalanceProjection>();

  for (const req of input.lines) {
    const bomLine = lineById.get(req.bomLineId);
    if (!bomLine) badRequest("BOM line not found", { bomLineId: req.bomLineId });

    const balance = await findBalanceByLocationItemLot(
      db,
      j.warehouseId,
      req.sourceLocationId,
      bomLine.itemId,
      req.lotId ?? null
    );

    const prev =
      projected.get(balance?.id ?? "") ??
      (balance
        ? {
            id: balance.id,
            onHandQty: balance.onHandQty,
            availableQty: balance.availableQty,
            stockStatus: balance.stockStatus
          }
        : undefined);

    if (!balance || !prev || prev.availableQty < req.issueQty) {
      conflict("Insufficient available stock for issue", {
        code: "INSUFFICIENT_STOCK",
        bomLineId: req.bomLineId,
        availableQty: prev?.availableQty ?? 0
      });
    }

    const onHandQty = prev.onHandQty - req.issueQty;
    const next: BalanceProjection = {
      id: prev.id,
      onHandQty,
      availableQty: onHandQty,
      stockStatus: onHandQty <= 0 ? "out_of_stock" : prev.stockStatus
    };
    projected.set(prev.id, next);

    const { movementId, movementStmt, balanceStmt } =
      buildSingleLocationMovementStatements(
        db,
        {
          warehouseId: j.warehouseId,
          itemId: bomLine.itemId,
          lotId: req.lotId ?? null,
          locationId: req.sourceLocationId,
          qtyDelta: -req.issueQty,
          movementType: "issue",
          referenceType: "job_issue",
          referenceId: jobId,
          performedBy: staffId,
          occurredAt: now
        },
        prev
      );

    stmts.push(movementStmt, balanceStmt);
    issuedDelta.set(bomLine.id, (issuedDelta.get(bomLine.id) ?? 0) + req.issueQty);

    stmts.push(
      db.insert(jobIssue).values({
        id: crypto.randomUUID(),
        jobBomLineId: bomLine.id,
        sourceLocationId: req.sourceLocationId,
        issueQty: req.issueQty,
        issuedBy: staffId,
        issuedAt: now
      })
    );
  }

  for (const [bomLineId, delta] of issuedDelta) {
    const bomLine = lineById.get(bomLineId)!;
    const newIssued = bomLine.issuedQty + delta;
    const lineStatus = newIssued >= bomLine.requiredQty ? "issued" : "partially_issued";
    stmts.push(
      db
        .update(jobBomLine)
        .set({ issuedQty: newIssued, status: lineStatus })
        .where(eq(jobBomLine.id, bomLineId))
    );
  }

  const allLines = bomLines.map((l) => ({
    status: l.status,
    requiredQty: l.requiredQty,
    issuedQty: l.issuedQty + (issuedDelta.get(l.id) ?? 0)
  }));
  const allIssued = allLines.every(
    (l) => l.status === "issued" || l.issuedQty >= l.requiredQty
  );
  stmts.push(
    db
      .update(job)
      .set({ status: allIssued ? "allocated" : "in_progress" })
      .where(eq(job.id, jobId))
  );

  await db.batch(stmts as [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]]);

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
