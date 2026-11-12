import { expect, it } from "vitest";
import { account, atsTest, read } from "./ats-fixture";
import { fixture } from "./interview-fixture";
import { internalRecruitingTools } from "../src/modules/mcp/tools";

it("lets the Agent find an interview and return the same candidate link as the GUI", async () => {
  const f = await fixture("interview-agent-link@example.com");
  const { id } = await read(f.owner.call(f.path, f.input));
  const context = {
    actor: {
      source: "internal_agent" as const,
      userId: f.owner.userId,
      workspaceId: f.owner.workspaceId,
    },
    db: atsTest.platform.database,
    env: atsTest.env,
  };
  const call = (name: string, input: object) =>
    internalRecruitingTools
      .find((tool) => tool.name === name)
      ?.call(context, {
        ...input,
        version: 1,
      });

  expect(await call("list_interviews", { applicationId: f.applicationId })).toMatchObject({
    rows: [{ id }],
    total: 1,
  });
  expect(await call("get_interview", { id })).toMatchObject({ id, label: "技术沟通" });
  expect(await call("get_interview_result", { id })).toMatchObject({ round: { id } });

  const link = await call("get_interview_invitation_link", { id });
  const { token } = await read(
    f.owner.call(`interviews/${f.owner.workspaceId}/${id}/invitation`, { version: 1 }),
  );
  expect(link).toEqual({ id, url: `https://sainoa.example/interview/${token}`, version: 1 });
  expect(await call("get_interview_invitation_link", { id })).toEqual(link);

  const other = await account("interview-agent-link-other@example.com");
  expect(
    await internalRecruitingTools
      .find((tool) => tool.name === "get_interview_invitation_link")
      ?.call(
        {
          ...context,
          actor: { ...context.actor, userId: other.userId, workspaceId: other.workspaceId },
        },
        { id, version: 1 },
      ),
  ).toEqual({ error: "INTERVIEW_UNAVAILABLE", version: 1 });
});
