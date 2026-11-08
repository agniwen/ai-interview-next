import { MutationObserver, QueryClient } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vitest";
import {
  candidateFormMutation,
  candidateEndMutation,
  candidateConnectionQuery,
  candidateStartMutation,
  candidateConnection,
  candidateInterviewQuery,
} from "@/components/features/candidate-interview/client";
import type { CandidateInterview } from "@/components/features/candidate-interview/client";

const token = "a".repeat(64);
const entry: CandidateInterview = {
  admissionDeadline: null,
  candidateName: "Test Candidate",
  endedAt: null,
  feedback: null,
  form: null,
  jobDescription: "Build reliable systems.",
  jobTitle: "Engineer",
  kind: "ai",
  label: "",
  questions: { capturedAt: "2026-11-07T00:00:00Z", conversationCount: 1, form: [], version: 1 },
  scheduledAt: null,
  sequence: 1,
  startedAt: null,
  status: "scheduled",
  version: 1,
  workspaceName: "Team",
};

afterEach(() => vi.restoreAllMocks());

it("serializes draft and submission requests and caches the final submitted answers", async () => {
  const client = new QueryClient();
  const key = candidateInterviewQuery(token).queryKey;
  client.setQueryData(key, entry);
  let resolveDraft!: (response: Response) => void;
  // eslint-disable-next-line promise/avoid-new -- 手动完成草稿请求以验证提交按顺序等待。 / Control draft completion to verify submission waits in order.
  const firstResponse = new Promise<Response>((resolve) => {
    resolveDraft = resolve;
  });
  const draft = { answers: { question: "Draft" }, version: 1 as const };
  const final = { answers: { question: "Final" }, version: 1 as const };
  const form = {
    content: final,
    submittedAt: "2026-11-07T00:01:00Z",
    updatedAt: "2026-11-07T00:01:00Z",
    version: 1,
  };
  const request = vi
    .spyOn(globalThis, "fetch")
    .mockReturnValueOnce(firstResponse)
    .mockResolvedValueOnce(Response.json({ form, version: 1 }));
  const autosave = new MutationObserver(client, candidateFormMutation(client, token));
  const submit = new MutationObserver(client, candidateFormMutation(client, token));
  const draftPromise = autosave.mutate({ content: draft, submit: false });
  await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(1));
  const submissionPromise = submit.mutate({ content: final, submit: true });
  await vi.waitFor(() => expect(submit.getCurrentResult().isPaused).toBe(true));
  expect(request).toHaveBeenCalledTimes(1);
  resolveDraft(Response.json({ form: { ...form, content: draft, submittedAt: null }, version: 1 }));
  await Promise.all([draftPromise, submissionPromise]);
  expect(request).toHaveBeenCalledTimes(2);
  expect(request.mock.calls[0][1]?.method).toBe("PUT");
  expect(request.mock.calls[1][1]?.method).toBe("POST");
  expect(String(request.mock.calls[1][0])).toContain("/form/submit");
  expect(JSON.parse(request.mock.calls[1][1]?.body as string)).toEqual(final);
  expect(client.getQueryData(key)).toEqual({ ...entry, form });
  client.clear();
});

it("keeps the saved draft when a save fails and allows retrying the current answers", async () => {
  const client = new QueryClient();
  const key = candidateInterviewQuery(token).queryKey;
  client.setQueryData(key, entry);
  const content = { answers: { question: "Retry this answer" }, version: 1 as const };
  const form = { content, submittedAt: null, updatedAt: "2026-11-07T00:01:00Z", version: 1 };
  vi.spyOn(globalThis, "fetch")
    .mockRejectedValueOnce(new TypeError("Failed to fetch"))
    .mockResolvedValueOnce(Response.json({ form, version: 1 }));
  const mutation = new MutationObserver(client, candidateFormMutation(client, token));
  await expect(mutation.mutate({ content, submit: false })).rejects.toThrow("Failed to fetch");
  expect(client.getQueryData(key)).toEqual(entry);
  await mutation.mutate({ content, submit: false });
  expect(client.getQueryData(key)).toEqual({ ...entry, form });
  client.clear();
});

it("invalidates the invitation when the server locks answers", async () => {
  const client = new QueryClient();
  const key = candidateInterviewQuery(token).queryKey;
  client.setQueryData(key, entry);
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    Response.json({ error: "INTERVIEW_FORM_LOCKED", version: 1 }, { status: 409 }),
  );
  const mutation = new MutationObserver(client, candidateFormMutation(client, token));
  await expect(
    mutation.mutate({ content: { answers: {}, version: 1 }, submit: true }),
  ).rejects.toThrow("INTERVIEW_FORM_LOCKED");
  expect(client.getQueryState(key)?.isInvalidated).toBe(true);
  expect(client.getQueryData(key)).toEqual(entry);
  client.clear();
});

it("starts explicitly, locks cached answers, and awaits invitation invalidation", async () => {
  const client = new QueryClient();
  const key = candidateInterviewQuery(token).queryKey;
  client.setQueryData(key, entry);
  const request = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(Response.json({ startedAt: "2026-11-08T00:00:00Z", version: 1 }));
  const invalidate = vi.spyOn(client, "invalidateQueries");
  const mutation = new MutationObserver(client, candidateStartMutation(client, token));
  await mutation.mutate();
  expect(String(request.mock.calls[0][0])).toContain("/start");
  expect(JSON.parse(request.mock.calls[0][1]?.body as string)).toEqual({ version: 1 });
  expect(client.getQueryData(key)).toMatchObject({
    startedAt: "2026-11-08T00:00:00Z",
    status: "in_progress",
  });
  expect(invalidate).toHaveBeenCalledWith({ queryKey: key });
  client.clear();
});

it("leaves preparation unchanged when starting is rejected", async () => {
  const client = new QueryClient();
  const key = candidateInterviewQuery(token).queryKey;
  client.setQueryData(key, entry);
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    Response.json({ error: "INTERVIEW_FORM_INCOMPLETE", version: 1 }, { status: 409 }),
  );
  const mutation = new MutationObserver(client, candidateStartMutation(client, token));
  await expect(mutation.mutate()).rejects.toThrow("INTERVIEW_FORM_INCOMPLETE");
  expect(client.getQueryData(key)).toEqual(entry);
  client.clear();
});

it("fetches connection credentials without starting an interview and exposes retryable failures", async () => {
  const request = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(
      Response.json({ error: "INTERVIEW_CONNECTION_FAILED", version: 1 }, { status: 503 }),
    )
    .mockResolvedValueOnce(
      Response.json({
        participantToken: "room-token",
        serverUrl: "wss://example.test",
        version: 1,
      }),
    );
  await expect(candidateConnection(token)).rejects.toThrow("INTERVIEW_CONNECTION_FAILED");
  await expect(candidateConnection(token)).resolves.toMatchObject({
    participantToken: "room-token",
  });
  expect(request.mock.calls.every(([url]) => String(url).endsWith("/connection"))).toBe(true);
});

it("marks successful completion in the entry cache and invalidates the authoritative state", async () => {
  const client = new QueryClient();
  const key = candidateInterviewQuery(token).queryKey;
  const active: CandidateInterview = { ...entry, status: "in_progress" };
  client.setQueryData(key, active);
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    Response.json({ endedAt: "2026-11-08T00:10:00Z", version: 1 }),
  );
  await new MutationObserver(client, candidateEndMutation(client, token)).mutate();
  expect(client.getQueryData(key)).toMatchObject({
    endedAt: "2026-11-08T00:10:00Z",
    status: "completed",
  });
  expect(client.getQueryState(key)?.isInvalidated).toBe(true);
  client.clear();
});

it("rechecks entry after connection is denied without calling start", async () => {
  const client = new QueryClient();
  const key = candidateInterviewQuery(token).queryKey;
  client.setQueryData(key, entry);
  const request = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(
      Response.json({ error: "INTERVIEW_CONNECTION_UNAVAILABLE", version: 1 }, { status: 409 }),
    );
  await expect(client.fetchQuery(candidateConnectionQuery(client, token))).rejects.toThrow(
    "INTERVIEW_CONNECTION_UNAVAILABLE",
  );
  expect(client.getQueryState(key)?.isInvalidated).toBe(true);
  expect(request.mock.calls.every(([url]) => String(url).endsWith("/connection"))).toBe(true);
  client.clear();
});
