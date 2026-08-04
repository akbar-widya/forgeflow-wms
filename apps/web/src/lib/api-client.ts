import type { ApiError } from "@forgeflow/contracts";

const API_BASE = import.meta.env.VITE_API_URL ?? import.meta.env.VITE_API_BASE_URL ?? "";

export class ApiClientError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (res.status === 401) {
    throw new ApiClientError(401, "UNAUTHORIZED", "Authentication required");
  }
  if (res.status === 204) {
    return undefined as T;
  }

  const contentType = res.headers.get("content-type") ?? "";

  // A JSON API must never return a non-JSON body. This rejects HTML/SPA
  // fallback responses (e.g. a wrong API base URL that resolves to the static
  // site) so the caller sees a real error instead of an empty shell.
  if (!contentType.includes("application/json")) {
    throw new ApiClientError(
      res.status,
      "INVALID_RESPONSE",
      `Expected JSON but received ${contentType || "unknown content type"} (status ${res.status})`
    );
  }

  const data = (await res.json().catch(() => ({}))) as T & { error?: ApiError["error"] };
  if (!res.ok) {
    const err = data?.error;
    throw new ApiClientError(
      res.status,
      err?.code ?? "REQUEST_FAILED",
      err?.message ?? `Request failed with status ${res.status}`,
      err?.details
    );
  }
  return data;
}

export type QueryParams = Record<string, string | number | boolean | null | undefined>;

function buildQuery(params?: QueryParams): string {
  if (!params) return "";
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    sp.set(k, String(v));
  }
  const qs = sp.toString();
  return qs ? `?${qs}` : "";
}

export async function apiGet<T>(path: string, params?: QueryParams): Promise<T> {
  const res = await fetch(`${API_BASE}${path}${buildQuery(params)}`, {
    credentials: "include",
    headers: { Accept: "application/json" }
  });
  return handleResponse<T>(res);
}

export async function apiPost<T>(
  path: string,
  body?: unknown,
  idempotencyKey?: string
): Promise<T> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json"
  };
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    credentials: "include",
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  return handleResponse<T>(res);
}

export async function apiPatch<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "PATCH",
    credentials: "include",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json"
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  return handleResponse<T>(res);
}

export function getErrorMessage(err: unknown): string {
  if (err instanceof ApiClientError) return err.message;
  if (err instanceof Error) return err.message;
  return "An unexpected error occurred";
}

export function genIdempotencyKey(): string {
  return `fid-${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}`;
}
