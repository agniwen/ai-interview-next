/** 最小 Redis 风格端口，承载会话目录；不承担 Agent 调度和 pi 的存储事务。
 * Minimal Redis-shaped port for the chat directory, not agent scheduling or pi storage transactions. */
export interface Redis {
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string) => Promise<void>;
  del: (key: string) => Promise<void>;
  hset: (key: string, field: string, value: string) => Promise<void>;
  hdel: (key: string, field: string) => Promise<void>;
  hgetall: (key: string) => Promise<Record<string, string>>;
}
