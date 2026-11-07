CREATE TABLE `interview_form_response` (
	`content` text NOT NULL,
	`interviewRoundId` text PRIMARY KEY NOT NULL,
	`submittedAt` integer,
	`updatedAt` integer NOT NULL,
	`workspaceId` text NOT NULL,
	FOREIGN KEY (`workspaceId`,`interviewRoundId`) REFERENCES `interview_round`(`workspaceId`,`id`) ON UPDATE no action ON DELETE cascade
);
