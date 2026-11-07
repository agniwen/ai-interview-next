PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_interview_round` (
	`admissionDeadline` integer,
	`applicationId` text NOT NULL,
	`configuration` text NOT NULL,
	`createdAt` integer NOT NULL,
	`createdBy` text,
	`id` text PRIMARY KEY NOT NULL,
	`resumeId` text,
	`scheduledAt` integer,
	`sequence` integer NOT NULL,
	`status` text NOT NULL,
	`workspaceId` text NOT NULL,
	FOREIGN KEY (`createdBy`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`workspaceId`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`workspaceId`,`applicationId`) REFERENCES `application`(`workspaceId`,`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`workspaceId`,`resumeId`) REFERENCES `resume`(`workspaceId`,`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_interview_round`("admissionDeadline", "applicationId", "configuration", "createdAt", "createdBy", "id", "resumeId", "scheduledAt", "sequence", "status", "workspaceId") SELECT "admissionDeadline", "applicationId", "configuration", "createdAt", "createdBy", "id", "resumeId", "scheduledAt", "sequence", "status", "workspaceId" FROM `interview_round`;--> statement-breakpoint
DROP TABLE `interview_round`;--> statement-breakpoint
ALTER TABLE `__new_interview_round` RENAME TO `interview_round`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `interview_round_workspace_id_uq` ON `interview_round` (`workspaceId`,`id`);