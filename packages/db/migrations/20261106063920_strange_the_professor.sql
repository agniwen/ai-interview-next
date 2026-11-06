CREATE TABLE `recruitment_project` (
	`createdAt` integer NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`workspaceId` text NOT NULL,
	FOREIGN KEY (`workspaceId`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `job` ADD `projectId` text REFERENCES recruitment_project(id);