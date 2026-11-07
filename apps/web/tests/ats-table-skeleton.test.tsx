import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { AtsTable } from "@/components/features/ats/list-page";
import { AtsTableSkeleton } from "@/components/skeletons/pages/ats-table-skeleton";

it("measures loading content inside each cell, including the pinned action column", () => {
  const html = renderToStaticMarkup(
    <AtsTableSkeleton>
      <AtsTable
        headings={["Name", "Contact"]}
        hasRowActions
        loading
        rows={Array.from({ length: 5 }, (_, index) => ({
          action: <span>View resume</span>,
          cells: ["Sample name", "Sample contact"],
          id: String(index),
        }))}
      />
    </AtsTableSkeleton>,
  );
  const cells = [...html.matchAll(/<(?:td|th)\b[^>]*>(?<content>[\s\S]*?)<\/(?:td|th)>/gu)];
  expect(cells).toHaveLength(18);
  for (const [, content] of cells) {
    expect(content).toContain("skullet-loading");
  }
  expect(html).not.toMatch(/skullet-covered[^>]*>\s*<(?:table|tbody)\b/u);
  expect(html).toContain('aria-busy="true"');
});
