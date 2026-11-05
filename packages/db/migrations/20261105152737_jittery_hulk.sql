CREATE TABLE `application_activity` (
	`action` text NOT NULL,
	`actorId` text NOT NULL,
	`actorType` text NOT NULL,
	`applicationId` text NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`occurredAt` integer NOT NULL,
	`result` text NOT NULL,
	`workspaceId` text NOT NULL,
	FOREIGN KEY (`workspaceId`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`workspaceId`,`applicationId`) REFERENCES `application`(`workspaceId`,`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `application_activity_timeline_idx` ON `application_activity` (`workspaceId`,`applicationId`,`occurredAt`);--> statement-breakpoint
CREATE TABLE `resume_processing_attempt` (
	`createdAt` integer NOT NULL,
	`deadlineAt` integer,
	`error` text,
	`executionId` text NOT NULL,
	`finishedAt` integer,
	`id` text PRIMARY KEY NOT NULL,
	`ordinal` integer NOT NULL,
	`parameters` text,
	`providerRequestId` text,
	`retryAfterAt` integer,
	`retryable` integer DEFAULT false NOT NULL,
	`runId` text NOT NULL,
	`stage` text NOT NULL,
	`startedAt` integer,
	`status` text NOT NULL,
	FOREIGN KEY (`runId`) REFERENCES `resume_processing_run`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `resume_processing_attempt_run_idx` ON `resume_processing_attempt` (`runId`,`createdAt`);--> statement-breakpoint
CREATE TABLE `resume_processing_outbox` (
	`attemptId` text,
	`availableAt` integer NOT NULL,
	`executionId` text NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`runId` text NOT NULL,
	`sentAt` integer,
	`topic` text NOT NULL,
	FOREIGN KEY (`attemptId`) REFERENCES `resume_processing_attempt`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`runId`) REFERENCES `resume_processing_run`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `resume_processing_outbox_pending_idx` ON `resume_processing_outbox` (`sentAt`,`availableAt`);--> statement-breakpoint
CREATE TABLE `resume_processing_run` (
	`applicationId` text,
	`createdAt` integer NOT NULL,
	`evaluationId` text,
	`executionId` text NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`jobRequirementsSnapshot` text,
	`kind` text NOT NULL,
	`resumeId` text,
	`stage` text NOT NULL,
	`status` text NOT NULL,
	`uploadItemId` text,
	`workspaceId` text NOT NULL,
	FOREIGN KEY (`applicationId`) REFERENCES `application`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`evaluationId`) REFERENCES `application_evaluation`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`resumeId`) REFERENCES `resume`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`uploadItemId`) REFERENCES `resume_upload_item`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`workspaceId`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `resume_processing_run_canonical_uq` ON `resume_processing_run` (`resumeId`) WHERE "resume_processing_run"."kind" = 'parse' and "resume_processing_run"."resumeId" is not null;--> statement-breakpoint
CREATE INDEX `resume_processing_run_application_idx` ON `resume_processing_run` (`applicationId`,`createdAt`);--> statement-breakpoint
CREATE TABLE `resume_upload_batch` (
	`createdAt` integer NOT NULL,
	`createdBy` text NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`workspaceId` text NOT NULL,
	FOREIGN KEY (`workspaceId`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `resume_upload_item` (
	`batchId` text NOT NULL,
	`filename` text NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`objectKey` text NOT NULL,
	`runId` text,
	`size` integer NOT NULL,
	`status` text NOT NULL,
	`submissionId` text,
	`workspaceId` text NOT NULL,
	FOREIGN KEY (`batchId`) REFERENCES `resume_upload_batch`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`submissionId`) REFERENCES `resume_submission`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`workspaceId`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `resume_upload_item_batch_idx` ON `resume_upload_item` (`batchId`);--> statement-breakpoint
CREATE INDEX `resume_upload_item_submission_idx` ON `resume_upload_item` (`submissionId`);