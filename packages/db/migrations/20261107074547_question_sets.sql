CREATE TABLE `question_set` (
	`content` text NOT NULL,
	`createdAt` integer NOT NULL,
	`createdBy` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`updatedAt` integer NOT NULL,
	`workspaceId` text NOT NULL,
	FOREIGN KEY (`createdBy`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`workspaceId`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `question_set_workspace_created_idx` ON `question_set` (`workspaceId`,`createdAt`,`id`);