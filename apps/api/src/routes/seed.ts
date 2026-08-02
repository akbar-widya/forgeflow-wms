import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { hashPassword } from "better-auth/crypto";
import type { BatchItem } from "drizzle-orm/batch";
import {
  authUser,
  authAccount,
  authSession,
  authVerification,
  staffProfile,
  warehouse,
  zone,
  location,
  item,
  stockMovement,
  notification
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

async function seedDemoMovements(db: ForgeDb) {
  await db.delete(notification);
  await db.delete(stockMovement);

  const now = Date.now();
  const existingWarehouses = await db.select().from(warehouse).all();
  if (existingWarehouses.length === 0) {
    await db.insert(warehouse).values([
      {
        id: crypto.randomUUID(),
        code: "WH-DEMO-01",
        name: "Demo Warehouse A",
        status: "active",
        createdAt: now,
        updatedAt: now
      },
      {
        id: crypto.randomUUID(),
        code: "WH-DEMO-02",
        name: "Demo Warehouse B",
        status: "active",
        createdAt: now,
        updatedAt: now
      }
    ]);
  }

  const warehouses = await db.select().from(warehouse).all();

  const existingZones = await db.select().from(zone).all();
  if (existingZones.length === 0) {
    await db
      .insert(zone)
      .values(
        warehouses.map(
          (w): typeof zone.$inferInsert => ({
            id: crypto.randomUUID(),
            warehouseId: w.id,
            code: "Z-DEMO",
            name: "Demo Zone",
            type: "storage",
            status: "active"
          })
        )
      );
  }

  const zones = await db.select().from(zone).all();

  const existingLocations = await db.select().from(location).all();
  if (existingLocations.length === 0) {
    const locationValues: (typeof location.$inferInsert)[] = [];
    for (const w of warehouses) {
      const zoneForWarehouse = zones.find((z) => z.warehouseId === w.id);
      if (!zoneForWarehouse) continue;
      const index = locationValues.length / 2;
      locationValues.push(
        {
          id: crypto.randomUUID(),
          warehouseId: w.id,
          zoneId: zoneForWarehouse.id,
          code: `LOC-DEMO-0${index * 2 + 1}`,
          locationType: "rack",
          capacityQty: 5000,
          status: "active"
        },
        {
          id: crypto.randomUUID(),
          warehouseId: w.id,
          zoneId: zoneForWarehouse.id,
          code: `LOC-DEMO-0${index * 2 + 2}`,
          locationType: "rack",
          capacityQty: 5000,
          status: "active"
        }
      );
    }
    await db.insert(location).values(locationValues);
  }

  const locations = await db.select().from(location).all();

  const existingItems = await db.select().from(item).all();
  if (existingItems.length === 0) {
    await db.insert(item).values([
      {
        id: crypto.randomUUID(),
        sku: "SKU-DEMO-001",
        name: "Demo Component A",
        uom: "pcs",
        category: "components",
        lotTracked: false,
        expiryTracked: false,
        serialTracked: false,
        reorderPoint: 50,
        status: "active",
        createdAt: now
      },
      {
        id: crypto.randomUUID(),
        sku: "SKU-DEMO-002",
        name: "Demo Component B",
        uom: "pcs",
        category: "components",
        lotTracked: false,
        expiryTracked: false,
        serialTracked: false,
        reorderPoint: 50,
        status: "active",
        createdAt: now
      },
      {
        id: crypto.randomUUID(),
        sku: "SKU-DEMO-003",
        name: "Demo Component C",
        uom: "pcs",
        category: "components",
        lotTracked: false,
        expiryTracked: false,
        serialTracked: false,
        reorderPoint: 50,
        status: "active",
        createdAt: now
      },
      {
        id: crypto.randomUUID(),
        sku: "SKU-DEMO-004",
        name: "Demo Component D",
        uom: "pcs",
        category: "components",
        lotTracked: false,
        expiryTracked: false,
        serialTracked: false,
        reorderPoint: 50,
        status: "active",
        createdAt: now
      }
    ]);
  }

  const items = await db.select().from(item).all();
  const staff = await db.select().from(staffProfile).all();
  const performedBy = staff[0]?.id ?? null;

  const DAY_MS = 24 * 60 * 60 * 1000;
  const startOfDay = (d: Date): number =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

  const daily = [
    { inbound: 240, outbound: 120 },
    { inbound: 180, outbound: 210 },
    { inbound: 320, outbound: 150 },
    { inbound: 150, outbound: 260 },
    { inbound: 270, outbound: 90 },
    { inbound: 210, outbound: 180 },
    { inbound: 190, outbound: 230 }
  ];

  const stmts: BatchItem<"sqlite">[] = [];

  for (let i = 0; i < 7; i++) {
    const dayStart = startOfDay(new Date()) - (6 - i) * DAY_MS;

    stmts.push(
      db.insert(stockMovement).values({
        id: crypto.randomUUID(),
        warehouseId: warehouses[i % warehouses.length]!.id,
        itemId: items[i % items.length]!.id,
        lotId: null,
        fromLocationId: null,
        toLocationId: locations[i % locations.length]!.id,
        qtyDelta: daily[i]!.inbound,
        movementType: "receive",
        referenceType: "receipt",
        referenceId: null,
        performedBy,
        occurredAt: dayStart + 8 * 3600 * 1000 + 30 * 60 * 1000
      })
    );

    stmts.push(
      db.insert(stockMovement).values({
        id: crypto.randomUUID(),
        warehouseId: warehouses[i % warehouses.length]!.id,
        itemId: items[(i + 1) % items.length]!.id,
        lotId: null,
        fromLocationId: locations[(i + 1) % locations.length]!.id,
        toLocationId: null,
        qtyDelta: -daily[i]!.outbound,
        movementType: "issue",
        referenceType: "job_issue",
        referenceId: null,
        performedBy,
        occurredAt: dayStart + 13 * 3600 * 1000 + 15 * 60 * 1000
      })
    );
  }

  await db.batch(stmts as [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]]);

  return stmts.length;
}

export const seedRoutes = new Hono<AppEnv>();

seedRoutes.post("/seed", async (c) => {
  const db = getDb(c.env);
  const results = await seedDemoUsers(db);
  const movements = await seedDemoMovements(db);
  return c.json({ seeded: results, movements });
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