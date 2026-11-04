import { chatList, chatSnapshot } from "@ai-interview/agent";
import type { AgentCommand, ChatSnapshot, ChatSummary } from "@ai-interview/agent";
import { createCoreClient } from "@ai-interview/core-client";

const client = createCoreClient({ baseUrl: "" });
function checked(response: Response): Promise<unknown> {
  if (!response.ok) {
    throw new Error(response.status === 503 ? "AGENT_NOT_CONFIGURED" : "AGENT_REQUEST_FAILED");
  }
  return response.json();
}
export function agentClient(workspaceId: string) {
  const { sessions } = client.api.agent[":workspaceId"];
  return {
    async command(sessionId: string, command: AgentCommand): Promise<ChatSnapshot> {
      return chatSnapshot.parse(
        await checked(
          await sessions[":sessionId"].commands.$post({
            json: command,
            param: { sessionId, workspaceId },
          }),
        ),
      );
    },
    async create(id: string, messageId: string, text: string): Promise<ChatSnapshot> {
      const response = await sessions.$post({
        json: { id, messageId, text },
        param: { workspaceId },
      });
      if (!response.ok) {
        throw new Error(response.status === 503 ? "AGENT_NOT_CONFIGURED" : "AGENT_REQUEST_FAILED");
      }
      return chatSnapshot.parse(await response.json());
    },
    events(sessionId: string) {
      return `/api/agent/${encodeURIComponent(workspaceId)}/sessions/${encodeURIComponent(sessionId)}/events`;
    },
    async list(): Promise<{ sessions: ChatSummary[] }> {
      const response = await sessions.$get({ param: { workspaceId } });
      return chatList.parse(await checked(response));
    },
    async remove(sessionId: string) {
      return checked(
        await sessions[":sessionId"].permanent.$delete({ param: { sessionId, workspaceId } }),
      );
    },
  };
}
