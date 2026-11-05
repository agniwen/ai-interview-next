// 保持 ambient 声明，避免引入 Workers 全局类型覆盖浏览器类型。
// Keep this an ambient declaration so Workers globals do not override browser types.
/* oxlint-disable typescript/consistent-type-imports */
type DurableObjectNamespace<
  T extends import("@cloudflare/workers-types").Rpc.DurableObjectBranded | undefined = undefined,
> = import("@cloudflare/workers-types").DurableObjectNamespace<T>;
declare module "cloudflare:workers" {
  export const WorkflowEntrypoint: typeof import("@cloudflare/workers-types").CloudflareWorkersModule.WorkflowEntrypoint;
  export type WorkflowEvent<T> =
    import("@cloudflare/workers-types").CloudflareWorkersModule.WorkflowEvent<T>;
  export type WorkflowStep =
    import("@cloudflare/workers-types").CloudflareWorkersModule.WorkflowStep;
  export const DurableObject: typeof import("@cloudflare/workers-types").CloudflareWorkersModule.DurableObject;
}
