import { once } from "node:events";
import { promisify } from "node:util";
import { createServer } from "node:http";
import type { ServerResponse } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { openNodeSqliteStorage } from "@earendil-works/pi-durable/storage/sqlite/node";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { AgentRuntime } from "../src/modules/agent/runtime";
import { createAgentModels } from "../src/modules/agent/model";

const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  await Promise.all(cleanup.splice(0).map((close) => close()));
});

async function fixture() {
  const requests: { response: ServerResponse; body: string; closed: boolean }[] = [];
  const server = createServer((request, response) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
    });
    request.on("end", () => {
      const entry = { body, closed: false, response };
      requests.push(entry);
      response.on("close", () => {
        entry.closed = true;
      });
      response.writeHead(200, { "Content-Type": "text/event-stream" });
      response.write(
        `data: ${JSON.stringify({ choices: [{ delta: { content: "Hello", role: "assistant" }, finish_reason: null, index: 0 }], id: "answer", object: "chat.completion.chunk" })}\n\n`,
      );
    });
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Missing test server address");
  }
  const { models } = createAgentModels({
    AGENT_CHAT_BASE_URL: `http://127.0.0.1:${address.port}/v1`,
    AGENT_CHAT_KEY: "test",
    AGENT_CHAT_MODEL: "test-chat",
  });
  const work: Promise<unknown>[] = [];
  const directory = await mkdtemp(path.join(tmpdir(), "sainoa-agent-"));
  const storagePath = path.join(directory, "chat.sqlite");
  const options = {
    background: (promise: Promise<unknown>) => {
      work.push(promise);
    },
    changed: async () => {},
    modelId: "test-chat",
    models,
  };
  let runtime = await AgentRuntime.open(await openNodeSqliteStorage(storagePath), options);
  await runtime.initialize(crypto.randomUUID());
  await runtime.command({ title: "Test", type: "rename" });
  cleanup.push(async () => {
    await runtime.stop();
    await Promise.allSettled(work);
    await runtime.close();
    server.closeAllConnections();
    await promisify(server.close.bind(server))();
    await rm(directory, { recursive: true });
  });
  const finish = (index: number) => {
    requests[index].response.end(
      `data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: "stop", index: 0 }] })}\n\ndata: [DONE]\n\n`,
    );
  };
  async function restart() {
    await runtime.close();
    runtime = await AgentRuntime.open(await openNodeSqliteStorage(storagePath), options);
    await runtime.recover();
    return runtime;
  }
  return { finish, requests, restart, runtime };
}

describe("Agent runtime with the real pi-durable harness", () => {
  it("reopens persisted history and queue without resuming a stopped chat", async () => {
    const fixtureData = await fixture();
    await fixtureData.runtime.command({ id: crypto.randomUUID(), text: "First", type: "send" });
    await expect.poll(() => fixtureData.requests.length).toBe(1);
    await fixtureData.runtime.command({ id: crypto.randomUUID(), text: "Next", type: "send" });
    await fixtureData.runtime.stop();
    const runtime = await fixtureData.restart();
    const state = await runtime.snapshot();
    expect(state.status).toBe("paused");
    expect(state.queue.map((item) => item.text)).toEqual(["Next"]);
    expect(state.messages.some((message) => message.text === "First")).toBe(true);
    expect(fixtureData.requests).toHaveLength(1);
  });
  it("preserves an unconsumed steering input when stopping and executes it after resume", async () => {
    const { runtime, requests, finish } = await fixture();
    await runtime.command({ id: crypto.randomUUID(), text: "First", type: "send" });
    await expect.poll(() => requests.length).toBe(1);
    const id = crypto.randomUUID();
    await runtime.command({ id, text: "Pending steer", type: "send" });
    await runtime.command({ id, type: "steer" });
    await runtime.stop();
    const stopped = await runtime.snapshot();
    expect(stopped.status).toBe("paused");
    expect(stopped.queue).toEqual([{ id, text: "Pending steer" }]);
    await runtime.command({ type: "resume" });
    await expect.poll(() => requests.length).toBe(2);
    expect(requests[1].body).toContain("Pending steer");
    finish(1);
    await expect
      .poll(async () => {
        const state = await runtime.snapshot();
        return state.status;
      })
      .toBe("idle");
  });
  it("persists, edits and reorders queued inputs; stopping cancels the HTTP stream and retains the queue", async () => {
    const { runtime, requests, finish } = await fixture();
    const first = crypto.randomUUID();
    const second = crypto.randomUUID();
    const third = crypto.randomUUID();
    await runtime.command({ id: first, text: "First", type: "send" });
    await expect.poll(() => requests.length).toBe(1);
    await runtime.command({ id: second, text: "Second", type: "send" });
    await runtime.command({ id: third, text: "Third", type: "send" });
    await runtime.command({ id: third, text: "Third edited", type: "edit" });
    await runtime.command({ ids: [third, second], type: "reorder" });
    const snapshot1 = await runtime.snapshot();
    expect(snapshot1.queue.map((item) => item.text)).toEqual(["Third edited", "Second"]);
    await runtime.command({ type: "stop" });
    await expect.poll(() => requests[0].closed).toBe(true);
    const snapshot2 = await runtime.snapshot();
    expect(snapshot2.status).toBe("paused");
    const snapshot3 = await runtime.snapshot();
    expect(snapshot3.queue).toHaveLength(2);
    await runtime.command({ id: second, type: "remove" });
    await runtime.command({ type: "resume" });
    await expect.poll(() => requests.length).toBe(2);
    expect(requests[1].body).toContain("Third edited");
    finish(1);
    await expect
      .poll(async () => {
        const snapshot = await runtime.snapshot();
        return snapshot.status;
      })
      .toBe("idle");
    const snapshot4 = await runtime.snapshot();
    expect(snapshot4.queue).toHaveLength(0);
    const snapshot5 = await runtime.snapshot();
    expect(snapshot5.messages.some((message) => message.text === "Hello")).toBe(true);
  });

  it("steers a queued input into the current run and does not dispatch it twice", async () => {
    const { runtime, requests, finish } = await fixture();
    await runtime.command({ id: crypto.randomUUID(), text: "First", type: "send" });
    await expect.poll(() => requests.length).toBe(1);
    const id = crypto.randomUUID();
    await runtime.command({ id, text: "Use this condition", type: "send" });
    await runtime.command({ id, type: "steer" });
    const snapshot6 = await runtime.snapshot();
    expect(snapshot6.queue).toEqual([]);
    finish(0);
    await expect.poll(() => requests.length).toBe(2);
    expect(requests[1].body).toContain("Use this condition");
    finish(1);
    await expect
      .poll(async () => {
        const snapshot = await runtime.snapshot();
        return snapshot.status;
      })
      .toBe("idle");
    const snapshot7 = await runtime.snapshot();
    expect(
      snapshot7.messages.filter((message) => message.text === "Use this condition"),
    ).toHaveLength(1);
  });

  it("deduplicates sends and restores trashed conversations without resuming work", async () => {
    const { runtime, requests } = await fixture();
    const command = { id: crypto.randomUUID(), text: "First", type: "send" as const };
    await runtime.command(command);
    await runtime.command(command);
    await expect.poll(() => requests.length).toBe(1);
    await runtime.command({ id: crypto.randomUUID(), text: "Later", type: "send" });
    await runtime.command({ type: "trash" });
    const snapshot8 = await runtime.snapshot();
    expect(snapshot8.summary.trashed).toBe(true);
    await runtime.command({ type: "restore" });
    const snapshot = await runtime.snapshot();
    expect(snapshot.summary.trashed).toBe(false);
    expect(snapshot.status).toBe("paused");
    expect(snapshot.queue).toHaveLength(1);
  });
});
