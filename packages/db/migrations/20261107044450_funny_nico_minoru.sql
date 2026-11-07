CREATE TABLE `application_feedback` (
	`applicationId` text NOT NULL,
	`authorUserId` text NOT NULL,
	`body` text NOT NULL,
	`createdAt` integer NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`workspaceId` text NOT NULL,
	FOREIGN KEY (`authorUserId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`workspaceId`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`workspaceId`,`applicationId`) REFERENCES `application`(`workspaceId`,`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `application_feedback_timeline_idx` ON `application_feedback` (`workspaceId`,`applicationId`,`createdAt`,`id`);--> statement-breakpoint
ALTER TABLE `application_evaluation` ADD `internalCriteriaSnapshot` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `resume_processing_run` ADD `internalCriteriaSnapshot` text DEFAULT '' NOT NULL;