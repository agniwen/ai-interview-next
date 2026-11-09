import { mcp } from "@better-auth/mcp";
import type { Database } from "@ai-interview/db";
import { APIError } from "better-auth/api";
import { activeGrant, authorization, mcpResource, mcpScopes } from "./access";

export function mcpAuth(baseURL: string, db: Database) {
  return mcp({
    accessTokenExpiresIn: 600,
    allowDynamicClientRegistration: true,
    allowUnauthenticatedClientRegistration: true,
    consentPage: "/mcp/authorize",
    customAccessTokenClaims: async ({ referenceId, user }) => {
      const grant = referenceId && user && (await activeGrant(db, referenceId, user.id));
      if (!grant) {
        throw new APIError("FORBIDDEN", {
          message: "Workspace authorization is no longer active.",
        });
      }
      return { mcp_grant_id: referenceId };
    },
    grantTypes: ["authorization_code", "refresh_token"],
    loginPage: "/mcp/authorize",
    postLogin: {
      consentReferenceId: ({ user }) => {
        const choice = authorization.getStore();
        if (choice?.userId !== user.id) {
          throw new APIError("FORBIDDEN", { message: "Select a workspace to authorize." });
        }
        return choice.grantId;
      },
      page: "/mcp/authorize",
      shouldRedirect: ({ user }) => authorization.getStore()?.userId !== user.id,
    },
    resource: mcpResource(baseURL),
    scopes: [...mcpScopes, "offline_access"],
  });
}
