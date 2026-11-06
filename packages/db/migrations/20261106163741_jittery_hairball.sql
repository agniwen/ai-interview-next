DROP INDEX `application_open_candidate_job_uq`;--> statement-breakpoint
ALTER TABLE `application` ADD `deletedAt` integer;--> statement-breakpoint
CREATE UNIQUE INDEX `application_open_candidate_job_uq` ON `application` (`workspaceId`,`candidateId`,`jobId`) WHERE "application"."closedAt" is null and "application"."deletedAt" is null;