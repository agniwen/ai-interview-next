CREATE TABLE `interview_session` (
	`interviewRoundId` text PRIMARY KEY NOT NULL,
	`workspaceId` text NOT NULL,
	`capturedAt` integer NOT NULL,
	`content` text NOT NULL,
	`roomName` text NOT NULL,
	`contextToken` text NOT NULL,
	FOREIGN KEY (`workspaceId`,`interviewRoundId`) REFERENCES `interview_round`(`workspaceId`,`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `interview_session_room_uq` ON `interview_session` (`roomName`);--> statement-breakpoint
ALTER TABLE `interview_round` ADD `startedAt` integer;