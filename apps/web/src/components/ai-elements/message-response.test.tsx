import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MessageResponse } from "./message-response";

describe("MessageResponse", () => {
  it("formats incomplete emphasis while streaming without repairing history", () => {
    const live = renderToStaticMarkup(<MessageResponse streaming>**正在输出</MessageResponse>);
    const history = renderToStaticMarkup(<MessageResponse>**正在输出</MessageResponse>);
    expect(live).toContain('data-streamdown="strong"');
    expect(live).toContain("正在输出</span>");
    expect(history).toContain("**正在输出");
    expect(history).not.toContain('data-streamdown="strong"');
  });

  it("renders CJK emphasis and GFM tables with the local table wrapper", () => {
    const html = renderToStaticMarkup(
      <MessageResponse>
        {"**中文。**后续\n\n| 名称 | 值 |\n| --- | --- |\n| 状态 | 完成 |"}
      </MessageResponse>,
    );
    expect(html).toContain("中文。</span>");
    expect(html).toContain("<table");
    expect(html).toContain("overflow-x-auto rounded-lg border border-input");
    expect(html).toContain("完成");
  });
});
