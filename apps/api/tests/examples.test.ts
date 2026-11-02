import { user } from "@ai-interview/db/schema";
import { hc } from "hono/client";
import { afterAll, beforeAll, beforeEach, describe, expect, expectTypeOf, it } from "vitest";
import { exampleApp } from "../examples/app.example";
import { runStatisticsJob } from "../examples/jobs/statistics.example";
import { app } from "../src/app";
import { createTestDatabase } from "./database";

let platform: Awaited<ReturnType<typeof createTestDatabase>>;

beforeAll(async () => {
  platform = await createTestDatabase();
});

beforeEach(async () => {
  await platform.database.delete(user);
  const now = new Date();
  await platform.database.insert(user).values(
    [false, true, true].map((emailVerified, index) => ({
      createdAt: now,
      email: `example-${index}@example.com`,
      emailVerified,
      id: `example-${index}`,
      name: `Example ${index}`,
      updatedAt: now,
    })),
  );
});

afterAll(async () => {
  await platform.dispose();
});

describe("API organization examples", () => {
  it("connects global and module middleware, query validation, service and real D1 with RPC inference", async () => {
    const { env } = platform;
    const transport: typeof globalThis.fetch = (input, init) =>
      Promise.resolve(exampleApp.request(new Request(input, init), undefined, env));
    const client = hc<typeof exampleApp>("https://example.test", {
      fetch: transport,
    });
    const response = await client.statistics.$get({ query: { verifiedOnly: "true" } });
    expectTypeOf(response.status).toEqualTypeOf<200 | 400>();
    if (response.status !== 200) {
      throw new Error("Expected a successful statistics response");
    }
    const body = await response.json();
    expectTypeOf(body).toEqualTypeOf<{ users: number }>();
    expect(body).toEqual({ users: 2 });
    expect(response.headers.get("x-request-id")).toBeTruthy();
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("returns the same service result from HTTP and a job without an HTTP context", async () => {
    const response = await exampleApp.request("/statistics", undefined, platform.env);
    expect(response.status).toBe(200);
    const result = await runStatisticsJob(platform.env);
    expect(result).toEqual({ users: 3 });
    expect(await response.json()).toEqual(result);
  });

  it("rejects invalid query input while retaining the middleware response headers", async () => {
    const response = await exampleApp.request(
      "/statistics?verifiedOnly=invalid",
      undefined,
      platform.env,
    );
    expect(response.status).toBe(400);
    expect(response.headers.get("x-request-id")).toBeTruthy();
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("keeps database middleware scoped and leaves example routes unmounted in production", async () => {
    const health = await exampleApp.request("/health");
    expect(health.status).toBe(200);
    expect(health.headers.get("x-request-id")).toBeTruthy();
    expect(health.headers.get("cache-control")).toBeNull();
    const production = await app.request("/statistics");
    expect(production.status).toBe(404);
  });
});
