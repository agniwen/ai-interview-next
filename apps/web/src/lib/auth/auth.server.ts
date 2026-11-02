import { env } from "cloudflare:workers";
import { z } from "zod";
import { createAuth } from "./options";

const configSchema = z.object({
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.url(),
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
});

export function getAuth() {
  const config = configSchema.parse(env);
  return createAuth(
    {
      baseURL: config.BETTER_AUTH_URL,
      googleClientId: config.GOOGLE_CLIENT_ID,
      googleClientSecret: config.GOOGLE_CLIENT_SECRET,
      secret: config.BETTER_AUTH_SECRET,
    },
    env.AUTH_DB,
  );
}
