import { z } from "zod";

const envSchema = z.object({
  ENVIRONMENT: z.string().default("development"),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.string().url(),
  TRUSTED_ORIGINS: z.string().default("http://localhost:5173")
});

export type WorkerEnv = {
  DB: D1Database;
  ENVIRONMENT: string;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
  TRUSTED_ORIGINS: string;
};

export function validateEnv(env: WorkerEnv): WorkerEnv {
  const parsed = envSchema.safeParse({
    ENVIRONMENT: env.ENVIRONMENT,
    BETTER_AUTH_SECRET: env.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: env.BETTER_AUTH_URL,
    TRUSTED_ORIGINS: env.TRUSTED_ORIGINS
  });
  if (!parsed.success) {
    throw new Error(
      `Invalid environment configuration: ${parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join(", ")}`
    );
  }
  return env;
}
