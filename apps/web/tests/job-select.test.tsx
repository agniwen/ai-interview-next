import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderToString } from "react-dom/server";
import { expect, it } from "vitest";
import { JobSelect } from "../src/components/features/ats/job-select";

it("renders saved jobs and accessible removal controls before options load", () => {
  const markup = renderToString(
    <QueryClientProvider client={new QueryClient()}>
      <JobSelect
        id="default-jobs"
        workspaceId="workspace"
        value={[
          { id: "one", title: "Frontend" },
          { id: "two", title: "Backend" },
        ]}
        onChange={() => {}}
      />
    </QueryClientProvider>,
  );
  expect(markup).toContain('aria-label="Unbind Frontend"');
  expect(markup).toContain('aria-label="Unbind Backend"');
  expect(markup).toContain('id="default-jobs"');
});
