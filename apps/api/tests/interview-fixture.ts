import { application, candidate, job, member } from "@ai-interview/db/schema";
import { account, atsTest, read } from "./ats-fixture";

export async function fixture(email: string) {
  const owner = await account(email);
  const db = atsTest.platform.database;
  const candidateId = crypto.randomUUID();
  const jobId = crypto.randomUUID();
  const applicationId = crypto.randomUUID();
  await db.insert(candidate).values({
    createdAt: new Date(),
    creationSource: "manual",
    id: candidateId,
    name: "Candidate",
    workspaceId: owner.workspaceId,
  });
  await db.insert(job).values({
    createdAt: new Date(),
    id: jobId,
    requirements: "Skills",
    title: "Engineer",
    workspaceId: owner.workspaceId,
  });
  await db.insert(application).values({
    candidateId,
    createdAt: new Date(),
    id: applicationId,
    jobId,
    stage: "screening",
    workspaceId: owner.workspaceId,
  });
  const agent = await read(
    owner.call(`interviewer-agents/${owner.workspaceId}`, {
      name: "Interviewer",
      prompt: "Ask one question at a time",
      version: 1,
    }),
  );
  const makeSet = (kind: "form" | "conversation", empty = false) =>
    read(
      owner.call(`question-sets/${owner.workspaceId}`, {
        content: {
          kind,
          questions: empty
            ? []
            : [
                kind === "form"
                  ? { content: "Background?", type: "text" }
                  : { content: "Tell me about a project", difficulty: "medium" },
              ],
          version: 1,
        },
        name: kind,
        version: 1,
      }),
    );
  const form = await makeSet("form");
  const conversation = await makeSet("conversation");
  const second = await makeSet("conversation");
  const empty = await makeSet("conversation", true);
  const input = {
    conversationQuestionSetIds: [second.id as string, conversation.id as string],
    formQuestionSetIds: [form.id as string],
    interviewerAgentId: agent.id as string,
    kind: "ai" as const,
    label: "  技术沟通  ",
    version: 1 as const,
  };
  return {
    agent,
    applicationId,
    conversation,
    empty,
    form,
    input,
    jobId,
    owner,
    path: `interviews/${owner.workspaceId}/applications/${applicationId}`,
  };
}

export async function addInterviewMember(workspaceId: string, email: string, role = "member") {
  const person = await account(email);
  await atsTest.platform.database.insert(member).values({
    createdAt: new Date(),
    id: crypto.randomUUID(),
    organizationId: workspaceId,
    role,
    userId: person.userId,
  });
  return person;
}

export function editRound(
  person: Awaited<ReturnType<typeof account>>,
  path: string,
  input: object,
) {
  return person.request(path, {
    body: JSON.stringify(input),
    headers: { "content-type": "application/json" },
    method: "PUT",
  });
}
