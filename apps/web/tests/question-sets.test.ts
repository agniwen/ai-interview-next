import { MutationObserver, QueryClient, QueryObserver } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vitest";
import {
  questionSetQuery,
  questionSetsQuery,
  saveQuestionSetMutation,
} from "../src/components/features/question-sets/client";
import {
  changeQuestionType,
  formSetInput,
  newOption,
  newQuestion,
  questionDrafts,
  questionIsComplete,
} from "../src/components/features/question-sets/form-draft";
import { questionSetListSearch } from "../src/components/features/question-sets/list-search";
import { questionSetKeys } from "../src/components/features/question-sets/query-keys";

afterEach(() => vi.restoreAllMocks());

it("serializes reordered questions and options without leaking editor keys or losing repeated prompts", () => {
  const drafts = questionDrafts({
    kind: "form",
    questions: [
      {
        content: "到岗时间？",
        description: "说明",
        options: ["两周", "一个月"],
        type: "single_choice",
      },
      { content: "工作地点？", options: ["上海", "北京"], type: "multiple_choice" },
      { content: "到岗时间？", type: "text" },
    ],
    version: 1,
  });
  const reordered = [drafts[2], drafts[0], drafts[1]];
  reordered[1] = { ...reordered[1], options: [reordered[1].options[1], reordered[1].options[0]] };
  expect(reordered.map((question) => question.key)).toEqual([
    drafts[2].key,
    drafts[0].key,
    drafts[1].key,
  ]);
  expect(drafts[0].options.map((option) => option.value)).toEqual(["两周", "一个月"]);
  expect(formSetInput("基础表单", "", reordered)).toEqual({
    content: {
      kind: "form",
      questions: [
        { content: "到岗时间？", description: "", type: "text" },
        {
          content: "到岗时间？",
          description: "说明",
          options: ["一个月", "两周"],
          type: "single_choice",
        },
        {
          content: "工作地点？",
          description: "",
          options: ["上海", "北京"],
          type: "multiple_choice",
        },
      ],
      version: 1,
    },
    description: "",
    name: "基础表单",
    version: 1,
  });
  expect(formSetInput("空题套", "", [])).toMatchObject({
    content: { kind: "form", questions: [], version: 1 },
  });
});

it("preserves option drafts across type changes but omits them for text submissions", () => {
  const single = changeQuestionType(newQuestion(), "single_choice");
  expect(single.options).toHaveLength(2);
  single.content = "选择地点";
  single.options[0].value = "上海";
  single.options[1].value = "北京";
  single.options.push({ ...newOption(), value: "广州" });
  const text = changeQuestionType(single, "text");
  expect(formSetInput("名称", "", [text]).content.questions).toEqual([
    { content: "选择地点", description: "", type: "text" },
  ]);
  const multiple = changeQuestionType(text, "multiple_choice");
  expect(multiple.options).toEqual(single.options);
  expect(multiple.key).toBe(single.key);
  expect(questionIsComplete(multiple)).toBe(true);
  expect(
    formSetInput("名称", "", [{ ...multiple, options: multiple.options.slice(1) }]).content
      .questions,
  ).toMatchObject([{ options: ["北京", "广州"], type: "multiple_choice" }]);
});

it("marks unfinished questions and overlong Markdown as incomplete", () => {
  const blank = newQuestion();
  expect(questionIsComplete(blank)).toBe(false);
  const text = { ...blank, content: "Question" };
  expect(questionIsComplete(text)).toBe(true);
  expect(questionIsComplete({ ...text, content: "  " })).toBe(false);
  expect(questionIsComplete({ ...text, content: "x".repeat(1001) })).toBe(false);
  expect(questionIsComplete({ ...text, description: "x".repeat(501) })).toBe(false);
  const choice = changeQuestionType(text, "multiple_choice");
  expect(questionIsComplete(choice)).toBe(false);
  choice.options[0].value = "A";
  choice.options[1].value = "  ";
  expect(questionIsComplete(choice)).toBe(false);
  choice.options[1].value = "B";
  expect(questionIsComplete(choice)).toBe(true);
});

it("keeps URL kind, pagination and search in requests and separate cache entries", async () => {
  const query = questionSetListSearch.parse({
    kind: "conversation",
    page: 3,
    pageSize: 50,
    search: "  技术  ",
  });
  expect(questionSetListSearch.parse({})).toEqual({
    kind: "form",
    page: 1,
    pageSize: 20,
    search: "",
  });
  expect(questionSetListSearch.parse({ kind: "unknown", page: -1 })).toMatchObject({
    kind: "form",
    page: 1,
  });
  const request = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(
      Response.json({ page: 3, pageSize: 50, rows: [], total: 0, version: 1 }),
    );
  const client = new QueryClient();
  await client.fetchQuery(questionSetsQuery("workspace", query));
  const url = new URL(String(request.mock.calls[0][0]), "https://sainoa.example");
  expect(url.pathname).toBe("/api/question-sets/workspace");
  expect(Object.fromEntries(url.searchParams)).toEqual({
    kind: "conversation",
    page: "3",
    pageSize: "50",
    search: "技术",
  });
  expect(questionSetsQuery("workspace", query).queryKey).not.toEqual(
    questionSetsQuery("workspace", { ...query, kind: "form" }).queryKey,
  );
  expect(questionSetsQuery("workspace", query).queryKey).not.toEqual(
    questionSetsQuery("other", query).queryKey,
  );
  const record = {
    content: { kind: "form", questions: [], version: 1 },
    description: "",
    name: "表单",
    version: 1,
  };
  request.mockResolvedValueOnce(Response.json(record));
  expect(await client.fetchQuery(questionSetQuery("workspace", "set-id"))).toEqual(record);
  expect(request.mock.calls[1][0]).toBe("/api/question-sets/workspace/set-id");
  client.clear();
});

it.each([undefined, "set-id"])(
  "saves %s and waits for list counts and detail refresh in the affected workspace",
  async (id) => {
    const request = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(Response.json({ id: "set-id", version: 1 }));
    const client = new QueryClient();
    const keys = questionSetKeys.workspace("workspace");
    const query = questionSetListSearch.parse({});
    const list = keys._ctx.list(query).queryKey;
    const nextPage = keys._ctx.list({ ...query, page: 2 }).queryKey;
    const detail = keys._ctx.detail("set-id").queryKey;
    const other = questionSetKeys.workspace("other")._ctx.list(query).queryKey;
    for (const queryKey of [list, nextPage, detail, other]) {
      client.setQueryData(queryKey, { version: 1 });
    }
    let finishRefresh!: (value: { version: number; total: number }) => void;
    // eslint-disable-next-line promise/avoid-new -- 控制刷新完成时机，验证保存会等待。 / Control refresh completion to verify that saving waits.
    const refresh = new Promise<{ version: number; total: number }>((resolve) => {
      finishRefresh = resolve;
    });
    const observer = new QueryObserver(client, {
      queryFn: () => refresh,
      queryKey: list,
      staleTime: Infinity,
    });
    const unsubscribe = observer.subscribe(() => {});
    const mutation = new MutationObserver(client, saveQuestionSetMutation(client, "workspace", id));
    const payload = formSetInput("新题套", "", [{ ...newQuestion(), content: "介绍一下自己。" }]);
    const saved = mutation.mutate(payload);
    await vi.waitFor(() => expect(client.getQueryState(list)?.fetchStatus).toBe("fetching"));
    expect(mutation.getCurrentResult().isPending).toBe(true);
    expect(request.mock.calls[0][0]).toBe(
      id ? "/api/question-sets/workspace/set-id" : "/api/question-sets/workspace",
    );
    expect(request.mock.calls[0][1]?.method).toBe(id ? "PUT" : "POST");
    expect(JSON.parse(String(request.mock.calls[0][1]?.body))).toEqual(payload);
    finishRefresh({ total: 1, version: 1 });
    await saved;
    expect(client.getQueryData(list)).toEqual({ total: 1, version: 1 });
    expect(client.getQueryState(nextPage)?.isInvalidated).toBe(true);
    expect(client.getQueryState(detail)?.isInvalidated).toBe(true);
    expect(client.getQueryState(other)?.isInvalidated).toBe(false);
    unsubscribe();
    client.clear();
  },
);

it("leaves cached content intact when a save is rejected", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    Response.json({ error: "INVALID_INPUT", version: 1 }, { status: 400 }),
  );
  const client = new QueryClient();
  const key = questionSetKeys.workspace("workspace")._ctx.detail("set-id").queryKey;
  const original = { name: "Original", version: 1 };
  client.setQueryData(key, original);
  const mutation = new MutationObserver(
    client,
    saveQuestionSetMutation(client, "workspace", "set-id"),
  );
  await expect(mutation.mutate(formSetInput("", "", []))).rejects.toThrow();
  expect(client.getQueryData(key)).toEqual(original);
  expect(client.getQueryState(key)?.isInvalidated).toBe(false);
  client.clear();
});
