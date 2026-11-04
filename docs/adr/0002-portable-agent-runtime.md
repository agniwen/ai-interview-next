# 为 Agent 保留自主部署能力

Agent 使用 pi-durable，当前以 Cloudflare Durable Object 作为运行宿主，但业务逻辑不直接依赖 Cloudflare API。保留未来使用常驻 Node/Bun 服务自主部署的能力；是否迁移、何时迁移，以及届时选择 SQLite、PostgreSQL 或 Redis，均不预先确定，所选后端需提供相应适配。目标是让更换基础设施时页面和业务 API 保持稳定，而不是承诺只修改存储连接地址即可迁移。

`lib/redis` 仅用于适合 Redis 语义的实际数据需求，不作为整个 Agent 基础设施的抽象。pi-durable 的存储适配与 Agent 的执行、恢复、停止、订阅及定时唤醒分别隔离；Cloudflare 专有的存储、连接管理和唤醒能力集中在适配层。Durable Object 同时承担计算、存储和协调，未来更换宿主需提供相应的任务执行权与接管、连接和调度能力，单独引入 Redis 不能替代这些职责。

当前不预先实现 Redis 后端，也不把运行时操作伪装成 Redis 命令。pi-durable 的原子提交语义必须由存储适配保留，不能降级为互不关联的键值写入。

参考：[pi-durable 存储接口](https://github.com/earendil-works/pi/blob/main/packages/durable/README.md#storage)、[官方 Cloudflare 示例](https://github.com/earendil-works/pi-durable-cloudflare)、[Durable Objects 职责](https://developers.cloudflare.com/durable-objects/concepts/what-are-durable-objects/)。
