-- 删除旧数字评分及其活动、任务记录，任务的尝试和发件箱由外键级联清理。
-- Remove legacy numeric scores with their activities and runs, cascading attempts and outbox entries.
DELETE FROM application_activity
WHERE action = 'evaluation_completed'
  AND json_extract(result, '$.evaluationId') IN (
    SELECT id FROM application_evaluation WHERE json_extract(result, '$.version') = 1
  );
--> statement-breakpoint
DELETE FROM resume_processing_run
WHERE evaluationId IN (
  SELECT id FROM application_evaluation WHERE json_extract(result, '$.version') = 1
);
--> statement-breakpoint
DELETE FROM application_evaluation WHERE json_extract(result, '$.version') = 1;
--> statement-breakpoint
-- 定性评价保留原有结论与证据，去掉不再展示的六维字段并统一格式版本。
-- Preserve qualitative conclusions and evidence while removing unused dimensions and unifying the format version.
UPDATE application_evaluation
SET result = json_set(json_remove(result, '$.dimensions'), '$.version', 3)
WHERE json_extract(result, '$.version') = 2;
