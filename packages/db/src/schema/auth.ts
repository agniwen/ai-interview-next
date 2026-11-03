import { customType, index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

// 兼容现有 Better Auth D1 数据中的 ISO 日期。Preserve ISO dates in existing Better Auth D1 data.
const date = customType<{ data: Date; driverData: string }>({
  dataType: () => "date",
  fromDriver: (value) => new Date(value),
  toDriver: (value) => value.toISOString(),
});

const bigint = customType<{ data: number; driverData: number }>({
  dataType: () => "bigint",
});

export const user = sqliteTable("user", {
  createdAt: date("createdAt").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("emailVerified", { mode: "boolean" }).notNull(),
  id: text("id").primaryKey(),
  image: text("image"),
  lastWorkspaceId: text("lastWorkspaceId"),
  name: text("name").notNull(),
  updatedAt: date("updatedAt").notNull(),
});

export const session = sqliteTable(
  "session",
  {
    activeOrganizationId: text("activeOrganizationId"),
    createdAt: date("createdAt").notNull(),
    expiresAt: date("expiresAt").notNull(),
    id: text("id").primaryKey(),
    ipAddress: text("ipAddress"),
    token: text("token").notNull().unique(),
    updatedAt: date("updatedAt").notNull(),
    userAgent: text("userAgent"),
    userId: text("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_userId_idx").on(table.userId)],
);

export const account = sqliteTable(
  "account",
  {
    accessToken: text("accessToken"),
    accessTokenExpiresAt: date("accessTokenExpiresAt"),
    accountId: text("accountId").notNull(),
    createdAt: date("createdAt").notNull(),
    id: text("id").primaryKey(),
    idToken: text("idToken"),
    password: text("password"),
    providerId: text("providerId").notNull(),
    refreshToken: text("refreshToken"),
    refreshTokenExpiresAt: date("refreshTokenExpiresAt"),
    scope: text("scope"),
    updatedAt: date("updatedAt").notNull(),
    userId: text("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("account_userId_idx").on(table.userId)],
);

export const verification = sqliteTable(
  "verification",
  {
    createdAt: date("createdAt").notNull(),
    expiresAt: date("expiresAt").notNull(),
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    updatedAt: date("updatedAt").notNull(),
    value: text("value").notNull(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

export const rateLimit = sqliteTable("rateLimit", {
  count: integer("count").notNull(),
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  lastRequest: bigint("lastRequest").notNull(),
});
