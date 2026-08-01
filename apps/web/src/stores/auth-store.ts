import { create } from "zustand";

export type Role = "operator" | "manager" | "admin" | "auditor";

type StaffProfile = {
  id: string;
  authUserId: string;
  employeeCode: string;
  displayName: string;
  role: Role;
  status: string;
};

type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  staffProfile?: StaffProfile;
};

type AuthState = {
  me: AuthUser | null;
  status: "loading" | "authenticated" | "unauthenticated";
  setLoading: () => void;
  setAuthenticated: (me: AuthUser) => void;
  setUnauthenticated: () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  me: null,
  status: "loading",
  setLoading: () => set({ status: "loading" }),
  setAuthenticated: (me) => set({ me, status: "authenticated" }),
  setUnauthenticated: () => set({ me: null, status: "unauthenticated" })
}));
