import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { WorkerEnv } from "../env";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown
  ) {
    super(message);
  }
}

export function notFound(message = "Resource not found"): never {
  throw new ApiError(404, "NOT_FOUND", message);
}

export function badRequest(message: string, details?: unknown): never {
  throw new ApiError(400, "BAD_REQUEST", message, details);
}

export function unauthorized(message = "Authentication required"): never {
  throw new ApiError(401, "UNAUTHORIZED", message);
}

export function forbidden(message = "Insufficient permissions"): never {
  throw new ApiError(403, "FORBIDDEN", message);
}

export function conflict(message: string, details?: unknown): never {
  throw new ApiError(409, "CONFLICT", message, details);
}

export function sendError(
  c: Context<{ Bindings: WorkerEnv }>,
  err: ApiError
) {
  return c.json(
    {
      error: {
        code: err.code,
        message: err.message,
        ...(err.details !== undefined ? { details: err.details } : {})
      }
    },
    err.status as ContentfulStatusCode
  );
}
