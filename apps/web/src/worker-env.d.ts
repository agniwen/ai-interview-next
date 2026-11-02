// Keep Workers types scoped so they do not replace browser DOM globals.
// oxlint-disable-next-line typescript/consistent-type-imports
type D1Database = import("@cloudflare/workers-types").D1Database;

declare module "cloudflare:workers" {
  export const env: Cloudflare.Env;
}
