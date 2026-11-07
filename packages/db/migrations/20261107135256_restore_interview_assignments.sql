INSERT INTO interview_assignment (workspaceId, interviewRoundId, userId, role, position)
SELECT workspaceId, interviewRoundId, userId, role, position FROM interview_assignment_import;
--> statement-breakpoint
DROP TABLE interview_assignment_import;
