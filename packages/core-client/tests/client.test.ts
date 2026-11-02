import { app } from "@ai-interview/api";
import { describe, expect, expectTypeOf, it } from "vitest";

import { createCoreClient } from "../src/index";

describe("core client", () => {
  it("uses the supplied transport to call the real API with inferred response types", async () => {
    const requests: Request[] = [];
    const client = createCoreClient({
      baseUrl: "https://api.example.test",
      fetch: (input, init) => {
        const request = new Request(input, init);
        requests.push(request);
        return Promise.resolve(app.fetch(request));
      },
    });

    const response = await client.health.$get();
    expectTypeOf(response.status).toEqualTypeOf<200 | 400>();
    if (response.status !== 200) {
      throw new Error("Expected a successful health response");
    }
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ status: "ok" });
    expectTypeOf(body).toEqualTypeOf<{ status: "ok" }>();
    expect(requests).toHaveLength(1);
    expect(requests[0]?.url).toBe("https://api.example.test/health");
    expect(requests[0]?.method).toBe("GET");
  });

  it("rejects unsupported query parameters at the API boundary", async () => {
    const response = await app.request("/health?unexpected=value");

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: [{ code: "unrecognized_keys", keys: ["unexpected"] }],
      success: false,
    });
  });

  it("leaves unknown routes unavailable", async () => {
    const response = await app.request("/not-found");
    expect(response.status).toBe(404);
  });
});
