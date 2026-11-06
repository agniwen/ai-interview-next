ALTER TABLE `application` ADD `createdBy` text;--> statement-breakpoint
ALTER TABLE `application` ADD `createdByType` text;
--> statement-breakpoint
UPDATE `application`
SET (`createdBy`, `createdByType`) = (
  SELECT `actorId`, `actorType`
  FROM `application_activity`
  WHERE `applicationId` = `application`.`id`
    AND `workspaceId` = `application`.`workspaceId`
    AND `action` = 'created'
  ORDER BY `occurredAt`, `id`
  LIMIT 1
)
WHERE `id` IN (
  SELECT `applicationId`
  FROM `application_activity`
  WHERE `action` = 'created'
);
