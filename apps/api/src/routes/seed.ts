import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { hashPassword } from "better-auth/crypto";
import {
  authUser,
  authAccount,
  authSession,
  authVerification,
  staffProfile
} from "@forgeflow/db";
import type { ForgeDb } from "@forgeflow/db";
import { getDb } from "../db";
import type { AppEnv } from "../types";

const DEMO_USERS = [
  {
    email: "admin@forgeflow.io",
    password: "admin123",
    name: "Admin User",
    employeeCode: "EMP-001",
    role: "admin" as const
  },
  {
    email: "manager@forgeflow.io",
    password: "manager123",
    name: "Manager User",
    employeeCode: "EMP-002",
    role: "manager" as const
  },
  {
    email: "operator@forgeflow.io",
    password: "operator123",
    name: "Operator User",
    employeeCode: "EMP-003",
    role: "operator" as const
  },
  {
    email: "auditor@forgeflow.io",
    password: "auditor123",
    name: "Auditor User",
    employeeCode: "EMP-004",
    role: "auditor" as const
  }
];

function generateId(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < 26; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

async function seedDemoUsers(db: ForgeDb) {
  // Wipe all existing auth & staff records so stale password hashes (e.g. old
  // bcrypt/other formats) never survive a re-seed. Children first, parents last.
  await db.delete(authSession);
  await db.delete(authAccount);
  await db.delete(staffProfile);
  await db.delete(authVerification);
  await db.delete(authUser);

  const results: { email: string; role: string; created: boolean }[] = [];

  for (const u of DEMO_USERS) {
    const existingUser = await db
      .select()
      .from(authUser)
      .where(eq(authUser.email, u.email))
      .get();

    if (existingUser) {
      results.push({ email: u.email, role: u.role, created: false });
      continue;
    }

    const userId = generateId();
    const staffId = generateId();
    const accountId = generateId();
    const now = new Date();
    const nowMs = now.getTime();
    const passwordHash = await hashPassword(u.password);

    await db.insert(authUser).values({
      id: userId,
      name: u.name,
      email: u.email,
      emailVerified: false,
      createdAt: now,
      updatedAt: now
    });

    await db.insert(authAccount).values({
      id: accountId,
      accountId: userId,
      providerId: "credential",
      userId: userId,
      password: passwordHash,
      createdAt: now,
      updatedAt: now
    });

    await db.insert(staffProfile).values({
      id: staffId,
      authUserId: userId,
      employeeCode: u.employeeCode,
      displayName: u.name,
      role: u.role,
      status: "active",
      createdAt: nowMs,
      updatedAt: nowMs
    });

    results.push({ email: u.email, role: u.role, created: true });
  }

  return results;
}

export const seedRoutes = new Hono<AppEnv>();

seedRoutes.post("/seed", async (c) => {
  const db = getDb(c.env);
  const results = await seedDemoUsers(db);
  return c.json({ seeded: results });
});

seedRoutes.get("/seed/status", async (c) => {
  const db = getDb(c.env);
  const users = await db.select().from(authUser).all();
  const profiles = await db.select().from(staffProfile).all();
  return c.json({
    totalUsers: users.length,
    totalProfiles: profiles.length,
    accounts: profiles.map((p) => ({
      email: users.find((u) => u.id === p.authUserId)?.email ?? "unknown",
      role: p.role,
      employeeCode: p.employeeCode,
      status: p.status
    }))
  });
});