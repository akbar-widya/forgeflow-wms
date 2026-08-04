import { createAuthClient } from "better-auth/react";

const API_BASE = import.meta.env.VITE_API_URL ?? import.meta.env.VITE_API_BASE_URL ?? "";

function getBaseURL(): string {
  if (API_BASE) return `${API_BASE}/api/auth`;
  if (typeof window !== "undefined") return `${window.location.origin}/api/auth`;
  return "/api/auth";
}

export const authClient = createAuthClient({
  baseURL: getBaseURL()
});

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image: string | null;
};
