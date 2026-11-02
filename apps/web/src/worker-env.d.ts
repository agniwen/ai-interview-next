// 限定 Workers 类型的作用域，避免覆盖浏览器全局类型。Scope Workers types to preserve browser globals.
type Fetcher = Pick<typeof globalThis, "fetch">;

declare module "cloudflare:workers" {
  export const env: Cloudflare.Env;
}
