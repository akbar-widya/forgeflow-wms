import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { authUser } from "./auth";

export const staffProfile = sqliteTable("staff_profile", {
  id: text("id").primaryKey(),
  authUserId: text("auth_user_id")
    .notNull()
    .unique()
    .references(() => authUser.id, { onDelete: "cascade" }),
  employeeCode: text("employee_code").notNull().unique(),
  displayName: text("display_name").notNull(),
  role: text("role", { enum: ["operator", "manager", "admin", "auditor"] })
    .notNull()
    .default("operator"),
  status: text("status", { enum: ["active", "inactive", "suspended"] })
    .notNull()
    .default("active"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull()
});
