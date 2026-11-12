import { defineExtension, defineTool, section } from "@earendil-works/pi-durable";
import {
  businessTools,
  internalRecruitingTools,
  recruitingInstructions,
  toolContent,
} from "../mcp/tools";
import type { ToolContext } from "../mcp/tools";

export function recruitingTools(context: ToolContext) {
  return defineExtension({
    name: "sainoa-recruiting",
    sections: [
      section(
        "recruiting",
        () =>
          `${recruitingInstructions} For interview links, use list_interviews to resolve the round ID, then call get_interview_invitation_link for a candidate or get_interviewer_meeting_link for an assigned interviewer. Application summaries do not contain links. If the user is retrying a previous request, check the current tools before relying on an earlier answer.`,
      ),
    ],
    tools: [...businessTools, ...internalRecruitingTools].map((tool) =>
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
