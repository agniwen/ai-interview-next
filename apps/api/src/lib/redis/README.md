# 会话目录存储

为 Agent 会话目录提供 Redis 风格的字符串和哈希操作，数据由 Cloudflare Durable Object 存储。

- [index.ts](./index.ts) 定义 `Redis` 接口，包括 `get`、`set`、`del` 和 `hset`、`hdel`、`hgetall`。
- [cloudflare.ts](./cloudflare.ts) 实现 `RedisObject`，由 API 的 `REDIS` binding 提供。

Agent 按当前作用域取得对象，用 `sessions` 哈希保存会话摘要。字段名是会话 ID，值是序列化后的摘要。Agent 的调度和每条会话的运行状态由各自的会话对象负责。

```ts
const directory = env.REDIS.getByName(scope);
const entries = await directory.hgetall("sessions");
```
