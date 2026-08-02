import { Hono } from "hono";
import type { ForgeDb } from "@forgeflow/db";
import {
  createReceiptRequestSchema,
  inspectReceiptLineRequestSchema,
  batchPostReceiptsRequestSchema
} from "@forgeflow/contracts";
import { getDb } from "../db";
import { authRequired } from "../middleware/auth-required";
import { requireWriteRole } from "../middleware/rbac";
import { validate } from "../middleware/validate";
import type { AppEnv } from "../types";
import {
  buildReceiptDto,
  batchPostReceipts,
  createReceipt,
  inspectReceiptLine,
  postReceipt
} from "../services/receiving-service";
import { withIdempotency } from "../lib/idempotency";

export const receivingRoutes = new Hono<AppEnv>();

receivingRoutes.use("*", authRequired);

receivingRoutes.post(
  "/receipts",
  requireWriteRole("operator", "manager", "admin"),
  validate(createReceiptRequestSchema),
  async (c) => {
    const db: ForgeDb = getDb(c.env);
    const input = c.req.valid("json");
    const staffId = c.get("staffId");
    const idempotencyHeader = c.req.header("Idempotency-Key");

    const receipt = await withIdempotency(
      db,
      idempotencyHeader,
      "create_receipt",
      JSON.stringify(input),
      () => createReceipt(db, input, staffId)
    );
    return c.json(receipt, 201);
  }
);

receivingRoutes.post(
  "/receipts/batch-post",
  requireWriteRole("operator", "manager", "admin"),
  validate(batchPostReceiptsRequestSchema),
  async (c) => {
    const db: ForgeDb = getDb(c.env);
    const input = c.req.valid("json");
    const staffId = c.get("staffId");
    const idempotencyHeader = c.req.header("Idempotency-Key");

    const result = await withIdempotency(
      db,
      idempotencyHeader,
      "batch_post_receipts",
      JSON.stringify(input),
      () => batchPostReceipts(db, input, staffId)
    );
    return c.json(result, 201);
  }
);

receivingRoutes.get("/receipts/:id", async (c) => {
  const db: ForgeDb = getDb(c.env);
  return c.json(await buildReceiptDto(db, c.req.param("id")));
});

receivingRoutes.post(
  "/receipts/:id/lines/:lineId/inspect",
  requireWriteRole("operator", "manager", "admin"),
  validate(inspectReceiptLineRequestSchema),
  async (c) => {
    const db: ForgeDb = getDb(c.env);
    const input = c.req.valid("json");
    const staffId = c.get("staffId");
    const receipt = await inspectReceiptLine(
      db,
      c.req.param("id"),
      c.req.param("lineId"),
      input,
      staffId
    );
    return c.json(receipt);
  }
);

receivingRoutes.post(
  "/receipts/:id/post",
  requireWriteRole("operator", "manager", "admin"),
  async (c) => {
    const db: ForgeDb = getDb(c.env);
    const staffId = c.get("staffId");
    const idempotencyHeader = c.req.header("Idempotency-Key");
    const id = c.req.param("id");

    const result = await withIdempotency(
      db,
      idempotencyHeader,
      "post_receipt",
      id,
      () => postReceipt(db, id, staffId)
    );
    return c.json(result);
  }
);
