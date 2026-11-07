CREATE TABLE `department` (
	`createdAt` integer NOT NULL,
	`createdBy` text NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`workspaceId` text NOT NULL,
	FOREIGN KEY (`workspaceId`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `department_workspace_created_idx` ON `department` (`workspaceId`,`createdAt`,`id`);--> statement-breakpoint
ALTER TABLE `job` ADD `createdBy` text;--> statement-breakpoint
ALTER TABLE `recruitment_project` ADD `createdBy` text;