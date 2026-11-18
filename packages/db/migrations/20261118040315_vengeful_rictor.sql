CREATE TABLE `model_usage` (
	`cachedInputTokens` integer,
	`id` text PRIMARY KEY NOT NULL,
	`inputAudioTokens` integer,
	`inputTokens` integer,
	`interviewRoundId` text,
	`model` text NOT NULL,
	`occurredAt` integer NOT NULL,
	`outputAudioTokens` integer,
	`outputTokens` integer,
	`pages` integer,
	`provider` text NOT NULL,
	`requestId` text,
	`retry` integer NOT NULL,
	`stage` text NOT NULL,
	`submissionId` text NOT NULL,
	`userId` text NOT NULL,
	`workspaceId` text NOT NULL,
	FOREIGN KEY (`workspaceId`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `model_usage_owner_time_idx` ON `model_usage` (`workspaceId`,`userId`,`occurredAt`,`id`);