-- 重建轮次表之前暂存人员关系，避免级联删除丢失数据。
-- Stage assignments before rebuilding rounds so cascading deletes cannot lose them.
CREATE TABLE `interview_assignment_import` AS
SELECT r.workspaceId, r.id AS interviewRoundId, j.value AS userId,
       'interviewer' AS role, CAST(j.key AS integer) AS position
FROM interview_round r, json_each(r.configuration, '$.interviewerUserIds') j
WHERE json_extract(r.configuration, '$.kind') = 'human'
UNION ALL
SELECT workspaceId, id, json_extract(configuration, '$.confirmationUserId'), 'reviewer', 0
FROM interview_round WHERE json_extract(configuration, '$.kind') = 'ai';
--> statement-breakpoint
UPDATE interview_round SET
  kind = json_extract(configuration, '$.kind'),
  label = json_extract(configuration, '$.label'),
  interviewerAgentId = json_extract(configuration, '$.interviewerAgentId'),
  questionSelection = json_object(
    'version', 1,
    'formQuestionSetIds', json(CASE WHEN json_extract(configuration, '$.kind') = 'ai' THEN json_extract(configuration, '$.formQuestionSetIds') ELSE '[]' END),
    'conversationQuestionSetIds', json(CASE WHEN json_extract(configuration, '$.kind') = 'ai' THEN json_extract(configuration, '$.conversationQuestionSetIds') ELSE '[]' END)
  );
