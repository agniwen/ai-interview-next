import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MessageResponse } from "./message-response";

describe("MessageResponse", () => {
  it("formats incomplete emphasis while streaming without repairing history", () => {
    const live = renderToStaticMarkup(<MessageResponse streaming>**正在输出</MessageResponse>);
    const history = renderToStaticMarkup(<MessageResponse>**正在输出</MessageResponse>);
    expect(live).toContain('data-streamdown="strong"');
    expect(live.replaceAll(/<[^>]+>/gu, "")).toBe("正在输出");
    expect(live).toContain('data-sd-animate="true"');
    expect(history).toContain("**正在输出");
    expect(history).not.toContain('data-streamdown="strong"');
    expect(history).not.toContain("data-sd-animate");
  });

  it("initially reveals only the first block of a streamed batch", () => {
    const markdown = "第一段\n\n第二段";
    const live = renderToStaticMarkup(<MessageResponse streaming>{markdown}</MessageResponse>);
    const history = renderToStaticMarkup(<MessageResponse>{markdown}</MessageResponse>);

    expect(live.replaceAll(/<[^>]+>/gu, "")).toBe("第一段");
    expect(history.replaceAll(/<[^>]+>/gu, "")).toBe("第一段\n第二段");
  });

  it("renders CJK emphasis and GFM tables with the local table wrapper", () => {
    const html = renderToStaticMarkup(
      <MessageResponse>
        {"**中文。**后续\n\n| 名称 | 值 |\n| --- | --- |\n| 状态 | 完成 |"}
      </MessageResponse>,
    );
    expect(html).toContain("中文。</span>");
    expect(html).toContain("<table");
    expect(html).toContain('data-slot="scroll-area-viewport"');
    expect(html).toContain("完成");
  });
});
