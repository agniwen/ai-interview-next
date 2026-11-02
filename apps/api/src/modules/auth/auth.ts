import { createDatabase } from "@ai-interview/db";
import * as schema from "@ai-interview/db/schema";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { z } from "zod";
import type { Database } from "@ai-interview/db";
import type { ApiBindings } from "../../env";

const configSchema = z.object({
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.url(),
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
});

export function createAuth(config: z.infer<typeof configSchema>, database: Database) {
  return betterAuth({
    advanced: { disableCSRFCheck: false, disableOriginCheck: false },
    appName: "Sainoa",
    baseURL: config.BETTER_AUTH_URL,
    database: drizzleAdapter(database, { provider: "sqlite", schema }),
    rateLimit: { storage: "database" },
    secret: config.BETTER_AUTH_SECRET,
    socialProviders: {
      google: {
        clientId: config.GOOGLE_CLIENT_ID,
        clientSecret: config.GOOGLE_CLIENT_SECRET,
      },
    },
  });
}

export function getAuth(env: ApiBindings) {
  const config = configSchema.parse(env);
  return createAuth(config, createDatabase(env.AUTH_DB));
}
