CREATE TABLE `interview_assignment` (
	`workspaceId` text NOT NULL,
	`interviewRoundId` text NOT NULL,
	`userId` text NOT NULL,
	`role` text NOT NULL,
	`position` integer NOT NULL,
	FOREIGN KEY (`workspaceId`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`workspaceId`,`interviewRoundId`) REFERENCES `interview_round`(`workspaceId`,`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `interview_assignment_round_user_role_uq` ON `interview_assignment` (`workspaceId`,`interviewRoundId`,`userId`,`role`);--> statement-breakpoint
CREATE INDEX `interview_assignment_user_round_idx` ON `interview_assignment` (`workspaceId`,`userId`,`interviewRoundId`);--> statement-breakpoint
ALTER TABLE `interview_round` ADD `kind` text;--> statement-breakpoint
ALTER TABLE `interview_round` ADD `label` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `interview_round` ADD `interviewerAgentId` text REFERENCES interviewer_agent(id);--> statement-breakpoint
ALTER TABLE `interview_round` ADD `questionSelection` text;--> statement-breakpoint
CREATE INDEX `interview_round_application_sequence_idx` ON `interview_round` (`workspaceId`,`applicationId`,`sequence`,`id`);