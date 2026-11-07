-- 将历史岗位的手填部门按工作区归并，缺少创建人时保持为空。
-- Group legacy job departments by workspace, retaining null for unknown creators.
INSERT INTO department (id, workspaceId, name, createdAt, createdBy)
SELECT
  lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-a' || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))),
  legacy.workspaceId,
  trim(legacy.department),
  min(legacy.createdAt),
  NULL
FROM job AS legacy
WHERE trim(coalesce(legacy.department, '')) <> ''
  AND NOT EXISTS (
    SELECT 1 FROM department
    WHERE department.workspaceId = legacy.workspaceId
      AND department.name = trim(legacy.department)
  )
GROUP BY legacy.workspaceId, trim(legacy.department);
--> statement-breakpoint
UPDATE job
SET departmentId = (
  SELECT department.id FROM department
  WHERE department.workspaceId = job.workspaceId
    AND department.name = trim(job.department)
  ORDER BY department.createdAt, department.id
  LIMIT 1
)
WHERE departmentId IS NULL AND trim(coalesce(department, '')) <> '';
