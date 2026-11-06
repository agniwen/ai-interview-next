import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { expect, it } from "vitest";
import { atsKeys } from "../src/components/ats/query-keys";

it("invalidates project pages and picker options only in the affected workspace", async () => {
  const client = new QueryClient();
  const projects = atsKeys.projects("first-workspace");
  const list = projects._ctx.list({ page: 1, pageSize: 20, search: "frontend" }).queryKey;
  const nextPage = projects._ctx.list({ page: 2, pageSize: 20, search: "frontend" }).queryKey;
  const options = projects._ctx.options.queryKey;
  const otherOptions = atsKeys.projects("other-workspace")._ctx.options.queryKey;
  const jobs = atsKeys.jobs("first-workspace")._ctx.options.queryKey;

  for (const queryKey of [list, nextPage, options, otherOptions, jobs]) {
    client.setQueryData(queryKey, []);
  }

  const observer = new QueryObserver(client, {
    queryFn: () => Promise.resolve(["New project"]),
    queryKey: options,
    staleTime: Infinity,
  });
  const unsubscribe = observer.subscribe(() => {});
  await client.invalidateQueries({ queryKey: projects.queryKey });
  unsubscribe();

  for (const queryKey of [list, nextPage]) {
    expect(client.getQueryState(queryKey)?.isInvalidated).toBe(true);
  }
  expect(client.getQueryData(options)).toEqual(["New project"]);
  expect(client.getQueryState(otherOptions)?.isInvalidated).toBe(false);
  expect(client.getQueryState(jobs)?.isInvalidated).toBe(false);
});
