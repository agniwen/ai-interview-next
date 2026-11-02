import { betterAuth } from "better-auth";
import type { BetterAuthOptions } from "better-auth";

export interface AuthConfig {
  baseURL: string;
  secret: string;
  googleClientId: string;
  googleClientSecret: string;
}

export function authOptions(config: AuthConfig) {
  return {
    appName: "Sainoa",
    baseURL: config.baseURL,
    rateLimit: { storage: "database" },
    secret: config.secret,
    socialProviders: {
      google: {
        clientId: config.googleClientId,
        clientSecret: config.googleClientSecret,
      },
    },
  } satisfies BetterAuthOptions;
}

export function createAuth(config: AuthConfig, database: BetterAuthOptions["database"]) {
  return betterAuth({ ...authOptions(config), database });
}
