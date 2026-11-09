import { defineExtension, defineTool, section } from "@earendil-works/pi-durable";
import { businessTools, recruitingInstructions, toolContent } from "../mcp/tools";
import type { ToolContext } from "../mcp/tools";

export function recruitingTools(context: ToolContext) {
  return defineExtension({
    name: "sainoa-recruiting",
    sections: [section("recruiting", () => recruitingInstructions)],
    tools: businessTools.map((tool) =>
      defineTool({
        description: tool.description,
        execute: async (args) => {
          const result = await tool.call(context, args);
          return { isError: "error" in result, output: toolContent(result) };
        },
        name: tool.name,
        parameters: tool.inputSchema,
        replay: tool.kind === "read" ? "safe" : "unsafe",
      }),
    ),
  });
}
