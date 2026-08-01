import { Hono } from "hono";
import { cors } from "hono/cors";
import { getAuth } from "./auth";
import { validateEnv, type WorkerEnv } from "./env";
import { errorHandler, logRequests } from "./middleware/error-handler";
import { healthRoutes } from "./routes/health";
import { authRoutes } from "./routes/auth";
import { dashboardRoutes } from "./routes/dashboard";
import { warehouseRoutes } from "./routes/warehouses";
import { inventoryRoutes } from "./routes/inventory";
import { purchaseOrderRoutes } from "./routes/purchase-orders";
import { receivingRoutes } from "./routes/receiving";
import { jobRoutes } from "./routes/jobs";
import { movementRoutes } from "./routes/movements";
import { notificationRoutes } from "./routes/notifications";

const app = new Hono<{ Bindings: WorkerEnv }>();

app.use("*", logRequests);
app.use(
  "*",
  cors({
    origin: (origin) => origin,
    credentials: true,
    allowMethods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization", "Idempotency-Key"]
  })
);
app.onError(errorHandler);

app.route("/api", healthRoutes);
app.route("/api", authRoutes);
app.route("/api", dashboardRoutes);
app.route("/api", warehouseRoutes);
app.route("/api", inventoryRoutes);
app.route("/api", purchaseOrderRoutes);
app.route("/api", receivingRoutes);
app.route("/api", jobRoutes);
app.route("/api", movementRoutes);
app.route("/api", notificationRoutes);

app.notFound((c) =>
  c.json(
    {
      error: {
        code: "NOT_FOUND",
        message: `Route not found: ${c.req.method} ${c.req.path}`
      }
    },
    404
  )
);

export default {
  async fetch(
    request: Request,
    env: WorkerEnv,
    ctx: ExecutionContext
  ): Promise<Response> {
    validateEnv(env);

    if (request.url.includes("/api/auth")) {
      return getAuth(env).handler(request);
    }

    return app.fetch(request, env, ctx);
  }
};
