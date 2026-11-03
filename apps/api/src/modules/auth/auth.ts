import { createDatabase } from "@ai-interview/db";
import * as schema from "@ai-interview/db/schema";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization } from "better-auth/plugins";
import { z } from "zod";
import type { Database } from "@ai-interview/db";
import type { ApiBindings } from "../../env";
import { createInitialWorkspace, generateWorkspaceId } from "../workspaces/service";

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
    databaseHooks: {
      user: { create: { after: (user) => createInitialWorkspace(database, user) } },
    },
    plugins: [
      organization({
        organizationHooks: {
          beforeCreateOrganization: async () => {
            const id = await generateWorkspaceId(database);
            return { data: { id, slug: id } };
          },
        },
      }),
    ],
    rateLimit: { storage: "database" },
    secret: config.BETTER_AUTH_SECRET,
    socialProviders: {
      google: {
        clientId: config.GOOGLE_CLIENT_ID,
        clientSecret: config.GOOGLE_CLIENT_SECRET,
      },
    },
    user: {
      additionalFields: { lastWorkspaceId: { input: false, required: false, type: "string" } },
    },
  });
}

export function getAuth(env: ApiBindings, database = createDatabase(env.AUTH_DB)) {
  const config = configSchema.parse(env);
  return createAuth(config, database);
}
