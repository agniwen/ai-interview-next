CREATE TABLE `interview_report` (
	`interviewRoundId` text PRIMARY KEY NOT NULL,
	`workspaceId` text NOT NULL,
	`plan` text NOT NULL,
	`progress` text NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`workspaceId`,`interviewRoundId`) REFERENCES `interview_round`(`workspaceId`,`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `interview_transcript` (
	`interviewRoundId` text NOT NULL,
	`id` text NOT NULL,
	`role` text NOT NULL,
	`text` text NOT NULL,
	`at` integer NOT NULL,
	`interrupted` integer NOT NULL,
	PRIMARY KEY(`interviewRoundId`, `id`),
	FOREIGN KEY (`interviewRoundId`) REFERENCES `interview_round`(`id`) ON UPDATE no action ON DELETE cascade
);
