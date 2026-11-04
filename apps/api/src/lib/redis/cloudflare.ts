import { DurableObject } from "cloudflare:workers";
import type { Redis } from "./index";

export class RedisObject extends DurableObject implements Redis {
  async get(key: string) {
    return (await this.ctx.storage.get<string>(`key:${key}`)) ?? null;
  }
  async set(key: string, value: string) {
    await this.ctx.storage.put(`key:${key}`, value);
  }
  async del(key: string) {
    await this.ctx.storage.delete(`key:${key}`);
  }
  async hset(key: string, field: string, value: string) {
    await this.ctx.storage.put(`hash:${key}:${field}`, value);
  }
  async hdel(key: string, field: string) {
    await this.ctx.storage.delete(`hash:${key}:${field}`);
  }
  async hgetall(key: string) {
    const prefix = `hash:${key}:`;
    const entries = await this.ctx.storage.list<string>({ prefix });
    return Object.fromEntries(
      [...entries].map(([field, value]) => [field.slice(prefix.length), value]),
    );
  }
}
