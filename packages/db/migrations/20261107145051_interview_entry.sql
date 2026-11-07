CREATE TABLE `interview_invitation` (
	`token` text PRIMARY KEY NOT NULL,
	`interviewRoundId` text NOT NULL,
	`workspaceId` text NOT NULL,
	`createdAt` integer NOT NULL,
	FOREIGN KEY (`workspaceId`,`interviewRoundId`) REFERENCES `interview_round`(`workspaceId`,`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `interview_invitation_round_uq` ON `interview_invitation` (`interviewRoundId`);--> statement-breakpoint
CREATE TABLE `interview_question_snapshot` (
	`interviewRoundId` text PRIMARY KEY NOT NULL,
	`workspaceId` text NOT NULL,
	`capturedAt` integer NOT NULL,
	`content` text NOT NULL,
	FOREIGN KEY (`workspaceId`,`interviewRoundId`) REFERENCES `interview_round`(`workspaceId`,`id`) ON UPDATE no action ON DELETE cascade
);
