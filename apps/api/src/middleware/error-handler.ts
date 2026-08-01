import type { Context, Next } from "hono";
import { ZodError } from "zod";
import { ApiError, sendError } from "../lib/http";
import type { WorkerEnv } from "../env";

export async function errorHandler(
  err: unknown,
  c: Context<{ Bindings: WorkerEnv }>
) {
  if (err instanceof ApiError) {
    return sendError(c, err);
  }
  if (err instanceof ZodError) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid request",
          details: err.flatten()
        }
      },
      400
    );
  }
  console.error("[unhandled]", err);
  return c.json(
    {
      error: {
        code: "INTERNAL_ERROR",
        message: "Internal server error"
      }
    },
    500
  );
}

export async function logRequests(c: Context, next: Next) {
  const started = Date.now();
  await next();
  const ms = Date.now() - started;
  console.log(
    JSON.stringify({
      method: c.req.method,
      path: c.req.path,
      status: c.res.status,
      ms,
      timestamp: new Date().toISOString()
    })
  );
}
