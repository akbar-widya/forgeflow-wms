import type { WorkerEnv } from "./env";

export type AppEnv = {
  Bindings: WorkerEnv;
  Variables: {
    authUserId: string;
    authUserEmail: string;
    staffId: string;
    role: string;
    staff: unknown;
  };
};
