PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_resume_processing_attempt` (
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
	FOREIGN KEY (`runId`) REFERENCES `resume_processing_run`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_resume_processing_attempt`("createdAt", "deadlineAt", "error", "executionId", "finishedAt", "id", "ordinal", "parameters", "providerRequestId", "retryAfterAt", "retryable", "runId", "stage", "startedAt", "status") SELECT "createdAt", "deadlineAt", "error", "executionId", "finishedAt", "id", "ordinal", "parameters", "providerRequestId", "retryAfterAt", "retryable", "runId", "stage", "startedAt", "status" FROM `resume_processing_attempt`;--> statement-breakpoint
DROP TABLE `resume_processing_attempt`;--> statement-breakpoint
ALTER TABLE `__new_resume_processing_attempt` RENAME TO `resume_processing_attempt`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `resume_processing_attempt_run_idx` ON `resume_processing_attempt` (`runId`,`createdAt`);--> statement-breakpoint
CREATE TABLE `__new_resume_processing_outbox` (
	`attemptId` text,
	`availableAt` integer NOT NULL,
	`executionId` text NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`runId` text NOT NULL,
	`sentAt` integer,
	`topic` text NOT NULL,
	FOREIGN KEY (`attemptId`) REFERENCES `resume_processing_attempt`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`runId`) REFERENCES `resume_processing_run`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_resume_processing_outbox`("attemptId", "availableAt", "executionId", "id", "runId", "sentAt", "topic") SELECT "attemptId", "availableAt", "executionId", "id", "runId", "sentAt", "topic" FROM `resume_processing_outbox`;--> statement-breakpoint
DROP TABLE `resume_processing_outbox`;--> statement-breakpoint
ALTER TABLE `__new_resume_processing_outbox` RENAME TO `resume_processing_outbox`;--> statement-breakpoint
CREATE INDEX `resume_processing_outbox_pending_idx` ON `resume_processing_outbox` (`sentAt`,`availableAt`);