CREATE TABLE `interview_event` (
	`interviewRoundId` text NOT NULL,
	`id` text NOT NULL,
	`runId` text NOT NULL,
	`at` integer NOT NULL,
	`receivedAt` integer NOT NULL,
	`source` text NOT NULL,
	`content` text NOT NULL,
	PRIMARY KEY(`interviewRoundId`, `id`),
	FOREIGN KEY (`interviewRoundId`) REFERENCES `interview_round`(`id`) ON UPDATE no action ON DELETE cascade
);
