import { expect, it } from "vitest";
import { createTestDatabase, migrateTestDatabase } from "./database";

it("moves round fields and ordered assignments out of JSON without losing data", async () => {
  const before = "20261107134505_interview_configuration_required.sql";
  const platform = await createTestDatabase(before);
  const db = platform.env.AUTH_DB;
  try {
    await db.batch([
      db.prepare(
        "INSERT INTO user (id,name,email,createdAt,updatedAt,emailVerified) VALUES ('one','One','one@example.com',1,1,1),('two','Two','two@example.com',1,1,1)",
      ),
      db.prepare(
        "INSERT INTO organization (id,name,slug,createdAt) VALUES ('w','Workspace','workspace',1)",
      ),
      db.prepare(
        "INSERT INTO candidate (id,workspaceId,name,creationSource,createdAt) VALUES ('c','w','Candidate','manual',1)",
      ),
      db.prepare(
        "INSERT INTO job (id,workspaceId,title,requirements,createdAt) VALUES ('j','w','Engineer','Skills',1)",
      ),
      db.prepare(
        "INSERT INTO application (id,workspaceId,candidateId,jobId,stage,createdAt) VALUES ('a','w','c','j','screening',1)",
      ),
      db.prepare(
        "INSERT INTO interviewer_agent (id,workspaceId,name,prompt,createdBy,createdAt,updatedAt) VALUES ('agent','w','Agent','Prompt','one',1,1)",
      ),
      db
        .prepare(
          "INSERT INTO interview_round (id,workspaceId,applicationId,sequence,status,createdAt,configuration) VALUES ('ai','w','a',1,'scheduled',1,?),('human','w','a',2,'scheduled',2,?)",
        )
        .bind(
          JSON.stringify({
            confirmationUserId: "two",
            conversationQuestionSetIds: ["set2", "set1"],
            formQuestionSetIds: [],
            interviewerAgentId: "agent",
            kind: "ai",
            label: "First",
            version: 1,
          }),
          JSON.stringify({
            interviewerUserIds: ["two", "one"],
            kind: "human",
            label: "Second",
            version: 1,
          }),
        ),
    ]);
    await migrateTestDatabase(db, before);
    const rounds = await db
      .prepare(
        "SELECT id, kind, label, interviewerAgentId, questionSelection FROM interview_round ORDER BY sequence",
      )
      .all();
    expect(
      rounds.results.map((round) => ({
        ...round,
        questionSelection: JSON.parse(String(round.questionSelection)),
      })),
    ).toEqual([
      {
        id: "ai",
        interviewerAgentId: "agent",
        kind: "ai",
        label: "First",
        questionSelection: {
          conversationQuestionSetIds: ["set2", "set1"],
          formQuestionSetIds: [],
          version: 1,
        },
      },
      {
        id: "human",
        interviewerAgentId: null,
        kind: "human",
        label: "Second",
        questionSelection: { conversationQuestionSetIds: [], formQuestionSetIds: [], version: 1 },
      },
    ]);
    const people = await db
      .prepare(
        "SELECT interviewRoundId, userId, role, position FROM interview_assignment ORDER BY interviewRoundId, position",
      )
      .all();
    expect(people.results).toEqual([
      { interviewRoundId: "ai", position: 0, role: "reviewer", userId: "two" },
      { interviewRoundId: "human", position: 0, role: "interviewer", userId: "two" },
      { interviewRoundId: "human", position: 1, role: "interviewer", userId: "one" },
    ]);
    const columns = await db.prepare("PRAGMA table_info(interview_round)").all();
    expect(columns.results.some((column) => column.name === "configuration")).toBe(false);
    const violations = await db.prepare("PRAGMA foreign_key_check").all();
    expect(violations.results).toEqual([]);
  } finally {
    await platform.dispose();
  }
});
