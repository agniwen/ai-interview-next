CREATE TABLE `interviewer_agent` (
	`createdAt` integer NOT NULL,
	`createdBy` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`prompt` text NOT NULL,
	`updatedAt` integer NOT NULL,
	`workspaceId` text NOT NULL,
	FOREIGN KEY (`createdBy`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`workspaceId`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `interviewer_agent_workspace_created_idx` ON `interviewer_agent` (`workspaceId`,`createdAt`,`id`);