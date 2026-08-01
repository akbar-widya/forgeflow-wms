import { z } from "zod";

export const roleSchema = z.enum(["operator", "manager", "admin", "auditor"]);

export type Role = z.infer<typeof roleSchema>;

export const roles: Role[] = ["operator", "manager", "admin", "auditor"];

export const staffStatusSchema = z.enum(["active", "inactive", "suspended"]);

export type StaffStatus = z.infer<typeof staffStatusSchema>;
