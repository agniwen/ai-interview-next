CREATE TABLE `interview_evaluation` (
	`interviewRoundId` text NOT NULL,
	`workspaceId` text NOT NULL,
	`authorUserId` text NOT NULL,
	`content` text NOT NULL,
	`updatedAt` integer NOT NULL,
	`submittedAt` integer,
	PRIMARY KEY(`interviewRoundId`, `authorUserId`),
	FOREIGN KEY (`authorUserId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`workspaceId`,`interviewRoundId`) REFERENCES `interview_round`(`workspaceId`,`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `interview_evaluation_report` (
	`interviewRoundId` text PRIMARY KEY NOT NULL,
	`workspaceId` text NOT NULL,
	`status` text NOT NULL,
	`content` text,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`workspaceId`,`interviewRoundId`) REFERENCES `interview_round`(`workspaceId`,`id`) ON UPDATE no action ON DELETE cascade
);
