import { zValidator } from "@hono/zod-validator";
import type { ZodType, ZodTypeDef } from "zod";
import type { ValidationTargets } from "hono";

export function validate<
  T extends ZodType<unknown, ZodTypeDef, unknown>,
  U extends keyof ValidationTargets = "json"
>(schema: T, target: U = "json" as U) {
  return zValidator(target as "json", schema, (result, c) => {
    if (!result.success) {
      return c.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid request",
            details: result.error.flatten()
          }
        },
        400
      );
    }
  });
}
