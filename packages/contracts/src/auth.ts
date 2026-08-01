import { z } from "zod";
import { roleSchema } from "./roles";

export const authUserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string(),
  emailVerified: z.boolean(),
  image: z.string().nullable().optional()
});

export type AuthUser = z.infer<typeof authUserSchema>;

export const staffProfileSchema = z.object({
  id: z.string(),
  authUserId: z.string(),
  employeeCode: z.string(),
  displayName: z.string(),
  role: roleSchema,
  status: z.string(),
  createdAt: z.number(),
  updatedAt: z.number()
});

export type StaffProfile = z.infer<typeof staffProfileSchema>;

export const sessionUserSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  role: roleSchema,
  staffProfile: staffProfileSchema.nullable()
});

export type SessionUser = z.infer<typeof sessionUserSchema>;

export const signUpRequestSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(128),
  employeeCode: z.string().min(1).max(50).optional(),
  role: roleSchema.optional()
});

export type SignUpRequest = z.infer<typeof signUpRequestSchema>;

export const signInRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

export type SignInRequest = z.infer<typeof signInRequestSchema>;

export const authResponseSchema = z.object({
  user: sessionUserSchema,
  token: z.string().optional()
});

export type AuthResponse = z.infer<typeof authResponseSchema>;

export const meResponseSchema = z.object({
  user: sessionUserSchema
});

export type MeResponse = z.infer<typeof meResponseSchema>;
